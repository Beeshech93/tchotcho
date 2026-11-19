-- Asignar rol admin a charlesagency4@gmail.com
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 1. Si el usuario ya está registrado en auth.users, asignarle rol admin y kyc_status 'approved'
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'charlesagency4@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Asignar rol admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Aprobar KYC automáticamente
    UPDATE public.profiles
    SET kyc_status = 'approved'
    WHERE id = v_user_id;

    -- Otorgar permisos de administrador para todas las pestañas
    INSERT INTO public.integration_credentials (name, value, updated_at)
    VALUES (
      'ADMIN_PERMISSIONS_' || v_user_id,
      '{"isSuperAdmin":false,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}',
      now()
    )
    ON CONFLICT (name) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
  END IF;
END $$;

-- 2. Asegurar que en el trigger de nuevos registros charlesagency4@gmail.com también sea reconocido como admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Crear perfil
  INSERT INTO public.profiles (id, full_name, phone, kyc_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.raw_user_meta_data->>'phone',
    CASE
      WHEN lower(COALESCE(NEW.email, '')) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com') THEN 'approved'
      ELSE 'none'
    END
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Billetera principal en HTG con balance 0
  INSERT INTO public.wallets (user_id, currency, balance, status)
  VALUES (NEW.id, 'HTG', 0, 'active')
  ON CONFLICT (user_id, currency) DO NOTHING;

  -- 3. Asignación de roles
  IF lower(COALESCE(NEW.email, '')) = 'lajanrapid26@gmail.com' THEN
    -- Super Administrador Maestro
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

  ELSIF lower(COALESCE(NEW.email, '')) = 'charlesagency4@gmail.com' THEN
    -- Administrador
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.integration_credentials (name, value, updated_at)
    VALUES (
      'ADMIN_PERMISSIONS_' || NEW.id,
      '{"isSuperAdmin":false,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}',
      now()
    )
    ON CONFLICT (name) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();

  ELSE
    -- Cliente estándar
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;
