import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import StatCard from "@/components/shared/StatCard";
import { CalendarDays, ListTodo, Megaphone, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pendingLeaves: 0, activeTasks: 0, notices: 0, presentDays: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [leavesRes, tasksRes, noticesRes, attRes] = await Promise.all([
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", user.id).eq("status", "pending"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", user.id).neq("status", "completed"),
        supabase.from("notices").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("employee_id", user.id).eq("status", "present"),
      ]);
      setStats({
        pendingLeaves: leavesRes.count || 0,
        activeTasks: tasksRes.count || 0,
        notices: noticesRes.count || 0,
        presentDays: attRes.count || 0,
      });
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pending Leaves" value={stats.pendingLeaves} icon={CalendarDays} />
        <StatCard title="Active Tasks" value={stats.activeTasks} icon={ListTodo} />
        <StatCard title="Notices" value={stats.notices} icon={Megaphone} />
        <StatCard title="Present Days" value={stats.presentDays} icon={Clock} />
      </div>
    </div>
  );
}
