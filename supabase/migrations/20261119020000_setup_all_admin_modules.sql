-- ==============================================================================
-- CONFIGURACIÓN COMPLETA PARA TODOS LOS MÓDULOS DE ADMINISTRACIÓN (TCHO-TCHO)
-- ==============================================================================

-- 1. Función utilitaria para timestamps automáticos
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. INTEGRATION CREDENTIALS (Servicios, Mercado Pago, Stripe, Resend, Bazik, DingConnect, Banner, Migración)
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT ALL ON public.integration_credentials TO service_role;
GRANT SELECT ON public.integration_credentials TO authenticated;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_credentials_select" ON public.integration_credentials;
CREATE POLICY "integration_credentials_select" ON public.integration_credentials
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- Valores iniciales para Control de Servicios
INSERT INTO public.integration_credentials (name, value) VALUES
  ('SERVICES_CONFIG', '{"transfers_enabled":true,"topups_enabled":true,"crypto_enabled":true,"withdrawals_enabled":true,"kyc_required":true}')
ON CONFLICT (name) DO NOTHING;

-- 3. KYC (Validación de Identidad y Documentos)
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_number text NOT NULL,
  birth_date date,
  address text,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid,
  document_photo_path text,
  document_back_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_select" ON public.kyc_submissions;
CREATE POLICY "kyc_select" ON public.kyc_submissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "kyc_insert_own" ON public.kyc_submissions;
CREATE POLICY "kyc_insert_own" ON public.kyc_submissions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "kyc_update_admin" ON public.kyc_submissions;
CREATE POLICY "kyc_update_admin" ON public.kyc_submissions FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 4. TRANSFERENCIAS Y EVENTOS (Módulo de Transacciones, Contabilidad y Resumen)
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_city text NOT NULL,
  delivery_method text NOT NULL DEFAULT 'cash_pickup',
  payment_method text NOT NULL DEFAULT 'transfer',
  amount_send numeric(12,2) NOT NULL DEFAULT 0,
  send_currency text NOT NULL DEFAULT 'USD',
  fee_send numeric(12,2) NOT NULL DEFAULT 0,
  total_send numeric(12,2) NOT NULL DEFAULT 0,
  rate numeric(14,6) NOT NULL DEFAULT 1,
  amount_receive numeric(14,2) NOT NULL DEFAULT 0,
  receive_currency text NOT NULL DEFAULT 'HTG',
  agent_commission_send numeric(12,2) NOT NULL DEFAULT 0,
  amount_mxn numeric(12,2) DEFAULT 0,
  fee_mxn numeric(12,2) DEFAULT 0,
  total_mxn numeric(12,2) DEFAULT 0,
  amount_htg numeric(14,2) DEFAULT 0,
  agent_commission_mxn numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'awaiting_payment',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfers_select" ON public.transfers;
CREATE POLICY "transfers_select" ON public.transfers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "transfers_insert_own" ON public.transfers;
CREATE POLICY "transfers_insert_own" ON public.transfers FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "transfers_update_staff" ON public.transfers;
CREATE POLICY "transfers_update_staff" ON public.transfers FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) OR user_id = auth.uid())
WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.transfer_events TO authenticated;
GRANT ALL ON public.transfer_events TO service_role;
ALTER TABLE public.transfer_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select" ON public.transfer_events;
CREATE POLICY "events_select" ON public.transfer_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))));

-- 5. RECARGAS MÓVILES (Módulo Recargas, DingConnect y Reporte de Operadores)
CREATE TABLE IF NOT EXISTS public.topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('TOP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  sku_code text NOT NULL DEFAULT '',
  operator text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'HT',
  phone text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  pay_amount numeric NOT NULL,
  pay_currency text NOT NULL DEFAULT 'HTG',
  status text NOT NULL DEFAULT 'pending',
  status_detail text,
  provider text DEFAULT 'ding',
  provider_ref text,
  provider_response jsonb,
  refunded boolean DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.topups TO authenticated;
GRANT ALL ON public.topups TO service_role;
ALTER TABLE public.topups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topups_select" ON public.topups;
CREATE POLICY "topups_select" ON public.topups FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "topups_insert" ON public.topups;
CREATE POLICY "topups_insert" ON public.topups FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "topups_update_staff" ON public.topups;
CREATE POLICY "topups_update_staff" ON public.topups FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()));

