-- ==============================================================================
-- MIGRACIÓN: ELIMINAR RESTRICCIÓN DE MONEDAS EN LA TABLA WALLETS
-- Proyecto: yyvaeapmmvoklofydcpl
-- Ejecutar en Supabase Dashboard -> SQL Editor -> Click 'Run'
-- ==============================================================================

-- 1. Eliminar el check constraint que bloqueaba monedas como MXN, CLP, CAD, EUR, etc.
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_currency_check;

-- 2. Asegurar que las billeteras de recargas nacionales y cualquier moneda ISO sea válida
-- Si en el futuro se desea un constraint, debe incluir todas las monedas y sufijos _RECARGAS:
-- ALTER TABLE public.wallets ADD CONSTRAINT wallets_currency_check 
--   CHECK (currency ~ '^[A-Z]{3}(_RECARGAS)?$');

-- 3. Actualizar función ensure_wallet para que soporte todas las monedas sin errores
CREATE OR REPLACE FUNCTION public.ensure_wallet(_currency text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  INSERT INTO public.wallets (user_id, currency, balance, status)
  VALUES (_uid, _currency, 0, 'active')
  ON CONFLICT (user_id, currency) DO UPDATE SET updated_at = now();

  RETURN _currency;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(text) TO authenticated, service_role;
