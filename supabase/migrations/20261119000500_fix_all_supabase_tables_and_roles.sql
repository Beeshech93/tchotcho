-- ==============================================================================
-- 1. CREAR FUNCIONES BASE is_staff Y has_role (SIN DEPENDENCIAS EXTERNAS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Administradores maestros inmediatos
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND lower(email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
  ) THEN
    RETURN true;
  END IF;

  -- 2. Rol admin o agent en user_roles
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role::text IN ('agent', 'admin')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF _role = 'admin' AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND lower(email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role::text = _role
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon, service_role;

-- Tipos app_role y kyc_status si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'client');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
    CREATE TYPE public.kyc_status AS ENUM ('none', 'pending', 'approved', 'rejected');
  END IF;

  EXECUTE '
    CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, auth
    AS $func$
      SELECT public.has_role(_user_id, _role::text);
    $func$;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
  ';
END $$;

-- ==============================================================================
-- 2. TABLAS BASE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  country text NOT NULL DEFAULT 'HT',
  language text NOT NULL DEFAULT 'es',
  kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'HTG',
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallets_user_id_currency_key UNIQUE (user_id, currency)
);

GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. POLÍTICAS RLS LIMPIAS SIN RECURSIÓN
-- ==============================================================================

DROP POLICY IF EXISTS "roles_select_own" ON public.user_roles;
CREATE POLICY "roles_select_own" ON public.user_roles
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ==============================================================================
-- 4. FUNCIÓN RPC admin_get_all_users INDEPENDIENTE Y SEGURA
-- ==============================================================================

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
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(NULLIF(p.full_name, ''), u.raw_user_meta_data->>'full_name', split_part(u.email::text, '@', 1))::text AS full_name,
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

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated, service_role;

-- ==============================================================================
-- 5. CONFIGURAR ADMINISTRADORES MAESTROS (charlesagency4 y lajanrapid26)
-- ==============================================================================

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN 
    SELECT id, email FROM auth.users 
    WHERE lower(email) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_rec.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, kyc_status)
    VALUES (v_rec.id, split_part(v_rec.email, '@', 1), 'approved'::public.kyc_status)
    ON CONFLICT (id) DO UPDATE
    SET kyc_status = 'approved'::public.kyc_status;

    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (v_rec.id, 'HTG', 0, 'active')
    ON CONFLICT (user_id, currency) DO NOTHING;

    INSERT INTO public.integration_credentials (name, value, updated_at)
    VALUES (
      'ADMIN_PERMISSIONS_' || v_rec.id,
      '{"isSuperAdmin":true,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}',
      now()
    )
    ON CONFLICT (name) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
  END LOOP;
END $$;

-- ==============================================================================
-- 6. SINCRONIZAR RESTO DE USUARIOS REGISTRADOS
-- ==============================================================================

INSERT INTO public.profiles (id, full_name, phone, kyc_status)
SELECT 
  u.id, 
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 
  u.raw_user_meta_data->>'phone',
  'none'::public.kyc_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallets (user_id, currency, balance, status)
SELECT u.id, 'HTG', 0, 'active'
FROM auth.users u
LEFT JOIN public.wallets w ON w.user_id = u.id AND w.currency = 'HTG'
WHERE w.id IS NULL
ON CONFLICT (user_id, currency) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'client'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- ==============================================================================
-- 7. TRIGGER AUTOMÁTICO PARA NUEVOS REGISTROS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  is_master boolean;
BEGIN
  is_master := lower(COALESCE(NEW.email, '')) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com');

  INSERT INTO public.profiles (id, full_name, phone, kyc_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN is_master THEN 'approved'::public.kyc_status ELSE 'none'::public.kyc_status END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, currency, balance, status)
  VALUES (NEW.id, 'HTG', 0, 'active')
  ON CONFLICT (user_id, currency) DO NOTHING;

  IF is_master THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.integration_credentials (name, value, updated_at)
    VALUES (
      'ADMIN_PERMISSIONS_' || NEW.id,
      '{"isSuperAdmin":true,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}',
      now()
    )
    ON CONFLICT (name) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
