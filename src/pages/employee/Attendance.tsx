import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Clock } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeAttendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("attendance").select("*").eq("employee_id", user.id).order("date", { ascending: false }).then(({ data }) => {
      if (data) setRecords(data);
      setLoading(false);
    });
  }, [user]);

  const present = records.filter(r => r.status === "present").length;
  const absent = records.filter(r => r.status === "absent").length;
  const leave = records.filter(r => r.status === "leave").length;

  const statusColor = (s: string) => s === "present" ? "bg-success/10 text-success" : s === "absent" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Attendance</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-success">{present}</p><p className="text-sm text-muted-foreground">Present</p></div>
        <div className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-destructive">{absent}</p><p className="text-sm text-muted-foreground">Absent</p></div>
        <div className="rounded-lg border p-4 text-center"><p className="text-2xl font-bold text-warning">{leave}</p><p className="text-sm text-muted-foreground">Leave</p></div>
      </div>
      {records.length === 0 ? (
        <EmptyState title="No attendance records" description="Your attendance will appear here." icon={Clock} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.date), "EEEE, MMM d, yyyy")}</TableCell>
                  <TableCell><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColor(r.status)}`}>{r.status.replace("_", " ")}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
