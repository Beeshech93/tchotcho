-- Migración: Funciones de seguridad para lectura y escritura de integration_credentials y sincronización de billeteras admin
-- Permite que administradores y funciones del servidor accedan a las credenciales operativas de integraciones y sincronicen saldos

CREATE OR REPLACE FUNCTION public.get_integration_credentials(_names text[])
RETURNS TABLE(name text, value text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ic.name, ic.value
  FROM public.integration_credentials ic
  WHERE ic.name = ANY(_names);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_integration_credential(_name text, _value text, _user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _value IS NULL OR _value = '' THEN
    DELETE FROM public.integration_credentials WHERE name = _name;
  ELSE
    INSERT INTO public.integration_credentials (name, value, updated_at, updated_by)
    VALUES (_name, _value, now(), _user_id)
    ON CONFLICT (name)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;
  END IF;
END;
$$;

-- Función SECURITY DEFINER para sincronizar billetera admin y registrar transacción
CREATE OR REPLACE FUNCTION public.sync_admin_bazik_wallet(_target_user_id uuid, _balance numeric, _source text DEFAULT 'bazik_api')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _w_id uuid;
  _old_bal numeric := 0;
  _diff numeric;
BEGIN
  SELECT id, balance INTO _w_id, _old_bal FROM public.wallets WHERE user_id = _target_user_id AND currency = 'HTG';
  
  IF _w_id IS NULL THEN
    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (_target_user_id, 'HTG', _balance, 'active')
    RETURNING id INTO _w_id;
    _old_bal := 0;
  ELSE
    UPDATE public.wallets
    SET balance = _balance, updated_at = now()
    WHERE id = _w_id;
  END IF;

  _diff := _balance - _old_bal;
  IF _diff <> 0 THEN
    INSERT INTO public.wallet_transactions (wallet_id, user_id, kind, amount, currency, description)
    VALUES (
      _w_id,
      _target_user_id,
      CASE WHEN _diff > 0 THEN 'admin_deposit' ELSE 'admin_deduct' END,
      _diff,
      'HTG',
      format('Sincronización saldo Bazik (%s): %s HTG', _source, _balance::text)
    );
  END IF;

  INSERT INTO public.integration_credentials (name, value, updated_at, updated_by)
  VALUES ('BAZIK_LAST_SYNCED_BALANCE', _balance::text, now(), _target_user_id)
  ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;

  INSERT INTO public.integration_credentials (name, value, updated_at, updated_by)
  VALUES ('BAZIK_LAST_SYNCED_AT', now()::text, now(), _target_user_id)
  ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;

  RETURN _balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_integration_credentials(text[]) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.set_integration_credential(text, text, uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.sync_admin_bazik_wallet(uuid, numeric, text) TO authenticated, service_role, anon;

-- Habilitar permisos de actualización de billeteras para staff
GRANT ALL ON public.wallets TO authenticated, service_role;
DROP POLICY IF EXISTS "wallets_all_staff" ON public.wallets;
CREATE POLICY "wallets_all_staff" ON public.wallets
FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
