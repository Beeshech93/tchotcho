-- Migración: Funciones de seguridad para lectura y escritura de integration_credentials
-- Permite que administradores y funciones del servidor accedan a las credenciales operativas de integraciones (Bazik, Ding, etc.)

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

GRANT EXECUTE ON FUNCTION public.get_integration_credentials(text[]) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.set_integration_credential(text, text, uuid) TO authenticated, service_role, anon;
