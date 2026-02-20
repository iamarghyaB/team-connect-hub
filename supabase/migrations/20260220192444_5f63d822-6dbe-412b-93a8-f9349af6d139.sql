
-- 1. Add stage/review columns to salary_records
ALTER TABLE public.salary_records 
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_extra_total numeric NOT NULL DEFAULT 0;

-- 2. salary_adjustments table
CREATE TABLE public.salary_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  type text NOT NULL CHECK (type IN ('bonus', 'deduction')),
  amount numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage salary adjustments" ON public.salary_adjustments FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage salary adjustments" ON public.salary_adjustments FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Employees can view own adjustments" ON public.salary_adjustments FOR SELECT USING (auth.uid() = employee_id);

-- 3. attendance_edits_log table
CREATE TABLE public.attendance_edits_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  date date NOT NULL,
  original_status text NOT NULL,
  new_status text NOT NULL,
  changed_by uuid NOT NULL,
  reason text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_edits_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage attendance edits log" ON public.attendance_edits_log FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage attendance edits log" ON public.attendance_edits_log FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Employees can view own attendance edits" ON public.attendance_edits_log FOR SELECT USING (auth.uid() = employee_id);

-- 4. salary_audit_log table
CREATE TABLE public.salary_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id uuid,
  employee_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  action text NOT NULL,
  old_value text,
  new_value text,
  done_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage salary audit log" ON public.salary_audit_log FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage salary audit log" ON public.salary_audit_log FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Employees can view own audit log" ON public.salary_audit_log FOR SELECT USING (auth.uid() = employee_id);

-- 5. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_adjustments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_edits_log;

-- 6. Update existing salary_records that are paid to 'paid' stage
UPDATE public.salary_records SET stage = 'paid' WHERE is_paid = true;
UPDATE public.salary_records SET stage = 'calculated' WHERE is_paid = false AND stage = 'draft';
