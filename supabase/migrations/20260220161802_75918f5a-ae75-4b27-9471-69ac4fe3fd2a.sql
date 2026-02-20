
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'employee');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  position TEXT,
  salary NUMERIC(12,2),
  joining_date DATE,
  avatar_url TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'casual', 'annual')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notices table
CREATE TABLE public.notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_department TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave', 'half_day')),
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Create salary_records table
CREATE TABLE public.salary_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create general_requests table
CREATE TABLE public.general_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  owner_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function: is_owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner')
$$;

-- Trigger for profile auto-creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_requests ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Owners can do everything with profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- USER_ROLES policies
CREATE POLICY "Owners can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- LEAVE_REQUESTS policies
CREATE POLICY "Owners can manage all leave requests" ON public.leave_requests
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Employees can view own leave requests" ON public.leave_requests
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);

CREATE POLICY "Employees can create own leave requests" ON public.leave_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Employees can update own pending leave requests" ON public.leave_requests
  FOR UPDATE TO authenticated USING (auth.uid() = employee_id AND status = 'pending');

-- NOTICES policies
CREATE POLICY "Anyone authenticated can view notices" ON public.notices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage notices" ON public.notices
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

-- ATTENDANCE policies
CREATE POLICY "Owners can manage all attendance" ON public.attendance
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Employees can view own attendance" ON public.attendance
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);

-- SALARY_RECORDS policies
CREATE POLICY "Owners can manage all salary records" ON public.salary_records
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Employees can view own salary records" ON public.salary_records
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);

-- TASKS policies
CREATE POLICY "Owners can manage all tasks" ON public.tasks
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Employees can view own tasks" ON public.tasks
  FOR SELECT TO authenticated USING (auth.uid() = assigned_to);

CREATE POLICY "Employees can update own tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (auth.uid() = assigned_to);

-- GENERAL_REQUESTS policies
CREATE POLICY "Owners can manage all general requests" ON public.general_requests
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Employees can view own requests" ON public.general_requests
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);

CREATE POLICY "Employees can create own requests" ON public.general_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Employees can update own requests" ON public.general_requests
  FOR UPDATE TO authenticated USING (auth.uid() = employee_id);
