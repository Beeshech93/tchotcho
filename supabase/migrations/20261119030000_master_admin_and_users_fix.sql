-- ==============================================================================
-- SOLUCIÓN DEFINITIVA: VISIBILIDAD DE USUARIOS Y SUPER ADMINS (TCHO-TCHO)
-- Proyecto: yyvaeapmmvoklofydcpl
-- Ejecutar en Supabase Dashboard -> SQL Editor -> Click 'Run'
-- ==============================================================================

-- 1. Asegurar columna 'status' en la tabla wallets para evitar error 42703
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 2. Asegurar campos en la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'HT';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es';

-- 3. Tabla de credenciales e integraciones
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.integration_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO authenticated;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_credentials_staff_all" ON public.integration_credentials;
CREATE POLICY "integration_credentials_staff_all" ON public.integration_credentials
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

-- 4. Función de verificación de staff y administradores maestros
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

  -- Chequeo por administradores maestros (correo, teléfono o ID)
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND (
      lower(COALESCE(email, '')) IN (
        'lajanrapid26@gmail.com',
        'charlesagency4@gmail.com',
        'beeshecharles@gmail.com'
      )
      OR COALESCE(phone, '') IN ('529988100395', '+529988100395')
      OR COALESCE(raw_user_meta_data->>'phone', '') IN ('529988100395', '+529988100395')
      OR id IN (
        'cca63804-b4c1-4221-bbd3-82258545f228'::uuid,
        '9b729a8e-b91c-430a-907c-969652b89f3b'::uuid,
        '0a1fec01-21c2-4af6-8e54-4b7ce6e2913c'::uuid
      )
    )
  ) THEN
    RETURN true;
  END IF;

  -- Chequeo por rol en user_roles
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role::text IN ('agent', 'admin', 'super_admin')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon, service_role;

-- 5. Función has_role (sobrecargada para text y app_role)
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

  IF _role = 'admin' AND public.is_staff(_user_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role::text = _role
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $f$
        SELECT public.has_role(_user_id, _role::text);
      $f$;
      GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
    ';
  END IF;
END $$;

-- 6. Función RPC para listar todos los usuarios en el panel de administración
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
  IF NOT (public.is_staff(auth.uid()) OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    COALESCE(NULLIF(u.email::text, ''), p.email::text, '')::text AS email,
    COALESCE(NULLIF(p.full_name, ''), u.raw_user_meta_data->>'full_name', split_part(COALESCE(u.email::text, ''), '@', 1), 'Usuario')::text AS full_name,
    COALESCE(NULLIF(p.phone, ''), u.raw_user_meta_data->>'phone', u.phone::text, '')::text AS phone,
    COALESCE(p.country, 'HT')::text AS country,
    COALESCE(p.language, 'es')::text AS language,
    CASE 
      WHEN public.is_staff(u.id) THEN 'approved'::text
      ELSE COALESCE(p.kyc_status::text, 'none')::text
    END AS kyc_status,
    u.created_at,
    CASE 
      WHEN public.is_staff(u.id) THEN 
        ARRAY['admin'::text] || ARRAY(SELECT DISTINCT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role::text != 'admin')
      ELSE 
        COALESCE(
          (SELECT array_agg(DISTINCT ur.role::text) FROM public.user_roles ur WHERE ur.user_id = u.id),
          ARRAY['client']::text[]
        )
    END AS roles,
    COALESCE(
      (SELECT w.balance FROM public.wallets w WHERE w.user_id = u.id AND w.currency = 'HTG' LIMIT 1),
      0
    )::numeric AS balance_htg
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated, anon, service_role;

-- 7. Sincronizar perfiles y roles para los 3 administradores
DO $$
DECLARE
  v_rec RECORD;
  v_perms text := '{"isSuperAdmin":true,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}';
BEGIN
  FOR v_rec IN 
    SELECT id, email, phone, raw_user_meta_data FROM auth.users 
    WHERE lower(COALESCE(email, '')) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com', 'beeshecharles@gmail.com')
       OR COALESCE(phone, '') IN ('529988100395', '+529988100395')
       OR id IN (
         'cca63804-b4c1-4221-bbd3-82258545f228'::uuid,
         '9b729a8e-b91c-430a-907c-969652b89f3b'::uuid,
         '0a1fec01-21c2-4af6-8e54-4b7ce6e2913c'::uuid
       )
  LOOP
    -- Perfil
    INSERT INTO public.profiles (id, full_name, email, phone, kyc_status, country, language)
    VALUES (
      v_rec.id,
      COALESCE(v_rec.raw_user_meta_data->>'full_name', split_part(COALESCE(v_rec.email, ''), '@', 1), 'Administrador'),
      v_rec.email,
      COALESCE(v_rec.raw_user_meta_data->>'phone', v_rec.phone),
      'approved',
      'HT',
      'es'
    )
    ON CONFLICT (id) DO UPDATE
    SET kyc_status = 'approved',
        email = COALESCE(EXCLUDED.email, profiles.email),
        phone = COALESCE(EXCLUDED.phone, profiles.phone);

    -- Rol Admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_rec.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Permisos Super Admin completos
    INSERT INTO public.integration_credentials (name, value, updated_at)
    VALUES ('ADMIN_PERMISSIONS_' || v_rec.id, v_perms, now())
    ON CONFLICT (name) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();

    -- Billeteras
    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (v_rec.id, 'HTG', 0, 'active')
    ON CONFLICT (user_id, currency) DO NOTHING;

    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (v_rec.id, 'USD', 0, 'active')
    ON CONFLICT (user_id, currency) DO NOTHING;
  END LOOP;
END $$;

-- 8. Actualizar políticas RLS para visibilidad total de los administradores
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "roles_select_own" ON public.user_roles;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 9. Recargar caché del schema en PostgREST
NOTIFY pgrst, 'reload schema';
