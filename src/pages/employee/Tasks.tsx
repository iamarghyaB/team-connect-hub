import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { ListTodo } from "lucide-react";
import { format } from "date-fns";

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

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Task updated" }); fetchTasks();
  };

  const priorityColor = (p: string) => p === "high" ? "destructive" : p === "medium" ? "default" : "secondary";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Tasks</h1>
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
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className="font-medium">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.description}</p>}
                  </TableCell>
                  <TableCell><Badge variant={priorityColor(t.priority) as any} className="capitalize">{t.priority}</Badge></TableCell>
                  <TableCell>{t.deadline ? format(new Date(t.deadline), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="capitalize">{t.status.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
