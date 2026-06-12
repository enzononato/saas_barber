-- Foto da unidade exibida no popup do mapa na vitrine pública.
-- Guarda uma URL http(s) OU um data URL base64 (upload comprimido no cliente).
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "photo_url" text;
