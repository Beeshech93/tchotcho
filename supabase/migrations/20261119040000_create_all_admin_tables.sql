-- ==============================================================================
-- TABLAS Y POLÍTICAS COMPLETAS PARA TODOS LOS MÓDULOS DE ADMINISTRACIÓN
-- Incluye: Tarifas (exchange_rates), Tasas Ding (topup_rates), Cripto, KYC,
-- Transacciones, Recargas, Soporte, Seguridad y Notificaciones.
-- Proyecto: yyvaeapmmvoklofydcpl
-- ==============================================================================

-- 1. TABLA: TARIFAS POR CORREDOR (exchange_rates) - Pestaña Tarifas
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL DEFAULT 'USD',
  to_currency text NOT NULL DEFAULT 'HTG',
  rate numeric(14,6) NOT NULL DEFAULT 1,
  fee_percent numeric(6,3) NOT NULL DEFAULT 2.5,
  fee_fixed numeric(12,2) NOT NULL DEFAULT 0,
  agent_commission_percent numeric(6,3) NOT NULL DEFAULT 1.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exchange_rates_pair_unique UNIQUE (from_currency, to_currency)
);

GRANT ALL ON public.exchange_rates TO authenticated, service_role;
GRANT SELECT ON public.exchange_rates TO anon;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rates_select_public" ON public.exchange_rates;
CREATE POLICY "rates_select_public" ON public.exchange_rates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rates_admin_all" ON public.exchange_rates;
CREATE POLICY "rates_admin_all" ON public.exchange_rates FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Tasas iniciales de remesas
INSERT INTO public.exchange_rates (from_currency, to_currency, rate, fee_percent, fee_fixed, agent_commission_percent) VALUES
  ('USD', 'HTG', 132.500000, 2.0, 0, 0.8),
  ('MXN', 'HTG', 7.200000, 1.0, 1, 0.8),
  ('DOP', 'HTG', 2.250000, 2.0, 0, 0.8)
ON CONFLICT (from_currency, to_currency) DO UPDATE
SET rate = EXCLUDED.rate, fee_percent = EXCLUDED.fee_percent, fee_fixed = EXCLUDED.fee_fixed, agent_commission_percent = EXCLUDED.agent_commission_percent;

-- 2. TABLA: TASAS DING (topup_rates) - Pestaña Tasas Ding
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

GRANT ALL ON public.topup_rates TO authenticated, service_role;
GRANT SELECT ON public.topup_rates TO anon;
ALTER TABLE public.topup_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topup_rates_read" ON public.topup_rates;
CREATE POLICY "topup_rates_read" ON public.topup_rates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "topup_rates_admin_all" ON public.topup_rates;
CREATE POLICY "topup_rates_admin_all" ON public.topup_rates FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.topup_rates (from_currency, to_currency, rate, is_active) VALUES
  ('USD', 'USD', 1.00000, true),
  ('MXN', 'USD', 0.05920, true),
  ('EUR', 'USD', 1.17000, true),
  ('DOP', 'USD', 0.01670, true),
  ('CAD', 'USD', 0.72754, true)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- 3. TABLA: CRIPTOMONEDAS (crypto_assets, crypto_deposits, crypto_withdrawals)
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

GRANT ALL ON public.crypto_assets TO authenticated, service_role;
GRANT SELECT ON public.crypto_assets TO anon;
ALTER TABLE public.crypto_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crypto_assets_read" ON public.crypto_assets;
CREATE POLICY "crypto_assets_read" ON public.crypto_assets FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "crypto_assets_admin_all" ON public.crypto_assets;
CREATE POLICY "crypto_assets_admin_all" ON public.crypto_assets FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

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

GRANT ALL ON public.crypto_deposits TO authenticated, service_role;
ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crypto_deposits_all" ON public.crypto_deposits;
CREATE POLICY "crypto_deposits_all" ON public.crypto_deposits FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

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

GRANT ALL ON public.crypto_withdrawals TO authenticated, service_role;
ALTER TABLE public.crypto_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crypto_withdrawals_all" ON public.crypto_withdrawals;
CREATE POLICY "crypto_withdrawals_all" ON public.crypto_withdrawals FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 4. TABLA: KYC SUBMISSIONS (kyc_submissions) - Pestaña KYC
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

GRANT ALL ON public.kyc_submissions TO authenticated, service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_submissions_all" ON public.kyc_submissions;
CREATE POLICY "kyc_submissions_all" ON public.kyc_submissions FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 5. TABLA: TRANSFERENCIAS Y EVENTOS (transfers, transfer_events) - Pestaña Transacciones
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

GRANT ALL ON public.transfers TO authenticated, service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfers_all" ON public.transfers;
CREATE POLICY "transfers_all" ON public.transfers FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.transfer_events TO authenticated, service_role;
ALTER TABLE public.transfer_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfer_events_all" ON public.transfer_events;
CREATE POLICY "transfer_events_all" ON public.transfer_events FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 6. TABLA: RECARGAS MÓVILES (topups) - Pestaña Recargas
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

GRANT ALL ON public.topups TO authenticated, service_role;
ALTER TABLE public.topups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topups_all" ON public.topups;
CREATE POLICY "topups_all" ON public.topups FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 7. TABLA: CONTABILIDAD / MOVIMIENTOS (wallet_transactions) - Pestaña Contabilidad
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

GRANT ALL ON public.wallet_transactions TO authenticated, service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_tx_all" ON public.wallet_transactions;
CREATE POLICY "wallet_tx_all" ON public.wallet_transactions FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 8. TABLA: SOPORTE (support_config) - Pestaña Soporte
CREATE TABLE IF NOT EXISTS public.support_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL DEFAULT '+509 0000 0000',
  whatsapp_url text,
  email text NOT NULL DEFAULT 'soporte@lajanrapid.com',
  email_subject text,
  support_hours text DEFAULT '24/7',
  timezone text DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.support_config TO authenticated, service_role;
GRANT SELECT ON public.support_config TO anon;
ALTER TABLE public.support_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_config_read" ON public.support_config;
CREATE POLICY "support_config_read" ON public.support_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "support_config_admin_all" ON public.support_config;
CREATE POLICY "support_config_admin_all" ON public.support_config FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.support_config (whatsapp_number, email, support_hours, timezone)
VALUES ('+509 0000 0000', 'soporte@lajanrapid.com', '24/7', 'America/Port-au-Prince')
ON CONFLICT DO NOTHING;

-- 9. TABLA: SEGURIDAD (security_events) - Pestaña Seguridad
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

GRANT ALL ON public.security_events TO authenticated, service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_all" ON public.security_events;
CREATE POLICY "security_events_all" ON public.security_events FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 10. TABLA: NOTIFICACIONES (notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.notifications TO authenticated, service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
CREATE POLICY "notifications_all" ON public.notifications FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 11. RECARGAR EL CACHÉ DE POSTGREST
NOTIFY pgrst, 'reload schema';
