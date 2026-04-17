ALTER TABLE public.jobs DROP COLUMN logs;
ALTER TABLE public.jobs ADD COLUMN logs jsonb DEFAULT '[]'::jsonb;