-- Función admin_set_topup_status para cambiar estados y reembolsar
CREATE OR REPLACE FUNCTION public.admin_set_topup_status(_topup_id uuid, _status text, _detail text DEFAULT NULL)
RETURNS topups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.topups;
  _wallet public.wallets;
  _did_refund boolean := false;
BEGIN
  IF NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _status NOT IN ('pending','processing','completed','failed','refunded') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  SELECT * INTO _row FROM public.topups WHERE id = _topup_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Recarga no encontrada'; END IF;

  IF _status IN ('failed', 'refunded') AND NOT coalesce(_row.refunded, false) AND _row.wallet_id IS NOT NULL THEN
    SELECT * INTO _wallet FROM public.wallets WHERE id = _row.wallet_id FOR UPDATE;
    IF _wallet.id IS NOT NULL THEN
      UPDATE public.wallets
         SET balance = balance + coalesce(_row.pay_amount, _row.amount), updated_at = now()
       WHERE id = _wallet.id;
      _did_refund := true;
    END IF;
  END IF;

  UPDATE public.topups
     SET status = _status,
         status_detail = coalesce(_detail, status_detail),
         refunded = refunded OR _did_refund,
         updated_at = now()
   WHERE id = _topup_id
   RETURNING * INTO _row;

  RETURN _row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_topup_status(uuid, text, text) TO authenticated;

-- 6. TRANSACCIONES DE BILLETERA (Contabilidad)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'HTG',
  description text,
  reference text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_tx_select" ON public.wallet_transactions;
CREATE POLICY "wallet_tx_select" ON public.wallet_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 7. SOPORTE (Configuración de Atención al Cliente)
CREATE TABLE IF NOT EXISTS public.support_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL DEFAULT '',
  whatsapp_url text,
  email text NOT NULL DEFAULT '',
  email_subject text,
  support_hours text DEFAULT '24/7',
  timezone text DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_config TO authenticated, anon;
GRANT ALL ON public.support_config TO service_role;
ALTER TABLE public.support_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_config_select" ON public.support_config;
CREATE POLICY "support_config_select" ON public.support_config FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "support_config_update" ON public.support_config;
CREATE POLICY "support_config_update" ON public.support_config FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

INSERT INTO public.support_config (whatsapp_number, email, support_hours, timezone)
VALUES ('+509 0000 0000', 'soporte@lajanrapid.com', '24/7', 'America/Port-au-Prince')
ON CONFLICT DO NOTHING;

-- 8. SEGURIDAD Y AUDITORÍA
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  description text,
  metadata jsonb,
  user_id uuid,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_select" ON public.security_events;
CREATE POLICY "security_events_select" ON public.security_events FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- 9. TASAS DING (Topup Rates)
CREATE TABLE IF NOT EXISTS public.topup_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL DEFAULT 'USD',
  rate numeric(14,6) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topup_rates_pair_unique UNIQUE (from_currency, to_currency)
);

GRANT SELECT ON public.topup_rates TO authenticated, anon;
GRANT ALL ON public.topup_rates TO service_role;
ALTER TABLE public.topup_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topup_rates_read" ON public.topup_rates;
CREATE POLICY "topup_rates_read" ON public.topup_rates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "topup_rates_admin" ON public.topup_rates;
CREATE POLICY "topup_rates_admin" ON public.topup_rates FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Sembrado inicial de Tasas Ding
INSERT INTO public.topup_rates (from_currency, to_currency, rate, is_active) VALUES
  ('USD', 'USD', 1.00000, true),
  ('MXN', 'USD', 0.05920, true),
  ('EUR', 'USD', 1.17000, true),
  ('DOP', 'USD', 0.01670, true),
  ('CAD', 'USD', 0.72754, true),
  ('CLP', 'USD', 0.00108, true),
  ('BRL', 'USD', 0.19256, true),
  ('ARS', 'USD', 0.00067, true),
  ('COP', 'USD', 0.00033, true),
  ('GBP', 'USD', 1.36710, true)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- 10. CRIPTOMONEDAS (Activos, Depósitos y Retiros)
