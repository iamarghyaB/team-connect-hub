import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { format } from "date-fns";

interface Notice {
  id: string;
  title: string;
  content: string;
  posted_by: string | null;
  target_department: string | null;
  priority: string;
  created_at: string;
}

const PRIORITIES = ["low", "normal", "high", "urgent"];
const DEPARTMENTS = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Operations", "Design"];

export default function OwnerNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState({ title: "", content: "", target_department: "", priority: "normal" });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchNotices = async () => {
    const { data } = await supabase.from("notices").select("*").order("created_at", { ascending: false });
    if (data) setNotices(data);
    setLoading(false);
  };

  useEffect(() => { fetchNotices(); }, []);

  const openNew = () => { setEditing(null); setForm({ title: "", content: "", target_department: "", priority: "normal" }); setDialogOpen(true); };
  const openEdit = (n: Notice) => { setEditing(n); setForm({ title: n.title, content: n.content, target_department: n.target_department || "", priority: n.priority }); setDialogOpen(true); };

  const handleSave = async () => {
    const payload = { ...form, target_department: form.target_department || null, posted_by: user?.id };
    if (editing) {
      const { error } = await supabase.from("notices").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Notice updated" });
    } else {
      const { error } = await supabase.from("notices").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Notice posted" });
    }
    setDialogOpen(false); fetchNotices();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("notices").delete().eq("id", id);
    toast({ title: "Notice deleted" }); fetchNotices();
  };

  const priorityColor = (p: string) => {
    if (p === "urgent") return "destructive";
    if (p === "high") return "default";
    return "secondary";
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-display">Notice Board</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Notice</Button>
      </div>

      {notices.length === 0 ? (
        <EmptyState title="No notices" description="Post your first announcement." icon={Megaphone} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notices.map(n => (
            <Card key={n.id} className="animate-fade-in">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">{n.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, yyyy")}</p>
                </div>
                <div className="flex gap-1">
                  <Badge variant={priorityColor(n.priority) as any} className="capitalize">{n.priority}</Badge>
                  {n.target_department && <Badge variant="outline">{n.target_department}</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{n.content}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(n)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete this notice?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(n.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Notice" : "New Notice"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-2"><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} rows={4} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Department</Label>
                <Select value={form.target_department} onValueChange={(v) => setForm({...form, target_department: v})}>
                  <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Departments</SelectItem>
                    {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Save" : "Post Notice"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
