import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { CalendarDays, Check, X } from "lucide-react";
import { format } from "date-fns";

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export default function OwnerLeaves() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchLeaves = async () => {
    const { data } = await supabase
      .from("leave_requests")
      .select("*, profiles!leave_requests_employee_id_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (data) setLeaves(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchLeaves(); }, []);

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({ status, reviewed_by: user?.id }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Leave ${status}` });
    fetchLeaves();
  };

  const pending = leaves.filter(l => l.status === "pending");
  const history = leaves.filter(l => l.status !== "pending");

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Leave Requests</h1>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <EmptyState title="No pending requests" description="All leave requests have been processed." icon={CalendarDays} />
          ) : (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{(l as any).profiles?.full_name || "Unknown"}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{l.leave_type}</Badge></TableCell>
                      <TableCell>{format(new Date(l.start_date), "MMM d")} – {format(new Date(l.end_date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{l.reason || "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => handleAction(l.id, "approved")}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(l.id, "rejected")}><X className="h-4 w-4 mr-1" /> Reject</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          {history.length === 0 ? (
            <EmptyState title="No history" description="No processed leave requests yet." icon={CalendarDays} />
          ) : (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{(l as any).profiles?.full_name || "Unknown"}</TableCell>
                      <TableCell className="capitalize">{l.leave_type}</TableCell>
                      <TableCell>{format(new Date(l.start_date), "MMM d")} – {format(new Date(l.end_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={l.status === "approved" ? "default" : "destructive"} className="capitalize">{l.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
