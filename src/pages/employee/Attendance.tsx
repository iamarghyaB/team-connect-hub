import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import StatCard from "@/components/shared/StatCard";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function EmployeeAttendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    if (!user) return;
    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    supabase.from("attendance").select("*").eq("employee_id", user.id).gte("date", startDate).lte("date", endDate).order("date", { ascending: false }).then(({ data }) => {
      if (data) setRecords(data);
      setLoading(false);
    });
  }, [user, month, year]);

  const present = records.filter(r => r.status === "present").length;
  const absent = records.filter(r => r.status === "absent").length;
  const leave = records.filter(r => r.status === "leave").length;
  const halfDay = records.filter(r => r.status === "half_day").length;

  const statusColor = (s: string) =>
    s === "present" ? "bg-success/10 text-success" :
    s === "absent" ? "bg-destructive/10 text-destructive" :
    s === "half_day" ? "bg-info/10 text-info" :
    "bg-warning/10 text-warning";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold font-display">My Attendance</h1>
        <div className="flex gap-2">
          <Select value={month} onValueChange={(v) => { setMonth(v); setLoading(true); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={year} onValueChange={(v) => { setYear(v); setLoading(true); }}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Present" value={present} icon={CheckCircle} />
        <StatCard title="Absent" value={absent} icon={XCircle} />
        <StatCard title="Leave" value={leave} icon={Clock} />
        <StatCard title="Half Day" value={halfDay} icon={AlertCircle} />
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
