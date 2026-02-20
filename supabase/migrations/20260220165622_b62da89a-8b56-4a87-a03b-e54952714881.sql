
-- Add foreign keys to tables (for PostgREST joins)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leave_requests_employee_id_fkey') THEN
    ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leave_requests_reviewed_by_fkey') THEN
    ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_employee_id_fkey') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_marked_by_fkey') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'salary_records_employee_id_fkey') THEN
    ALTER TABLE public.salary_records ADD CONSTRAINT salary_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_assigned_to_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_assigned_by_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'general_requests_employee_id_fkey') THEN
    ALTER TABLE public.general_requests ADD CONSTRAINT general_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notices_posted_by_fkey') THEN
    ALTER TABLE public.notices ADD CONSTRAINT notices_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_user_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Add unique constraints for upserts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_employee_date_unique') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_employee_date_unique UNIQUE (employee_id, date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'salary_records_employee_month_year_unique') THEN
    ALTER TABLE public.salary_records ADD CONSTRAINT salary_records_employee_month_year_unique UNIQUE (employee_id, month, year);
  END IF;
END$$;

-- Create is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

-- RLS policies for super_admin on all tables
CREATE POLICY "Super admins can do everything with profiles" ON public.profiles FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage all leave requests" ON public.leave_requests FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage notices" ON public.notices FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage all attendance" ON public.attendance FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage all salary records" ON public.salary_records FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage all tasks" ON public.tasks FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage all general requests" ON public.general_requests FOR ALL USING (is_super_admin(auth.uid()));

-- Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'employee')
  );
  
  RETURN NEW;
END;
$$;
