import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Clock, Users } from "lucide-react";

export default function OwnerAttendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [deptFilter, setDeptFilter] = useState("all");
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    const [attRes, empRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("date", selectedDate),
      supabase.from("profiles").select("user_id, full_name, department").eq("is_active", true),
    ]);
    if (attRes.data) setRecords(attRes.data);
    if (empRes.data) setEmployees(empRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const filteredEmployees = deptFilter === "all" ? employees : employees.filter(e => e.department === deptFilter);

  const markAttendance = async (employeeId: string, status: string) => {
    const { error } = await supabase.from("attendance").upsert({
      employee_id: employeeId, date: selectedDate, status, marked_by: user?.id,
    }, { onConflict: "employee_id,date" });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Attendance marked" });
    const { data } = await supabase.from("attendance").select("*").eq("date", selectedDate);
    if (data) setRecords(data);
  };

  const bulkMark = async (status: string) => {
    const promises = filteredEmployees.map((emp) =>
      supabase.from("attendance").upsert({
        employee_id: emp.user_id, date: selectedDate, status, marked_by: user?.id,
      }, { onConflict: "employee_id,date" })
    );
    await Promise.all(promises);
    toast({ title: `All marked as ${status.replace("_", " ")}` });
    const { data } = await supabase.from("attendance").select("*").eq("date", selectedDate);
    if (data) setRecords(data);
  };

  const getStatus = (userId: string) => records.find(r => r.employee_id === userId)?.status || null;

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold font-display">Attendance</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-auto" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground self-center">Bulk mark:</span>
        {["present", "absent", "leave", "half_day"].map(s => (
          <Button key={s} size="sm" variant="outline" onClick={() => bulkMark(s)} className="capitalize text-xs">
            {s.replace("_", " ")}
          </Button>
        ))}
      </div>

      {filteredEmployees.length === 0 ? (
        <EmptyState title="No employees" description="Add employees first." icon={Clock} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mark Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const status = getStatus(emp.user_id);
                return (
                  <TableRow key={emp.user_id}>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{emp.department || "—"}</TableCell>
                    <TableCell>
                      {status ? (
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${
                          status === "present" ? "bg-success/10 text-success" :
                          status === "absent" ? "bg-destructive/10 text-destructive" :
                          status === "half_day" ? "bg-info/10 text-info" :
                          "bg-warning/10 text-warning"
                        }`}>{status.replace("_", " ")}</span>
                      ) : <span className="text-muted-foreground text-sm">Not marked</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {["present", "absent", "leave", "half_day"].map(s => (
                        <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => markAttendance(emp.user_id, s)} className="capitalize text-xs">
                          {s.replace("_", " ")}
                        </Button>
                      ))}
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
