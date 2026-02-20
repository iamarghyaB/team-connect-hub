import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Clock } from "lucide-react";
import DailyAttendanceOverview from "@/components/attendance/DailyAttendanceOverview";
import EmployeePerformanceCard from "@/components/attendance/EmployeePerformanceCard";

export default function OwnerAttendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [monthRecords, setMonthRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [deptFilter, setDeptFilter] = useState("all");
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    const [yr, mo] = selectedDate.split("-");
    const monthStart = `${yr}-${mo}-01`;
    const monthEnd = `${yr}-${mo}-${new Date(+yr, +mo, 0).getDate()}`;

    const [attRes, monthAttRes, empRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("date", selectedDate),
      supabase.from("attendance").select("*").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("profiles").select("user_id, full_name, department, position").eq("is_active", true),
    ]);
    if (attRes.data) setRecords(attRes.data);
    if (monthAttRes.data) setMonthRecords(monthAttRes.data);
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
    fetchData();
  };

  const bulkMark = async (status: string) => {
    const promises = filteredEmployees.map((emp) =>
      supabase.from("attendance").upsert({
        employee_id: emp.user_id, date: selectedDate, status, marked_by: user?.id,
      }, { onConflict: "employee_id,date" })
    );
    await Promise.all(promises);
    toast({ title: `All marked as ${status.replace("_", " ")}` });
    fetchData();
  };

  const getStatus = (userId: string) => records.find(r => r.employee_id === userId)?.status || null;

  // Calculate working days for current month (excluding Sundays)
  const [yr, mo] = selectedDate.split("-").map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const today = new Date();
  const maxDay = yr === today.getFullYear() && mo === today.getMonth() + 1 ? today.getDate() : daysInMonth;
  let totalWorkingDays = 0;
  for (let d = 1; d <= maxDay; d++) {
    if (new Date(yr, mo - 1, d).getDay() !== 0) totalWorkingDays++;
  }

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

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Marking</TabsTrigger>
          <TabsTrigger value="performance">Employee Performance</TabsTrigger>
        </TabsList>

        {/* ────────── DAILY MARKING TAB ────────── */}
        <TabsContent value="daily" className="space-y-4">
          <DailyAttendanceOverview todayRecords={records} totalEmployees={filteredEmployees.length} />

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
        </TabsContent>

        {/* ────────── EMPLOYEE PERFORMANCE TAB ────────── */}
        <TabsContent value="performance" className="space-y-4">
          {filteredEmployees.length === 0 ? (
            <EmptyState title="No employees" description="Add employees first." icon={Clock} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEmployees.map((emp) => {
                const empMonthRecords = monthRecords
                  .filter((r) => r.employee_id === emp.user_id)
                  .map((r) => ({ date: r.date, status: r.status }));
                return (
                  <EmployeePerformanceCard
                    key={emp.user_id}
                    employee={emp}
                    monthRecords={empMonthRecords}
                    totalWorkingDays={totalWorkingDays}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
