-- Corregir registro de nuevos usuarios: deben registrarse con rol 'client' (cliente estándar), NO como administrador
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Crear perfil estándar con kyc_status 'none' (a verificar por el cliente)
  INSERT INTO public.profiles (id, full_name, phone, kyc_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.raw_user_meta_data->>'phone',
    'none'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Billetera principal en HTG con balance 0
  INSERT INTO public.wallets (user_id, currency, balance, status)
  VALUES (NEW.id, 'HTG', 0, 'active')
  ON CONFLICT (user_id, currency) DO NOTHING;

  -- 3. Asignar rol estándar de cliente ('client'), salvo si es la cuenta maestra
  IF lower(NEW.email) = 'lajanrapid26@gmail.com' THEN
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
END; $$;
