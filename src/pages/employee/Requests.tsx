import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Plus, MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [selected, setSelected] = useState<any>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    const { data } = await supabase.from("general_requests").select("*").eq("employee_id", user!.id).order("created_at", { ascending: false });
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchRequests(); }, [user]);

  const handleSubmit = async () => {
    const { error } = await supabase.from("general_requests").insert({ ...form, employee_id: user!.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Request submitted" }); setDialogOpen(false); fetchRequests();
  };

  const statusColor = (s: string) => s === "resolved" ? "default" : s === "reviewed" ? "secondary" : "outline";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-display">My Requests</h1>
        <Button onClick={() => { setForm({ subject: "", message: "" }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Request
        </Button>
      </div>

      {requests.length === 0 ? (
        <EmptyState title="No requests" description="Submit a request to your manager." icon={MessageSquare} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.subject}</TableCell>
                  <TableCell>{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell><Badge variant={statusColor(r.status) as any} className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} /></div>
            <div className="space-y-2"><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} rows={4} /></div>
            <Button onClick={handleSubmit} className="w-full" disabled={!form.subject || !form.message}>Submit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div><p className="text-sm text-muted-foreground">Subject</p><p className="font-medium">{selected.subject}</p></div>
              <div><p className="text-sm text-muted-foreground">Message</p><p className="text-sm">{selected.message}</p></div>
              {selected.owner_reply && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium text-muted-foreground">Owner Reply</p>
                  <p className="text-sm mt-1">{selected.owner_reply}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
