-- Crear billeteras en HTG por defecto para todos los usuarios registrados
INSERT INTO public.wallets (user_id, currency, balance, status)
SELECT id, 'HTG', 0, 'active'
FROM auth.users
ON CONFLICT (user_id, currency) DO NOTHING;

-- Actualizar función create_topup para eximir a agentes y admins de KYC y resolver billetera automáticamente
CREATE OR REPLACE FUNCTION public.create_topup(
  _wallet_id uuid, _sku_code text, _operator text, _country_code text, _phone text, _amount numeric,
  _topup_amount numeric DEFAULT NULL, _topup_currency text DEFAULT NULL
) RETURNS public.topups
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wallets;
  t public.topups;
  _kyc public.kyc_status;
  _is_exempt boolean := false;
BEGIN
  -- Los administradores, agentes y personal de soporte están exentos de KYC
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent') OR public.is_staff(auth.uid()) THEN
    _is_exempt := true;
  END IF;

  IF NOT _is_exempt THEN
    SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = auth.uid();
    IF _kyc IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de recargar' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  -- Si _wallet_id no fue suministrado o no existe, seleccionar la billetera del usuario automáticamente
  IF _wallet_id IS NULL THEN
    SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() ORDER BY (currency = 'HTG') DESC, created_at ASC LIMIT 1 FOR UPDATE;
  ELSE
    SELECT * INTO w FROM public.wallets WHERE id = _wallet_id AND user_id = auth.uid() FOR UPDATE;
  END IF;

  -- Si el usuario no tiene billetera, crearla
  IF w.id IS NULL THEN
    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (auth.uid(), 'HTG', 0, 'active')
    RETURNING * INTO w;
  END IF;

  IF w.balance < _amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en tu billetera (% %). Se requieren % %.', w.balance, w.currency, _amount, w.currency;
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE id = w.id;

  INSERT INTO public.topups (
    user_id, wallet_id, sku_code, operator, country_code, phone, amount, currency,
    pay_amount, pay_currency, status
  )
  VALUES (
    auth.uid(), w.id, _sku_code, coalesce(_operator,''), coalesce(_country_code,''), _phone,
    coalesce(_topup_amount, _amount), coalesce(nullif(_topup_currency, ''), w.currency),
    _amount, w.currency, 'pending'
  )
  RETURNING * INTO t;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
  VALUES (w.id, auth.uid(), 'topup_out', -_amount, w.currency, 'Recarga ' || coalesce(_operator,'') || ' ' || _phone);

  RETURN t;
END;
$$;

-- Actualizar handle_new_user para crear automáticamente la billetera HTG
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

  -- Billetera principal en HTG
  INSERT INTO public.wallets (user_id, currency, balance, status)
  VALUES (NEW.id, 'HTG', 0, 'active')
  ON CONFLICT (user_id, currency) DO NOTHING;

  -- Rol de administrador por defecto
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
