import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default function OwnerRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [reply, setReply] = useState("");
  const { toast } = useToast();

  const fetchRequests = async () => {
    const [reqRes, profRes] = await Promise.all([
      supabase.from("general_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (reqRes.data) setRequests(reqRes.data);
    const map: Record<string, string> = {};
    profRes.data?.forEach(p => { map[p.user_id] = p.full_name; });
    setProfiles(map);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleReply = async () => {
    const { error } = await supabase.from("general_requests").update({ owner_reply: reply, status: "reviewed" }).eq("id", selectedReq.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reply sent" }); setSelectedReq(null); setReply(""); fetchRequests();
  };

  const statusColor = (s: string) => s === "resolved" ? "default" : s === "reviewed" ? "secondary" : "outline";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">General Requests</h1>
      {requests.length === 0 ? (
        <EmptyState title="No requests" description="No employee requests yet." icon={MessageSquare} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{profiles[r.employee_id] || "Unknown"}</TableCell>
                  <TableCell>{r.subject}</TableCell>
                  <TableCell>{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell><Badge variant={statusColor(r.status) as any} className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedReq(r); setReply(r.owner_reply || ""); }}>View / Reply</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedReq} onOpenChange={() => setSelectedReq(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Details</DialogTitle></DialogHeader>
          {selectedReq && (
            <div className="space-y-4">
              <div><p className="text-sm font-medium text-muted-foreground">From</p><p className="font-medium">{profiles[selectedReq.employee_id] || "Unknown"}</p></div>
              <div><p className="text-sm font-medium text-muted-foreground">Subject</p><p className="font-medium">{selectedReq.subject}</p></div>
              <div><p className="text-sm font-medium text-muted-foreground">Message</p><p className="text-sm">{selectedReq.message}</p></div>
              <div className="space-y-2"><p className="text-sm font-medium text-muted-foreground">Reply</p><Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} /></div>
              <Button onClick={handleReply} className="w-full">Send Reply</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
