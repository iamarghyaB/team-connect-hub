import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Plus, ListTodo } from "lucide-react";
import { format } from "date-fns";

export default function OwnerTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", priority: "medium", deadline: "" });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    const [taskRes, empRes] = await Promise.all([
      supabase.from("tasks").select("*, profiles!tasks_assigned_to_fkey(full_name)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name").eq("is_active", true),
    ]);
    if (taskRes.data) setTasks(taskRes.data);
    if (empRes.data) setEmployees(empRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from("tasks").insert({
      ...form, assigned_by: user?.id, deadline: form.deadline || null, description: form.description || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Task assigned" }); setDialogOpen(false); fetchData();
  };

  const priorityColor = (p: string) => p === "high" ? "destructive" : p === "medium" ? "default" : "secondary";
  const statusColor = (s: string) => s === "completed" ? "bg-success/10 text-success" : s === "in_progress" ? "bg-info/10 text-info" : "bg-warning/10 text-warning";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-display">Tasks</h1>
        <Button onClick={() => { setForm({ title: "", description: "", assigned_to: "", priority: "medium", deadline: "" }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Assign Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks" description="Assign tasks to employees." icon={ListTodo} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className="font-medium">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.description}</p>}
                  </TableCell>
                  <TableCell>{t.profiles?.full_name || "Unknown"}</TableCell>
                  <TableCell><Badge variant={priorityColor(t.priority) as any} className="capitalize">{t.priority}</Badge></TableCell>
                  <TableCell><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColor(t.status)}`}>{t.status.replace("_", " ")}</span></TableCell>
                  <TableCell>{t.deadline ? format(new Date(t.deadline), "MMM d, yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign New Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({...form, assigned_to: v})}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({...form, deadline: e.target.value})} /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.title || !form.assigned_to}>Assign Task</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
