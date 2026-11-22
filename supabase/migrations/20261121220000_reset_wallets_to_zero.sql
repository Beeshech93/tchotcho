-- Migración: Restablecer todas las billeteras a 0.00 HTG y desacoplar sincronización con Bazik
-- Bazik opera como pasarela externa de pagos a MonCash/NatCash de forma independiente.

UPDATE public.wallets
SET balance = 0,
    updated_at = now();

DELETE FROM public.integration_credentials
WHERE name IN ('BAZIK_LAST_SYNCED_BALANCE', 'BAZIK_LAST_SYNCED_AT');

INSERT INTO public.integration_credentials (name, value, updated_at)
VALUES ('WALLETS_RESET_ZERO_20261121', now()::text, now())
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
