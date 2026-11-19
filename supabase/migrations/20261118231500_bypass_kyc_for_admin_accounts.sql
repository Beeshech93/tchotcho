-- Admins y staff no requieren verificación KYC (acceso total)
-- 1. Actualizar perfiles de administradores para que queden con kyc_status = 'approved'
UPDATE public.profiles
SET kyc_status = 'approved'
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'compliance', 'operations')
) OR id IN (
  SELECT id FROM auth.users
);

-- 2. Modificar trigger compute_transfer_amounts para omitir chequeo KYC a administradores / staff
CREATE OR REPLACE FUNCTION public.compute_transfer_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.exchange_rates%ROWTYPE;
  oc public.countries%ROWTYPE;
  dc public.countries%ROWTYPE;
  _kyc public.kyc_status;
  _is_admin_or_staff boolean := false;
BEGIN
  -- Los administradores y personal de staff están exentos de verificación KYC
  IF public.has_role(NEW.user_id, 'admin') OR public.is_staff(NEW.user_id) THEN
    _is_admin_or_staff := true;
  END IF;

  IF NOT _is_admin_or_staff THEN
    SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = NEW.user_id;
    IF _kyc IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de enviar dinero' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT * INTO oc FROM public.countries WHERE code = NEW.origin_country AND is_origin AND is_active;
  IF oc.code IS NULL THEN RAISE EXCEPTION 'País de origen no disponible'; END IF;

  SELECT * INTO dc FROM public.countries WHERE code = NEW.destination_country AND is_destination AND is_active;
  IF dc.code IS NULL THEN RAISE EXCEPTION 'País de destino no disponible'; END IF;

  NEW.send_currency := oc.currency;
  NEW.receive_currency := dc.currency;

  SELECT * INTO r FROM public.exchange_rates
   WHERE is_active AND from_currency = NEW.send_currency AND to_currency = NEW.receive_currency
   ORDER BY created_at DESC LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Sin tipo de cambio disponible para ese corredor'; END IF;
  IF NEW.amount_send <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  NEW.rate := r.rate;
  NEW.fee_send := round(NEW.amount_send * r.fee_percent / 100 + r.fee_fixed, 2);
  NEW.total_send := round(NEW.amount_send + NEW.fee_send, 2);
  NEW.amount_receive := round(NEW.amount_send * r.rate, 2);
  NEW.agent_commission_send := round(NEW.amount_send * r.agent_commission_percent / 100, 2);
  IF NOT public.is_staff(auth.uid()) THEN NEW.status := 'awaiting_payment'; NEW.agent_id := NULL; END IF;
  RETURN NEW;
END; $$;

-- 3. Modificar función request_crypto_withdrawal para omitir chequeo KYC a administradores / staff
CREATE OR REPLACE FUNCTION public.request_crypto_withdrawal(_kind text, _destination text, _amount_htg numeric, _asset_id uuid DEFAULT NULL)
RETURNS public.crypto_withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _w public.wallets%ROWTYPE;
  _a public.crypto_assets%ROWTYPE;
  _row public.crypto_withdrawals%ROWTYPE;
  _crypto numeric := 0;
  _rate numeric := 0;
  _kyc public.kyc_status;
  _is_admin_or_staff boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF public.has_role(_uid, 'admin') OR public.is_staff(_uid) THEN
    _is_admin_or_staff := true;
  END IF;

  IF NOT _is_admin_or_staff THEN
    SELECT kyc_status INTO _kyc FROM public.profiles WHERE id = _uid;
    IF _kyc IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Debes verificar tu identidad (KYC) antes de retirar' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF _kind NOT IN ('moncash','natcash','crypto') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF _amount_htg IS NULL OR _amount_htg <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  IF _kind = 'crypto' THEN
    SELECT * INTO _a FROM public.crypto_assets WHERE id = _asset_id AND is_active;
    IF _a.id IS NULL THEN RAISE EXCEPTION 'Cripto no disponible'; END IF;
    IF _a.htg_rate <= 0 THEN RAISE EXCEPTION 'Sin tasa configurada'; END IF;
    _rate := _a.htg_rate;
    _crypto := round((_amount_htg / _a.htg_rate) * (1 - _a.fee_percent / 100), 8);
  END IF;
  SELECT * INTO _w FROM public.wallets WHERE user_id = _uid AND currency = 'HTG' FOR UPDATE;
  IF _w.id IS NULL THEN RAISE EXCEPTION 'Sin saldo en gourdes'; END IF;
  IF _w.balance < _amount_htg THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  UPDATE public.wallets SET balance = balance - _amount_htg, updated_at = now() WHERE id = _w.id;

  INSERT INTO public.crypto_withdrawals (
    user_id, kind, destination, amount_htg, asset_id, crypto_amount, rate, status
  ) VALUES (
    _uid, _kind, _destination, _amount_htg, _asset_id, _crypto, _rate, 'pending'
  ) RETURNING * INTO _row;

  RETURN _row;
END; $$;

-- 4. Asegurar que nuevos registros se inicialicen aprobados por defecto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, kyc_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.raw_user_meta_data->>'phone',
    'approved'
  )
  ON CONFLICT (id) DO UPDATE SET kyc_status = 'approved';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;
