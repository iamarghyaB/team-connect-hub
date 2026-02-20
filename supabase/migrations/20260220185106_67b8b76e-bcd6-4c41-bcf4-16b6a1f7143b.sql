
-- Add note column to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS note text;

-- Add new columns to salary_records for attendance-based calculation
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS base_salary numeric;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS total_working_days integer NOT NULL DEFAULT 26;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS present_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS absent_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS leave_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS half_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS per_day_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS present_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS half_day_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS leave_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS deduction_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS final_salary numeric NOT NULL DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS generated_at timestamp with time zone DEFAULT now();

-- Rename existing 'amount' usage: final_salary will be used instead, but keep amount for backward compat
