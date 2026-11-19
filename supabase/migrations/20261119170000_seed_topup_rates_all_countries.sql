-- ==============================================================================
-- MIGRACIÓN: SEMBRAR TASAS DINGCONNECT PARA TODOS LOS 15 PAÍSES
-- ==============================================================================

-- Asegurar tabla y constraint único
CREATE TABLE IF NOT EXISTS public.topup_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL DEFAULT 'USD',
  to_currency text NOT NULL DEFAULT 'HTG',
  rate numeric(14,6) NOT NULL DEFAULT 1,
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

-- Insertar todas las combinaciones de tasas para DingConnect hacia HTG, DOP y USD
INSERT INTO public.topup_rates (from_currency, to_currency, rate, is_active) VALUES
  -- Hacia Haití (HTG)
  ('USD', 'HTG', 132.500000, true),
  ('MXN', 'HTG', 7.200000, true),
  ('CAD', 'HTG', 95.500000, true),
  ('CLP', 'HTG', 0.140000, true),
  ('BRL', 'HTG', 23.500000, true),
  ('DOP', 'HTG', 2.250000, true),
  ('ARS', 'HTG', 0.130000, true),
  ('COP', 'HTG', 0.031500, true),
  ('PEN', 'HTG', 35.800000, true),
  ('CRC', 'HTG', 0.255000, true),
  ('GTQ', 'HTG', 17.100000, true),
  ('EUR', 'HTG', 142.500000, true),
  ('GBP', 'HTG', 168.000000, true),
  ('CHF', 'HTG', 151.000000, true),

  -- Hacia Rep. Dominicana (DOP)
  ('USD', 'DOP', 59.000000, true),
  ('MXN', 'DOP', 3.200000, true),
  ('CAD', 'DOP', 42.500000, true),
  ('EUR', 'DOP', 63.500000, true),
  ('HTG', 'DOP', 0.444000, true),

  -- Hacia Estados Unidos / Operadores en USD
  ('USD', 'USD', 1.000000, true),
  ('MXN', 'USD', 0.054300, true),
  ('CAD', 'USD', 0.720000, true),
  ('EUR', 'USD', 1.075000, true),
  ('HTG', 'USD', 0.007550, true)
ON CONFLICT (from_currency, to_currency) DO UPDATE
SET rate = EXCLUDED.rate, is_active = true, updated_at = now();