CREATE TABLE IF NOT EXISTS public.crypto_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  network text NOT NULL,
  name text NOT NULL,
  deposit_address text NOT NULL DEFAULT '',
  htg_rate numeric NOT NULL DEFAULT 0,
  min_deposit numeric NOT NULL DEFAULT 0,
  fee_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, network)
);

GRANT SELECT ON public.crypto_assets TO authenticated, anon;
GRANT ALL ON public.crypto_assets TO service_role;
ALTER TABLE public.crypto_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crypto_assets_read" ON public.crypto_assets;
CREATE POLICY "crypto_assets_read" ON public.crypto_assets FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "crypto_assets_admin" ON public.crypto_assets;
CREATE POLICY "crypto_assets_admin" ON public.crypto_assets FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Activos cripto iniciales
INSERT INTO public.crypto_assets (code, network, name, htg_rate, min_deposit, is_active) VALUES
  ('USDT', 'TRC20', 'Tether USD (TRC20)', 132.50, 5, true),
  ('USDT', 'ERC20', 'Tether USD (ERC20)', 132.50, 10, true),
  ('BTC', 'BITCOIN', 'Bitcoin', 12500000, 0.0005, true),
  ('ETH', 'ETHEREUM', 'Ethereum', 450000, 0.01, true)
ON CONFLICT (code, network) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crypto_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.crypto_assets(id),
  reference text NOT NULL DEFAULT ('CD-' || upper(substr(md5(random()::text), 1, 8))),
  amount_crypto numeric NOT NULL,
  tx_hash text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  amount_htg numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.crypto_deposits TO authenticated;
GRANT ALL ON public.crypto_deposits TO service_role;
ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crypto_deposits_select" ON public.crypto_deposits;
CREATE POLICY "crypto_deposits_select" ON public.crypto_deposits FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "crypto_deposits_insert" ON public.crypto_deposits;
CREATE POLICY "crypto_deposits_insert" ON public.crypto_deposits FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.crypto_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  asset_id uuid REFERENCES public.crypto_assets(id),
  reference text NOT NULL DEFAULT ('CW-' || upper(substr(md5(random()::text), 1, 8))),
  destination text NOT NULL,
  amount_htg numeric NOT NULL,
  amount_crypto numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  provider_ref text,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crypto_withdrawals TO authenticated;
GRANT ALL ON public.crypto_withdrawals TO service_role;
ALTER TABLE public.crypto_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crypto_withdrawals_select" ON public.crypto_withdrawals;
CREATE POLICY "crypto_withdrawals_select" ON public.crypto_withdrawals FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 11. TARIFAS DE REMESAS (Exchange Rates)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL DEFAULT 'USD',
  to_currency text NOT NULL DEFAULT 'HTG',
  rate numeric(14,6) NOT NULL,
  fee_percent numeric(6,3) NOT NULL DEFAULT 2.5,
  fee_fixed numeric(12,2) NOT NULL DEFAULT 0,
  agent_commission_percent numeric(6,3) NOT NULL DEFAULT 1.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exchange_rates TO anon, authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rates_select_public" ON public.exchange_rates;
CREATE POLICY "rates_select_public" ON public.exchange_rates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rates_admin" ON public.exchange_rates;
CREATE POLICY "rates_admin" ON public.exchange_rates FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Tasas iniciales de remesas
INSERT INTO public.exchange_rates (from_currency, to_currency, rate, fee_percent, fee_fixed) VALUES
  ('USD', 'HTG', 132.500000, 2.0, 0),
  ('MXN', 'HTG', 7.500000, 2.5, 20),
  ('DOP', 'HTG', 2.250000, 2.0, 0)
ON CONFLICT DO NOTHING;

-- 12. NOTIFICACIONES
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- 13. ACTUALIZAR CACHÉ DE POSTGREST
NOTIFY pgrst, 'reload schema';
