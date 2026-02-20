import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/shared/StatCard";
import { Users, UserCheck, CalendarDays, Building, Shield, ListTodo, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0, owners: 0, employees: 0, presentToday: 0,
    pendingLeaves: 0, departments: 0, activeTasks: 0, pendingRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [profilesRes, rolesRes, attRes, leaveRes, deptRes, taskRes, reqRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", new Date().toISOString().split("T")[0]).eq("status", "present"),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("department").eq("is_active", true),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("general_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const owners = rolesRes.data?.filter(r => r.role === "owner").length || 0;
      const employees = rolesRes.data?.filter(r => r.role === "employee").length || 0;
      const uniqueDepts = new Set(deptRes.data?.map(p => p.department).filter(Boolean));
      setStats({
        totalUsers: profilesRes.count || 0, owners, employees,
        presentToday: attRes.count || 0, pendingLeaves: leaveRes.count || 0,
        departments: uniqueDepts.size, activeTasks: taskRes.count || 0,
        pendingRequests: reqRes.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Super Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Super Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Full system overview and control</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} />
        <StatCard title="Owners" value={stats.owners} icon={Shield} />
        <StatCard title="Employees" value={stats.employees} icon={UserCheck} />
        <StatCard title="Present Today" value={stats.presentToday} icon={UserCheck} />
        <StatCard title="Pending Leaves" value={stats.pendingLeaves} icon={CalendarDays} />
        <StatCard title="Active Tasks" value={stats.activeTasks} icon={ListTodo} />
        <StatCard title="Pending Requests" value={stats.pendingRequests} icon={MessageSquare} />
        <StatCard title="Departments" value={stats.departments} icon={Building} />
      </div>
    </div>
  );
}
