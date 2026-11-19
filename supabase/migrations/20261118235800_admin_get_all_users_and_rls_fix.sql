-- Corrección de visibilidad de usuarios para administradores y Super Admin
-- 1. Actualizar is_staff y has_role para reconocer inmediatamente a lajanrapid26@gmail.com y charlesagency4@gmail.com
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Chequeo por roles en tabla
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('agent','admin')) THEN
    RETURN true;
  END IF;

  -- Chequeo por email en auth.users
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND lower(email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) THEN
    RETURN true;
  END IF;

  IF _role = 'admin' AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND lower(email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. Asegurar fila de admin en user_roles para administradores designados
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Crear perfiles faltantes para usuarios en auth.users si no existen
INSERT INTO public.profiles (id, full_name, phone, kyc_status)
SELECT 
  u.id, 
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 
  u.raw_user_meta_data->>'phone',
  CASE WHEN lower(u.email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com') THEN 'approved'::public.kyc_status ELSE 'none'::public.kyc_status END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Billetera HTG para todos los usuarios existentes
INSERT INTO public.wallets (user_id, currency, balance, status)
SELECT u.id, 'HTG', 0, 'active'
FROM auth.users u
LEFT JOIN public.wallets w ON w.user_id = u.id AND w.currency = 'HTG'
WHERE w.id IS NULL
ON CONFLICT (user_id, currency) DO NOTHING;

-- 5. RPC optimizado para traer todos los usuarios con su email, roles, estado y balance
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  country text,
  language text,
  kyc_status text,
  created_at timestamptz,
  roles text[],
  balance_htg numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (
    public.is_staff(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND lower(auth.users.email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(NULLIF(p.full_name, ''), u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text AS full_name,
    COALESCE(p.phone, u.raw_user_meta_data->>'phone')::text AS phone,
    COALESCE(p.country, 'HT')::text AS country,
    COALESCE(p.language, 'es')::text AS language,
    COALESCE(p.kyc_status::text, 'none')::text AS kyc_status,
    u.created_at,
    COALESCE(
      (SELECT array_agg(ur.role::text) FROM public.user_roles ur WHERE ur.user_id = u.id),
      ARRAY[]::text[]
    ) AS roles,
    COALESCE(
      (SELECT w.balance FROM public.wallets w WHERE w.user_id = u.id AND w.currency = 'HTG' LIMIT 1),
      0
    )::numeric AS balance_htg
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;

-- 6. Garantizar permisos RLS para lectura de perfiles, roles y billeteras por el personal administrativo
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "roles_select_own" ON public.user_roles;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
