-- ==============================================================================
-- MIGRACIÓN: PERMITIR GESTIÓN LIBRE DE ROLES (AGENTE / ADMIN / CLIENTE)
-- ==============================================================================

-- 1. Actualizar is_staff para priorizar roles explícitos de la tabla user_roles
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

  -- Si tiene rol de agente o admin en user_roles, es staff
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role::text IN ('agent', 'admin', 'super_admin')
  ) THEN
    RETURN true;
  END IF;

  -- Fallback de seguridad solo para el superadmin principal
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND (
      lower(COALESCE(email, '')) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com')
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

  RETURN false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon, service_role;

-- 2. Actualizar admin_get_all_users para reflejar fielmente los roles de user_roles
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
  wallet_balance_htg numeric,
  wallet_balance_usd numeric,
  wallet_balance_dop numeric
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
      WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id) THEN
        ARRAY(SELECT DISTINCT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id)
      WHEN lower(COALESCE(u.email::text, '')) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com') THEN
        ARRAY['admin'::text]
      ELSE 
        ARRAY['client'::text]
    END AS roles,
    COALESCE((SELECT w.balance FROM public.wallets w WHERE w.user_id = u.id AND w.currency = 'HTG' LIMIT 1), 0)::numeric AS wallet_balance_htg,
    COALESCE((SELECT w.balance FROM public.wallets w WHERE w.user_id = u.id AND w.currency = 'USD' LIMIT 1), 0)::numeric AS wallet_balance_usd,
    COALESCE((SELECT w.balance FROM public.wallets w WHERE w.user_id = u.id AND w.currency = 'DOP' LIMIT 1), 0)::numeric AS wallet_balance_dop
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated, anon, service_role;
