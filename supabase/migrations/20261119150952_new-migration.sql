-- ==============================================================================
-- MIGRACIÓN COMPLETA PARA TCHO-TCHO
-- Tablas, permisos, visibilidad de usuarios y configuración de Super Admins
-- ==============================================================================

-- 1. WALLETS & PROFILES
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'HT';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es';

-- 2. INTEGRATION CREDENTIALS
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.integration_credentials TO authenticated, service_role;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_credentials_staff_all" ON public.integration_credentials;
CREATE POLICY "integration_credentials_staff_all" ON public.integration_credentials
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

-- 3. TARIFAS POR CORREDOR (exchange_rates) - Pestaña Tarifas
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

INSERT INTO public.exchange_rates (from_currency, to_currency, rate, fee_percent, fee_fixed, agent_commission_percent) VALUES
  ('USD', 'HTG', 132.500000, 2.0, 0, 0.8),
  ('MXN', 'HTG', 7.200000, 1.0, 1, 0.8),
  ('DOP', 'HTG', 2.250000, 2.0, 0, 0.8)
ON CONFLICT (from_currency, to_currency) DO UPDATE
SET rate = EXCLUDED.rate, fee_percent = EXCLUDED.fee_percent, fee_fixed = EXCLUDED.fee_fixed, agent_commission_percent = EXCLUDED.agent_commission_percent;

-- 4. TASAS DING (topup_rates) - Pestaña Tasas Ding
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

-- 5. CRIPTOMONEDAS
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

-- 6. KYC SUBMISSIONS
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

-- 7. TRANSACCIONES Y EVENTOS
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

-- 8. RECARGAS MÓVILES (topups)
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

-- 9. CONTABILIDAD (wallet_transactions)
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

-- 10. SOPORTE (support_config)
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

-- 11. SEGURIDAD (security_events)
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

-- 12. NOTIFICACIONES
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

-- 13. FUNCIÓN IS_STAFF
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

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND (
      lower(COALESCE(email, '')) IN (
        'lajanrapid26@gmail.com',
        'charlesagency4@gmail.com',
        'beeshecharles@gmail.com'
      )
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

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role::text IN ('agent', 'admin', 'super_admin')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon, service_role;

-- 14. FUNCIÓN HAS_ROLE
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
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

  IF _role = 'admin' AND public.is_staff(_user_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role::text = _role
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon, service_role;

-- 15. FUNCIÓN ADMIN_GET_ALL_USERS
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
  balance_htg numeric
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
      WHEN public.is_staff(u.id) THEN 
        ARRAY['admin'::text] || ARRAY(SELECT DISTINCT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role::text != 'admin')
      ELSE 
        COALESCE(
          (SELECT array_agg(DISTINCT ur.role::text) FROM public.user_roles ur WHERE ur.user_id = u.id),
          ARRAY['client']::text[]
        )
    END AS roles,
    COALESCE(
      (SELECT w.balance FROM public.wallets w WHERE w.user_id = u.id AND w.currency = 'HTG' LIMIT 1),
      0
    )::numeric AS balance_htg
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated, anon, service_role;

-- 16. SINCRONIZAR PROFILES, ROLES, CREDENCIALES Y WALLETS
DO $$
DECLARE
  v_rec RECORD;
  v_perms text := '{"isSuperAdmin":true,"allowedTabs":["resumen","servicios","contabilidad","soporte","banner","mercadopago","stripe","resend","bulk-email","security","operators","topup-rates","dingconnect","cripto","bazik","kyc","tx","recargas","usuarios","tarifas","migracion"]}';
BEGIN
  FOR v_rec IN 
    SELECT id, email, phone, raw_user_meta_data FROM auth.users 
    WHERE lower(COALESCE(email, '')) IN ('lajanrapid26@gmail.com', 'charlesagency4@gmail.com', 'beeshecharles@gmail.com')
       OR COALESCE(phone, '') IN ('529988100395', '+529988100395')
       OR id IN (
         'cca63804-b4c1-4221-bbd3-82258545f228'::uuid,
         '9b729a8e-b91c-430a-907c-969652b89f3b'::uuid,
         '0a1fec01-21c2-4af6-8e54-4b7ce6e2913c'::uuid
       )
  LOOP
    INSERT INTO public.profiles (id, full_name, email, phone, kyc_status, country, language)
    VALUES (
      v_rec.id,
      COALESCE(v_rec.raw_user_meta_data->>'full_name', split_part(COALESCE(v_rec.email, ''), '@', 1), 'Administrador'),
      v_rec.email,
      COALESCE(v_rec.raw_user_meta_data->>'phone', v_rec.phone),
      'approved',
      'HT',
      'es'
    )
    ON CONFLICT (id) DO UPDATE
    SET kyc_status = 'approved',
        email = COALESCE(EXCLUDED.email, profiles.email),
        phone = COALESCE(EXCLUDED.phone, profiles.phone);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_rec.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.integration_credentials (name, value, updated_at)
    VALUES ('ADMIN_PERMISSIONS_' || v_rec.id, v_perms, now())
    ON CONFLICT (name) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();

    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (v_rec.id, 'HTG', 0, 'active')
    ON CONFLICT (user_id, currency) DO NOTHING;

    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (v_rec.id, 'USD', 0, 'active')
    ON CONFLICT (user_id, currency) DO NOTHING;
  END LOOP;
END $$;

-- 17. RECARGAR SCHEMA POSTGREST
NOTIFY pgrst, 'reload schema';
