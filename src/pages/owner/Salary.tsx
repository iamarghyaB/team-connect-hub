import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import StatCard from "@/components/shared/StatCard";
import { DollarSign, Check, ChevronDown, ChevronRight, Wallet, TrendingDown, CreditCard, Printer } from "lucide-react";
import { calculateSalary, formatCurrency, type SalaryBreakdown } from "@/lib/salaryCalculation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PIE_COLORS = ["hsl(152,60%,40%)", "hsl(0,72%,51%)", "hsl(38,92%,50%)", "hsl(210,80%,52%)"];

interface EmployeeWithSalary {
  user_id: string;
  full_name: string;
  department: string | null;
  salary: number | null;
  breakdown: SalaryBreakdown;
  record: any;
  attendanceByDay: Record<string, string>;
}

export default function OwnerSalary() {
  const [employees, setEmployees] = useState<EmployeeWithSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [workingDays, setWorkingDays] = useState(26);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const m = parseInt(month);
    const y = parseInt(year);
    
    // Build date range for the month
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [empRes, attRes, leaveRes, salRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, department, salary").eq("is_active", true),
      supabase.from("attendance").select("*").gte("date", startDate).lte("date", endDate),
      supabase.from("leave_requests").select("*").eq("status", "approved"),
      supabase.from("salary_records").select("*").eq("month", m).eq("year", y),
    ]);

    const emps = empRes.data || [];
    const attendance = attRes.data || [];
    const leaves = leaveRes.data || [];
    const salaryRecords = salRes.data || [];

    const result: EmployeeWithSalary[] = emps.map((emp) => {
      const empAtt = attendance.filter((a) => a.employee_id === emp.user_id);
      const summary = {
        present: empAtt.filter((a) => a.status === "present").length,
        absent: empAtt.filter((a) => a.status === "absent").length,
        leave: empAtt.filter((a) => a.status === "leave").length,
        half_day: empAtt.filter((a) => a.status === "half_day").length,
      };

      // Count approved leave days that fall in this month
      const approvedLeaveDays = leaves
        .filter((l) => l.employee_id === emp.user_id)
        .reduce((count, l) => {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          let days = 0;
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getMonth() + 1 === m && d.getFullYear() === y) days++;
          }
          return count + days;
        }, 0);

      const breakdown = calculateSalary(emp.salary || 0, summary, workingDays, approvedLeaveDays);
      const record = salaryRecords.find((r) => r.employee_id === emp.user_id);

      // Build day-by-day map
      const attendanceByDay: Record<string, string> = {};
      empAtt.forEach((a) => { attendanceByDay[a.date] = a.status; });

      return { ...emp, breakdown, record, attendanceByDay };
    });

    setEmployees(result);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [month, year, workingDays]);

  const markPaid = async (emp: EmployeeWithSalary) => {
    const b = emp.breakdown;
    const { error } = await supabase.from("salary_records").upsert({
      employee_id: emp.user_id,
      month: parseInt(month),
      year: parseInt(year),
      amount: b.finalSalary,
      base_salary: b.baseSalary,
      total_working_days: b.totalWorkingDays,
      present_days: b.presentDays,
      absent_days: b.absentDays,
      leave_days: b.leaveDays,
      half_days: b.halfDays,
      per_day_rate: b.perDayRate,
      present_amount: b.presentAmount,
      half_day_amount: b.halfDayAmount,
      leave_amount: b.leaveAmount,
      deduction_amount: b.deductionAmount,
      final_salary: b.finalSalary,
      is_paid: true,
      paid_date: new Date().toISOString().split("T")[0],
      generated_at: new Date().toISOString(),
    }, { onConflict: "employee_id,month,year" });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salary marked as paid" });
    fetchData();
  };

  const unpaidWithSalary = useMemo(() => employees.filter(e => !e.record?.is_paid && e.salary), [employees]);

  const markAllPaid = async () => {
    setMarkingAll(true);
    for (const emp of unpaidWithSalary) {
      await markPaid(emp);
    }
    setMarkingAll(false);
  };

  const totalPayroll = useMemo(() => employees.reduce((s, e) => s + e.breakdown.finalSalary, 0), [employees]);
  const totalPaid = useMemo(() => employees.filter(e => e.record?.is_paid).reduce((s, e) => s + (e.record?.final_salary || e.record?.amount || 0), 0), [employees]);
  const totalUnpaid = useMemo(() => totalPayroll - totalPaid, [totalPayroll, totalPaid]);
  const totalDeductions = useMemo(() => employees.reduce((s, e) => s + e.breakdown.deductionAmount, 0), [employees]);

  const barChartData = useMemo(() => employees.map(e => ({
    name: e.full_name.split(" ")[0],
    Present: e.breakdown.presentDays,
    Absent: e.breakdown.absentDays,
    Leave: e.breakdown.leaveDays,
    "Half Day": e.breakdown.halfDays,
  })), [employees]);

  const printSlip = (emp: EmployeeWithSalary) => {
    const b = emp.breakdown;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Salary Slip - ${emp.full_name}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:auto}
      h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      td{padding:8px 4px;border-bottom:1px solid #eee}
      .right{text-align:right}.bold{font-weight:bold}
      .total{border-top:2px solid #333;font-size:18px}
      .green{color:#2e7d32}</style></head><body>
      <h1>Salary Slip</h1>
      <p><strong>${emp.full_name}</strong> | ${emp.department || "N/A"}</p>
      <p>${MONTHS[parseInt(month) - 1]} ${year}</p>
      <table>
        <tr><td>Base Salary</td><td class="right">${formatCurrency(b.baseSalary)}</td></tr>
        <tr><td>Working Days</td><td class="right">${b.totalWorkingDays}</td></tr>
        <tr><td>Per Day Rate</td><td class="right">${formatCurrency(b.perDayRate)}</td></tr>
        <tr><td colspan="2" style="height:12px"></td></tr>
        <tr><td>Present (${b.presentDays}d)</td><td class="right">+${formatCurrency(b.presentAmount)}</td></tr>
        <tr><td>Half Day (${b.halfDays}d)</td><td class="right">+${formatCurrency(b.halfDayAmount)}</td></tr>
        <tr><td>Approved Leave (${b.leaveDays}d)</td><td class="right">+${formatCurrency(b.leaveAmount)}</td></tr>
        <tr><td>Absent Deduction (${b.absentDays}d)</td><td class="right" style="color:#c62828">-${formatCurrency(b.deductionAmount)}</td></tr>
        <tr class="total"><td class="bold">Final Payable</td><td class="right bold green">${formatCurrency(b.finalSalary)}</td></tr>
      </table>
      <p style="margin-top:32px;color:#888;font-size:12px">Generated on ${new Date().toLocaleDateString()}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  // Build calendar days for expanded view
  const getDaysInMonth = () => {
    const m = parseInt(month);
    const y = parseInt(year);
    const daysCount = new Date(y, m, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => {
      const day = i + 1;
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    });
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "present": return "✅";
      case "absent": return "❌";
      case "leave": return "🌿";
      case "half_day": return "🌓";
      default: return "—";
    }
  };

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case "present": return "bg-success/10 text-success border-0";
      case "absent": return "bg-destructive/10 text-destructive border-0";
      case "leave": return "bg-warning/10 text-warning border-0";
      case "half_day": return "bg-info/10 text-info border-0";
      default: return "";
    }
  };

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Salary Management</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold font-display">Salary Management</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Working Days:</span>
            <Input type="number" className="w-[70px]" value={workingDays} onChange={(e) => setWorkingDays(parseInt(e.target.value) || 26)} min={1} max={31} />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          {unpaidWithSalary.length > 0 && (
            <Button onClick={markAllPaid} disabled={markingAll}>
              <Check className="h-4 w-4 mr-1" /> {markingAll ? "Marking..." : `Mark All Paid (${unpaidWithSalary.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Payroll" value={formatCurrency(totalPayroll)} icon={Wallet} />
        <StatCard title="Total Paid" value={formatCurrency(totalPaid)} icon={CreditCard} />
        <StatCard title="Total Unpaid" value={formatCurrency(totalUnpaid)} icon={DollarSign} />
        <StatCard title="Total Deductions" value={formatCurrency(totalDeductions)} icon={TrendingDown} />
      </div>

      {/* Attendance Bar Chart */}
      {employees.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Attendance Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="Present" fill="hsl(152,60%,40%)" radius={[4,4,0,0]} />
                <Bar dataKey="Absent" fill="hsl(0,72%,51%)" radius={[4,4,0,0]} />
                <Bar dataKey="Leave" fill="hsl(38,92%,50%)" radius={[4,4,0,0]} />
                <Bar dataKey="Half Day" fill="hsl(210,80%,52%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Main Salary Table */}
      {employees.length === 0 ? (
        <EmptyState title="No employees" description="Add employees first." icon={DollarSign} />
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => {
            const b = emp.breakdown;
            const isExpanded = expandedId === emp.user_id;
            const isPaid = emp.record?.is_paid;

            return (
              <Collapsible key={emp.user_id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : emp.user_id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="font-medium text-sm">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.department || "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 flex-1 items-center">
                        <span className="text-xs text-muted-foreground">Base: {formatCurrency(b.baseSalary)}</span>
                        <Badge className={statusBadgeClass("present")}>{b.presentDays}P</Badge>
                        <Badge className={statusBadgeClass("absent")}>{b.absentDays}A</Badge>
                        <Badge className={statusBadgeClass("leave")}>{b.leaveDays}L</Badge>
                        <Badge className={statusBadgeClass("half_day")}>{b.halfDays}H</Badge>
                        <span className="text-xs text-muted-foreground">Rate: {formatCurrency(b.perDayRate)}/d</span>
                        <span className="text-xs text-destructive">-{formatCurrency(b.deductionAmount)}</span>
                        <span className="font-bold text-sm text-success ml-auto">{formatCurrency(b.finalSalary)}</span>
                        {isPaid ? (
                          <Badge className="bg-success/10 text-success border-0">Paid ✅</Badge>
                        ) : (
                          <Badge variant="outline">Unpaid ❌</Badge>
                        )}
                        {!isPaid && emp.salary && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); markPaid(emp); }}>
                            <Check className="h-4 w-4 mr-1" /> Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t p-4 space-y-4">
                      {/* Salary Breakdown */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Salary Breakdown</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span>Base Salary:</span><span>{formatCurrency(b.baseSalary)}</span></div>
                            <div className="flex justify-between"><span>Present ({b.presentDays}d):</span><span className="text-success">+{formatCurrency(b.presentAmount)}</span></div>
                            <div className="flex justify-between"><span>Half Day ({b.halfDays}d):</span><span className="text-success">+{formatCurrency(b.halfDayAmount)}</span></div>
                            <div className="flex justify-between"><span>Approved Leave ({b.leaveDays}d):</span><span className="text-success">+{formatCurrency(b.leaveAmount)}</span></div>
                            <div className="flex justify-between"><span>Absent Deduction ({b.absentDays}d):</span><span className="text-destructive">-{formatCurrency(b.deductionAmount)}</span></div>
                            <div className="border-t pt-1 flex justify-between font-bold"><span>Final Payable:</span><span className="text-success">{formatCurrency(b.finalSalary)}</span></div>
                          </div>
                          <Button size="sm" variant="outline" className="mt-3" onClick={() => printSlip(emp)}>
                            <Printer className="h-4 w-4 mr-1" /> Generate Salary Slip
                          </Button>
                        </div>

                        {/* Pie Chart */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Attendance Distribution</h4>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "Present", value: b.presentDays },
                                  { name: "Absent", value: b.absentDays },
                                  { name: "Leave", value: b.leaveDays },
                                  { name: "Half Day", value: b.halfDays },
                                ].filter(d => d.value > 0)}
                                cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                                paddingAngle={2} dataKey="value"
                              >
                                {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                              </Pie>
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Day-by-day calendar grid */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Daily Attendance</h4>
                        <div className="grid grid-cols-7 gap-1">
                          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                          ))}
                          {(() => {
                            const days = getDaysInMonth();
                            const firstDayOfWeek = new Date(days[0]).getDay();
                            const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => (
                              <div key={`blank-${i}`} />
                            ));
                            const cells = days.map((date) => {
                              const status = emp.attendanceByDay[date];
                              const dayNum = new Date(date).getDate();
                              return (
                                <div key={date} className="text-center rounded-md border p-1" title={status || "Not marked"}>
                                  <div className="text-xs text-muted-foreground">{dayNum}</div>
                                  <div className="text-sm">{status ? statusIcon(status) : "—"}</div>
                                </div>
                              );
                            });
                            return [...blanks, ...cells];
                          })()}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
