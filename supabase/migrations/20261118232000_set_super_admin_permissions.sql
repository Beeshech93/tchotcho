-- Configurar todas las cuentas registradas como Super Administrador con acceso total a todos los módulos
-- 1. Asignar rol admin en user_roles a todos los usuarios
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Guardar permisos de Super Admin en integration_credentials para cada usuario
INSERT INTO public.integration_credentials (name, value, updated_at)
SELECT
  'ADMIN_PERMISSIONS_' || id,
  '{"isSuperAdmin":true,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}',
  now()
FROM auth.users
ON CONFLICT (name) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

-- 3. Actualizar función handle_new_user para crear automáticamente a los nuevos usuarios como Super Admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Perfil con KYC aprobado
  INSERT INTO public.profiles (id, full_name, phone, kyc_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.raw_user_meta_data->>'phone',
    'approved'
  )
  ON CONFLICT (id) DO UPDATE SET kyc_status = 'approved';

  -- Rol de administrador
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Permisos de Super Administrador (todos los módulos)
  INSERT INTO public.integration_credentials (name, value, updated_at)
  VALUES (
    'ADMIN_PERMISSIONS_' || NEW.id,
    '{"isSuperAdmin":true,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}',
    now()
  )
  ON CONFLICT (name) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

  RETURN NEW;
END; $$;
