-- Migración para asegurar que todos los usuarios tengan su cuenta/billetera en la moneda correspondiente a su país y número de teléfono

CREATE OR REPLACE FUNCTION public.get_currency_for_country_and_phone(p_country text, p_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_c text := upper(trim(COALESCE(p_country, '')));
  v_p text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  -- 1. Si el código de país está definido
  IF v_c = 'DO' THEN RETURN 'DOP';
  ELSIF v_c = 'MX' THEN RETURN 'MXN';
  ELSIF v_c = 'US' THEN RETURN 'USD';
  ELSIF v_c = 'CA' THEN RETURN 'CAD';
  ELSIF v_c = 'CL' THEN RETURN 'CLP';
  ELSIF v_c = 'BR' THEN RETURN 'BRL';
  ELSIF v_c = 'CO' THEN RETURN 'COP';
  ELSIF v_c = 'AR' THEN RETURN 'ARS';
  ELSIF v_c = 'PE' THEN RETURN 'PEN';
  ELSIF v_c = 'CR' THEN RETURN 'CRC';
  ELSIF v_c = 'GT' THEN RETURN 'GTQ';
  ELSIF v_c = 'HN' THEN RETURN 'HNL';
  ELSIF v_c = 'NI' THEN RETURN 'NIO';
  ELSIF v_c IN ('SV', 'PA', 'EC') THEN RETURN 'USD';
  ELSIF v_c IN ('ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE') THEN RETURN 'EUR';
  ELSIF v_c = 'GB' THEN RETURN 'GBP';
  ELSIF v_c = 'CH' THEN RETURN 'CHF';
  ELSIF v_c = 'HT' THEN RETURN 'HTG';
  END IF;

  -- 2. Deducir por prefijo de número de teléfono
  IF v_p LIKE '509%' THEN RETURN 'HTG';
  ELSIF v_p LIKE '1809%' OR v_p LIKE '1829%' OR v_p LIKE '1849%' THEN RETURN 'DOP';
  ELSIF v_p LIKE '52%' THEN RETURN 'MXN';
  ELSIF v_p LIKE '56%' THEN RETURN 'CLP';
  ELSIF v_p LIKE '55%' THEN RETURN 'BRL';
  ELSIF v_p LIKE '57%' THEN RETURN 'COP';
  ELSIF v_p LIKE '54%' THEN RETURN 'ARS';
  ELSIF v_p LIKE '51%' THEN RETURN 'PEN';
  ELSIF v_p LIKE '506%' THEN RETURN 'CRC';
  ELSIF v_p LIKE '502%' THEN RETURN 'GTQ';
  ELSIF v_p LIKE '504%' THEN RETURN 'HNL';
  ELSIF v_p LIKE '505%' THEN RETURN 'NIO';
  ELSIF v_p LIKE '34%' OR v_p LIKE '33%' OR v_p LIKE '49%' OR v_p LIKE '39%' THEN RETURN 'EUR';
  ELSIF v_p LIKE '44%' THEN RETURN 'GBP';
  ELSIF v_p LIKE '1%' THEN
    IF v_c = 'DO' THEN RETURN 'DOP';
    ELSIF v_c = 'CA' THEN RETURN 'CAD';
    ELSE RETURN 'USD';
    END IF;
  END IF;

  RETURN 'HTG';
END;
$$;

-- Actualizar handle_new_user para crear la billetera en la moneda correspondiente al país del número de teléfono
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_country text;
  v_phone text;
  v_currency text;
BEGIN
  v_country := upper(trim(COALESCE(NEW.raw_user_meta_data->>'country', '')));
  v_phone := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''), '\D', '', 'g');

  v_currency := public.get_currency_for_country_and_phone(v_country, v_phone);

  -- 1. Crear perfil con país y teléfono
  INSERT INTO public.profiles (id, full_name, phone, country, kyc_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    COALESCE(NULLIF(v_country, ''), 'HT'),
    'none'
  )
  ON CONFLICT (id) DO UPDATE
  SET country = COALESCE(NULLIF(EXCLUDED.country, ''), profiles.country),
      phone = COALESCE(EXCLUDED.phone, profiles.phone);

  -- 2. Crear billetera principal en la moneda de su país/teléfono
  INSERT INTO public.wallets (user_id, currency, balance, status)
  VALUES (NEW.id, v_currency, 0, 'active')
  ON CONFLICT (user_id, currency) DO NOTHING;

  -- Si su moneda no es HTG, también asegurar HTG por compatibilidad con remesas
  IF v_currency != 'HTG' THEN
    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (NEW.id, 'HTG', 0, 'active')
    ON CONFLICT (user_id, currency) DO NOTHING;
  END IF;

  -- 3. Asignar rol estándar de cliente ('client'), salvo si es la cuenta maestra
  IF lower(COALESCE(NEW.email, '')) = 'lajanrapid26@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- 4. Backfill para todos los usuarios existentes: asegurar que tengan creada su billetera en la moneda de su país
DO $$
DECLARE
  v_u RECORD;
  v_cur text;
BEGIN
  FOR v_u IN 
    SELECT u.id, 
           COALESCE(p.country, u.raw_user_meta_data->>'country', '') AS country,
           COALESCE(p.phone, u.raw_user_meta_data->>'phone', u.phone, '') AS phone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
  LOOP
    v_cur := public.get_currency_for_country_and_phone(v_u.country, v_u.phone);
    INSERT INTO public.wallets (user_id, currency, balance, status)
    VALUES (v_u.id, v_cur, 0, 'active')
    ON CONFLICT (user_id, currency) DO NOTHING;
  END LOOP;
END $$;
