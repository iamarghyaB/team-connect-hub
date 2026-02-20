
-- Work Plan Templates
CREATE TABLE public.work_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  template_name text NOT NULL,
  department text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage templates" ON public.work_plan_templates FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage templates" ON public.work_plan_templates FOR ALL USING (is_super_admin(auth.uid()));

-- Template Tasks
CREATE TABLE public.template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.work_plan_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  expected_duration_minutes integer DEFAULT 60,
  priority text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'other',
  is_mandatory boolean NOT NULL DEFAULT false,
  repeat_type text NOT NULL DEFAULT 'daily',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.template_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage template tasks" ON public.template_tasks FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage template tasks" ON public.template_tasks FOR ALL USING (is_super_admin(auth.uid()));

-- Daily Work Plans (assignment of a template to an employee for a date)
CREATE TABLE public.daily_work_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  template_id uuid REFERENCES public.work_plan_templates(id) ON DELETE SET NULL,
  plan_date date NOT NULL,
  assigned_by uuid NOT NULL,
  note_from_owner text,
  status text NOT NULL DEFAULT 'active',
  total_tasks integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  completion_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, plan_date)
);
ALTER TABLE public.daily_work_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage all plans" ON public.daily_work_plans FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage all plans" ON public.daily_work_plans FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Employees can view own plans" ON public.daily_work_plans FOR SELECT USING (auth.uid() = employee_id);
CREATE POLICY "Employees can update own plans" ON public.daily_work_plans FOR UPDATE USING (auth.uid() = employee_id);

-- Daily Tasks (individual tasks within a plan)
CREATE TABLE public.daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.daily_work_plans(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'other',
  is_mandatory boolean NOT NULL DEFAULT false,
  expected_duration_minutes integer DEFAULT 60,
  deadline_time time,
  status text NOT NULL DEFAULT 'not_started',
  employee_note text,
  stuck_reason text,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  actual_duration_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage all daily tasks" ON public.daily_tasks FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage all daily tasks" ON public.daily_tasks FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Employees can view own tasks" ON public.daily_tasks FOR SELECT USING (auth.uid() = employee_id);
CREATE POLICY "Employees can update own tasks" ON public.daily_tasks FOR UPDATE USING (auth.uid() = employee_id);

-- Task Activity Log
CREATE TABLE public.task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage activity log" ON public.task_activity_log FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage activity log" ON public.task_activity_log FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Employees can view own activity" ON public.task_activity_log FOR SELECT USING (auth.uid() = employee_id);
CREATE POLICY "Employees can insert own activity" ON public.task_activity_log FOR INSERT WITH CHECK (auth.uid() = employee_id);

-- Daily Reports
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  report_date date NOT NULL,
  plan_id uuid REFERENCES public.daily_work_plans(id) ON DELETE SET NULL,
  tasks_completed integer NOT NULL DEFAULT 0,
  tasks_total integer NOT NULL DEFAULT 0,
  completion_percentage numeric NOT NULL DEFAULT 0,
  employee_notes text,
  blockers_for_tomorrow text,
  submitted_at timestamptz,
  owner_feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, report_date)
);
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage all reports" ON public.daily_reports FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage all reports" ON public.daily_reports FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Employees can view own reports" ON public.daily_reports FOR SELECT USING (auth.uid() = employee_id);
CREATE POLICY "Employees can insert own reports" ON public.daily_reports FOR INSERT WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Employees can update own unlocked reports" ON public.daily_reports FOR UPDATE USING (auth.uid() = employee_id AND is_locked = false);

-- Personal Tasks (private to employee)
CREATE TABLE public.personal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'not_started',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can manage own personal tasks" ON public.personal_tasks FOR ALL USING (auth.uid() = employee_id);

-- Recurring Schedule
CREATE TABLE public.recurring_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  template_id uuid NOT NULL REFERENCES public.work_plan_templates(id) ON DELETE CASCADE,
  department text,
  assigned_to_all boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage recurring schedule" ON public.recurring_schedule FOR ALL USING (is_owner(auth.uid()));
CREATE POLICY "Super admins can manage recurring schedule" ON public.recurring_schedule FOR ALL USING (is_super_admin(auth.uid()));

-- Enable realtime for daily_tasks and daily_work_plans
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_work_plans;
