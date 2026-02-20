import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { ListTodo, Play, CheckCircle2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function EmployeeTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").eq("assigned_to", user!.id).order("created_at", { ascending: false });
    if (data) setTasks(data);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchTasks(); }, [user]);

  const updateStatus = async (task: any, newStatus: string) => {
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // Notify the assigner about status change
    if (task.assigned_by) {
      await supabase.from("notifications").insert({
        user_id: task.assigned_by,
        title: `Task ${newStatus === "in_progress" ? "Started" : "Completed"}`,
        message: `"${task.title}" has been marked as ${newStatus.replace("_", " ")}`,
        type: "task",
        reference_id: task.id,
      });
    }

    toast({ title: "Task updated" }); fetchTasks();
  };

  const priorityColor = (p: string) => p === "high" ? "destructive" : p === "medium" ? "default" : "secondary";
  const statusStyle = (s: string) =>
    s === "completed" ? "bg-success/10 text-success border-success/20"
    : s === "in_progress" ? "bg-info/10 text-info border-info/20"
    : "bg-warning/10 text-warning border-warning/20";

  const nextAction = (status: string) => {
    if (status === "pending") return { label: "Start", icon: Play, next: "in_progress" };
    if (status === "in_progress") return { label: "Complete", icon: CheckCircle2, next: "completed" };
    return null;
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Tasks</h1>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending", count: tasks.filter(t => t.status === "pending").length, style: "text-warning" },
          { label: "In Progress", count: tasks.filter(t => t.status === "in_progress").length, style: "text-info" },
          { label: "Completed", count: tasks.filter(t => t.status === "completed").length, style: "text-success" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
            <p className={cn("text-2xl font-bold font-display", s.style)}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks" description="You have no tasks assigned." icon={ListTodo} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(t => {
                const action = nextAction(t.status);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.description}</p>}
                    </TableCell>
                    <TableCell><Badge variant={priorityColor(t.priority) as any} className="capitalize">{t.priority}</Badge></TableCell>
                    <TableCell>{t.deadline ? format(new Date(t.deadline), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-medium capitalize", statusStyle(t.status))}>
                        {t.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {action ? (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(t, action.next)} className="gap-1.5">
                          <action.icon className="h-3.5 w-3.5" />
                          {action.label}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Done ✓</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
