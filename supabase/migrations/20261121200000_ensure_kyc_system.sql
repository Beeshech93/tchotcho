-- 20261121200000_ensure_kyc_system.sql
-- Garantiza la infraestructura completa para verificación de identidad (KYC):
-- 1. Bucket privado 'kyc-documents' con límites de tamaño y políticas RLS correctas.
-- 2. Tabla 'kyc_submissions' con columnas completas y acceso para el usuario y staff.
-- 3. Trigger en 'profiles' para permitir que el cliente pase a 'pending' al enviar su KYC.

-- 1. Storage bucket privado para documentos KYC
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kyc-documents', 'kyc-documents', false, 15728640)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 15728640;

-- Políticas de Storage
DROP POLICY IF EXISTS "kyc_docs_insert_own" ON storage.objects;
CREATE POLICY "kyc_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid()))
);

DROP POLICY IF EXISTS "kyc_docs_select_own_or_staff" ON storage.objects;
CREATE POLICY "kyc_docs_select_own_or_staff" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text 
    OR public.is_staff(auth.uid())
  )
);

-- 2. Tabla kyc_submissions
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

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS document_photo_path text;
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS document_back_path text;
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS review_notes text;
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT ALL ON public.kyc_submissions TO authenticated, service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_submissions_all" ON public.kyc_submissions;
CREATE POLICY "kyc_submissions_all" ON public.kyc_submissions FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- 3. Trigger para proteger kyc_status en profiles pero permitir al cliente enviar su solicitud (pasar a 'pending')
CREATE OR REPLACE FUNCTION public.protect_kyc_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NOT public.is_staff(auth.uid()) THEN
    -- El usuario común solo puede transicionar a 'pending' al enviar su KYC
    IF NEW.kyc_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'No autorizado para cambiar el estado de verificación (KYC)' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_kyc_status_trigger ON public.profiles;
CREATE TRIGGER protect_kyc_status_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_kyc_status();
