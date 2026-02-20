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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Plus, CalendarDays, X } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeLeave() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
  const { toast } = useToast();

  const fetchLeaves = async () => {
    const { data } = await supabase.from("leave_requests").select("*").eq("employee_id", user!.id).order("created_at", { ascending: false });
    if (data) setLeaves(data);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchLeaves(); }, [user]);

  const handleApply = async () => {
    const { error } = await supabase.from("leave_requests").insert({ ...form, employee_id: user!.id, reason: form.reason || null });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Leave request submitted" }); setDialogOpen(false); fetchLeaves();
  };

  const handleCancel = async (id: string) => {
    await supabase.from("leave_requests").delete().eq("id", id);
    toast({ title: "Leave request cancelled" }); fetchLeaves();
  };

  const statusColor = (s: string) => s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-display">Leave Requests</h1>
        <Button onClick={() => { setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Apply Leave
        </Button>
      </div>

      {leaves.length === 0 ? (
        <EmptyState title="No leave requests" description="Apply for a leave when needed." icon={CalendarDays} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="capitalize">{l.leave_type}</TableCell>
                  <TableCell>{format(new Date(l.start_date), "MMM d")} – {format(new Date(l.end_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{l.reason || "—"}</TableCell>
                  <TableCell><Badge variant={statusColor(l.status) as any} className="capitalize">{l.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {l.status === "pending" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><X className="h-3 w-3 mr-1" /> Cancel</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Cancel leave request?</AlertDialogTitle><AlertDialogDescription>This will delete your pending leave request.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction onClick={() => handleCancel(l.id)}>Yes, Cancel</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({...form, leave_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({...form, start_date: e.target.value})} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <div className="space-y-2"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} rows={3} /></div>
            <Button onClick={handleApply} className="w-full" disabled={!form.start_date || !form.end_date}>Submit Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
