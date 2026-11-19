-- ==============================================================================
-- MIGRACIÓN: AUTO-CONFIRMAR CORREOS Y PERMITIR LOGIN INMEDIATO DE TODAS LAS CUENTAS
-- ==============================================================================

-- 1. Confirmar correos de todos los usuarios actuales que estén pendientes
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 2. Función y Trigger para auto-confirmar nuevos usuarios al registrarse
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_confirm_user_email ON auth.users;
CREATE TRIGGER tr_auto_confirm_user_email
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_user_email();

-- 3. Asegurar permisos y RLS en public.user_roles para que los usuarios puedan leer sus roles
GRANT ALL ON public.user_roles TO authenticated, service_role;
GRANT SELECT ON public.user_roles TO anon;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_own" ON public.user_roles;
CREATE POLICY "roles_select_own" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "roles_admin_all" ON public.user_roles;
CREATE POLICY "roles_admin_all" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));
