import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/shared/StatCard";
import { Users, UserCheck, CalendarDays, Building } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function OwnerDashboard() {
  const [stats, setStats] = useState({ employees: 0, presentToday: 0, pendingLeaves: 0, departments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [empRes, attRes, leaveRes, deptRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", new Date().toISOString().split("T")[0]).eq("status", "present"),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("department").eq("is_active", true),
      ]);
      const uniqueDepts = new Set(deptRes.data?.map((p) => p.department).filter(Boolean));
      setStats({
        employees: empRes.count || 0,
        presentToday: attRes.count || 0,
        pendingLeaves: leaveRes.count || 0,
        departments: uniqueDepts.size,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-display">Owner Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Owner Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Employees" value={stats.employees} icon={Users} />
        <StatCard title="Present Today" value={stats.presentToday} icon={UserCheck} />
        <StatCard title="Pending Leave Requests" value={stats.pendingLeaves} icon={CalendarDays} />
        <StatCard title="Departments" value={stats.departments} icon={Building} />
      </div>
    </div>
  );
}
