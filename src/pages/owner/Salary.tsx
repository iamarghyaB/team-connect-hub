import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import StatCard from "@/components/shared/StatCard";
import SalaryReviewSheet from "@/components/salary/SalaryReviewSheet";
import { DollarSign, Check, Wallet, TrendingDown, CreditCard, Users, AlertTriangle, Lock, Eye, Zap, Printer, TrendingUp, Award, UserX, UserCheck } from "lucide-react";
import { calculateSalary, formatCurrency, type SalaryBreakdown } from "@/lib/salaryCalculation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PIE_COLORS = ["hsl(152,60%,40%)", "hsl(0,72%,51%)", "hsl(38,92%,50%)", "hsl(210,80%,52%)"];
const STAGE_COLORS: Record<string, string> = {
  draft: "bg-warning/10 text-warning border-warning/30",
  calculated: "bg-info/10 text-info border-info/30",
  under_review: "bg-[hsl(25,90%,50%)]/10 text-[hsl(25,90%,50%)] border-[hsl(25,90%,50%)]/30",
  approved: "bg-success/10 text-success border-success/30",
  paid: "bg-success/10 text-success border-success/30",
};
const STAGE_ROW_COLORS: Record<string, string> = {
  draft: "border-l-4 border-l-warning",
  calculated: "border-l-4 border-l-info",
  under_review: "border-l-4 border-l-[hsl(25,90%,50%)]",
  approved: "border-l-4 border-l-success",
  paid: "border-l-4 border-l-success",
};
const STAGE_LABELS: Record<string, string> = {
  draft: "🟡 Draft",
  calculated: "🔵 Calculated",
  under_review: "🟠 Under Review",
  approved: "🟢 Approved",
  paid: "🟢 Paid",
};

interface EmployeeWithSalary {
  user_id: string;
  full_name: string;
  department: string | null;
  salary: number | null;
  breakdown: SalaryBreakdown;
  record: any;
  stage: string;
  attendanceByDay: Record<string, string>;
}

export default function OwnerSalary() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeWithSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [workingDays, setWorkingDays] = useState(26);
  const [filterDept, setFilterDept] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [reviewTarget, setReviewTarget] = useState<EmployeeWithSalary | null>(null);
  const [lastMonthRecords, setLastMonthRecords] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Calculate last month
    const lm = m === 1 ? 12 : m - 1;
    const ly = m === 1 ? y - 1 : y;

    const [empRes, attRes, leaveRes, salRes, lastMonthRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, department, salary").eq("is_active", true),
      supabase.from("attendance").select("*").gte("date", startDate).lte("date", endDate),
      supabase.from("leave_requests").select("*").eq("status", "approved"),
      supabase.from("salary_records").select("*").eq("month", m).eq("year", y),
      supabase.from("salary_records").select("*").eq("month", lm).eq("year", ly),
    ]);

    const emps = empRes.data || [];
    const attendance = attRes.data || [];
    const leaves = leaveRes.data || [];
    const salaryRecords = salRes.data || [];
    setLastMonthRecords(lastMonthRes.data || []);

    const result: EmployeeWithSalary[] = emps.map((emp) => {
      const empAtt = attendance.filter((a) => a.employee_id === emp.user_id);
      const summary = {
        present: empAtt.filter((a) => a.status === "present").length,
        absent: empAtt.filter((a) => a.status === "absent").length,
        leave: empAtt.filter((a) => a.status === "leave").length,
        half_day: empAtt.filter((a) => a.status === "half_day").length,
      };
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
      const stage = record?.stage || "draft";

      const attendanceByDay: Record<string, string> = {};
      empAtt.forEach((a) => { attendanceByDay[a.date] = a.status; });

      return { ...emp, breakdown, record, stage, attendanceByDay };
    });

    setEmployees(result);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [month, year, workingDays]);

  // Set up realtime
  useEffect(() => {
    const channel = supabase
      .channel("salary-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "salary_records" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "salary_adjustments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_edits_log" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [month, year, workingDays]);

  const departments = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))], [employees]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (filterDept !== "all" && e.department !== filterDept) return false;
      if (filterStage !== "all" && e.stage !== filterStage) return false;
      return true;
    });
  }, [employees, filterDept, filterStage]);

  const calculateSalaryForAll = async () => {
    for (const emp of employees) {
      if (emp.stage === "approved" || emp.stage === "paid") continue;
      const b = emp.breakdown;
      const bonusTotal = emp.record?.bonus_total || 0;
      const deductionExtraTotal = emp.record?.deduction_extra_total || 0;
      const finalSal = b.finalSalary + bonusTotal - deductionExtraTotal;
      await supabase.from("salary_records").upsert({
        employee_id: emp.user_id, month: parseInt(month), year: parseInt(year),
        amount: finalSal, base_salary: b.baseSalary,
        total_working_days: b.totalWorkingDays, present_days: b.presentDays,
        absent_days: b.absentDays, leave_days: b.leaveDays, half_days: b.halfDays,
        per_day_rate: b.perDayRate, present_amount: b.presentAmount,
        half_day_amount: b.halfDayAmount, leave_amount: b.leaveAmount,
        deduction_amount: b.deductionAmount, final_salary: finalSal,
        bonus_total: bonusTotal, deduction_extra_total: deductionExtraTotal,
        stage: "calculated", generated_at: new Date().toISOString(), is_paid: false,
      }, { onConflict: "employee_id,month,year" });
    }
    toast({ title: "All salaries calculated" });
    fetchData();
  };

  const markPaid = async (emp: EmployeeWithSalary) => {
    if (emp.stage !== "approved") {
      toast({ title: "Cannot mark paid", description: "Salary must be approved first.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("salary_records").update({
      is_paid: true, paid_date: new Date().toISOString().split("T")[0], stage: "paid",
    }).eq("id", emp.record.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("salary_audit_log").insert({
      salary_record_id: emp.record.id, employee_id: emp.user_id,
      month: parseInt(month), year: parseInt(year),
      action: "Marked as Paid", old_value: "approved", new_value: "paid",
      done_by: user!.id, reason: "Payment completed",
    });
    toast({ title: "Salary marked as paid" });
    fetchData();
  };

  const undoPaid = async (emp: EmployeeWithSalary) => {
    if (!emp.record?.id) return;
    const { error } = await supabase.from("salary_records").update({
      is_paid: false, paid_date: null, stage: "approved",
    }).eq("id", emp.record.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("salary_audit_log").insert({
      salary_record_id: emp.record.id, employee_id: emp.user_id,
      month: parseInt(month), year: parseInt(year),
      action: "Payment reverted", old_value: "paid", new_value: "approved",
      done_by: user!.id, reason: "Undo payment",
    });
    toast({ title: "Payment reverted" });
    fetchData();
  };

  // Stats
  const totalPayroll = useMemo(() => filtered.reduce((s, e) => s + (e.record?.final_salary || e.breakdown.finalSalary), 0), [filtered]);
  const reviewedCount = useMemo(() => filtered.filter(e => ["under_review", "approved", "paid"].includes(e.stage)).length, [filtered]);
  const pendingCount = useMemo(() => filtered.filter(e => ["draft", "calculated"].includes(e.stage)).length, [filtered]);
  const approvedCount = useMemo(() => filtered.filter(e => ["approved", "paid"].includes(e.stage)).length, [filtered]);
  const totalBonuses = useMemo(() => filtered.reduce((s, e) => s + (e.record?.bonus_total || 0), 0), [filtered]);
  const totalDeductions = useMemo(() => filtered.reduce((s, e) => s + e.breakdown.deductionAmount + (e.record?.deduction_extra_total || 0), 0), [filtered]);

  // Analytics
  const highestSalaryEmp = useMemo(() => [...filtered].sort((a, b) => (b.record?.final_salary || b.breakdown.finalSalary) - (a.record?.final_salary || a.breakdown.finalSalary))[0], [filtered]);
  const mostAbsentEmp = useMemo(() => [...filtered].sort((a, b) => b.breakdown.absentDays - a.breakdown.absentDays)[0], [filtered]);
  const mostPresentEmp = useMemo(() => [...filtered].sort((a, b) => b.breakdown.presentDays - a.breakdown.presentDays)[0], [filtered]);

  const lastMonthTotal = useMemo(() => lastMonthRecords.reduce((s, r) => s + (r.final_salary || r.amount || 0), 0), [lastMonthRecords]);
  const payrollChange = lastMonthTotal > 0 ? ((totalPayroll - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) : null;

  // Chart data
  const salaryCompareData = useMemo(() => filtered.map(e => ({
    name: e.full_name.split(" ")[0],
    "Base Salary": e.breakdown.baseSalary,
    "Final Salary": e.record?.final_salary || e.breakdown.finalSalary,
  })), [filtered]);

  const attendanceBarData = useMemo(() => filtered.map(e => ({
    name: e.full_name.split(" ")[0],
    Present: e.breakdown.presentDays,
    Absent: e.breakdown.absentDays,
    Leave: e.breakdown.leaveDays,
    "Half Day": e.breakdown.halfDays,
  })), [filtered]);

  const deptPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const dept = e.department || "Unassigned";
      map[dept] = (map[dept] || 0) + (e.record?.final_salary || e.breakdown.finalSalary);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [filtered]);

  const comparisonData = useMemo(() => filtered.map(e => {
    const lmr = lastMonthRecords.find(r => r.employee_id === e.user_id);
    const thisMonth = e.record?.final_salary || e.breakdown.finalSalary;
    const lastMonth = lmr?.final_salary || lmr?.amount || 0;
    return { name: e.full_name, lastMonth, thisMonth, diff: thisMonth - lastMonth };
  }), [filtered, lastMonthRecords]);

  const printSlip = (emp: EmployeeWithSalary) => {
    const b = emp.record || emp.breakdown;
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
        <tr><td>Base Salary</td><td class="right">${formatCurrency(b.base_salary || b.baseSalary || 0)}</td></tr>
        <tr><td>Working Days</td><td class="right">${b.total_working_days || b.totalWorkingDays}</td></tr>
        <tr><td>Present (${b.present_days || b.presentDays}d)</td><td class="right">+${formatCurrency(b.present_amount || b.presentAmount || 0)}</td></tr>
        <tr><td>Half Day (${b.half_days || b.halfDays}d)</td><td class="right">+${formatCurrency(b.half_day_amount || b.halfDayAmount || 0)}</td></tr>
        <tr><td>Leave (${b.leave_days || b.leaveDays}d)</td><td class="right">+${formatCurrency(b.leave_amount || b.leaveAmount || 0)}</td></tr>
        <tr><td>Deductions (${b.absent_days || b.absentDays}d)</td><td class="right" style="color:#c62828">-${formatCurrency(b.deduction_amount || b.deductionAmount || 0)}</td></tr>
        ${(b.bonus_total || 0) > 0 ? `<tr><td>Bonuses</td><td class="right" style="color:#2e7d32">+${formatCurrency(b.bonus_total)}</td></tr>` : ""}
        ${(b.deduction_extra_total || 0) > 0 ? `<tr><td>Extra Deductions</td><td class="right" style="color:#c62828">-${formatCurrency(b.deduction_extra_total)}</td></tr>` : ""}
        <tr class="total"><td class="bold">Final Payable</td><td class="right bold green">${formatCurrency(b.final_salary || b.finalSalary || 0)}</td></tr>
      </table>
      <p style="margin-top:32px;color:#888;font-size:12px">Generated on ${new Date().toLocaleDateString()}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Salary Management</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold font-display">Salary Cross-Check</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <Input type="number" className="w-[70px]" value={workingDays} onChange={(e) => setWorkingDays(parseInt(e.target.value) || 26)} min={1} max={31} />
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={calculateSalaryForAll}>
            <Zap className="h-4 w-4 mr-1" /> Calculate All
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <StatCard title="Total Employees" value={filtered.length} icon={Users} />
        <StatCard title="Reviewed" value={reviewedCount} icon={Eye} />
        <StatCard title="Pending" value={pendingCount} icon={AlertTriangle} />
        <StatCard title="Approved" value={approvedCount} icon={Check} />
        <StatCard title="Total Payout" value={formatCurrency(totalPayroll)} icon={Wallet} />
        <StatCard title="Total Deductions" value={formatCurrency(totalDeductions)} icon={TrendingDown} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="draft">🟡 Draft</SelectItem>
            <SelectItem value="calculated">🔵 Calculated</SelectItem>
            <SelectItem value="under_review">🟠 Under Review</SelectItem>
            <SelectItem value="approved">🟢 Approved</SelectItem>
            <SelectItem value="paid">🟢 Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Cross-Check Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No employees found" description="Try adjusting filters." icon={DollarSign} />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-center">P</TableHead>
                  <TableHead className="text-center">A</TableHead>
                  <TableHead className="text-center">L</TableHead>
                  <TableHead className="text-center">H</TableHead>
                  <TableHead className="text-right">Auto Calc</TableHead>
                  <TableHead className="text-right">Adj</TableHead>
                  <TableHead className="text-right">Final</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(emp => {
                  const finalSal = emp.record?.final_salary || emp.breakdown.finalSalary;
                  const adjTotal = (emp.record?.bonus_total || 0) - (emp.record?.deduction_extra_total || 0);
                  return (
                    <TableRow key={emp.user_id} className={STAGE_ROW_COLORS[emp.stage] || ""}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{emp.full_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{emp.department || "—"}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{formatCurrency(emp.breakdown.baseSalary)}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-success/10 text-success border-0 text-xs">{emp.breakdown.presentDays}</Badge></TableCell>
                      <TableCell className="text-center"><Badge className="bg-destructive/10 text-destructive border-0 text-xs">{emp.breakdown.absentDays}</Badge></TableCell>
                      <TableCell className="text-center"><Badge className="bg-warning/10 text-warning border-0 text-xs">{emp.breakdown.leaveDays}</Badge></TableCell>
                      <TableCell className="text-center"><Badge className="bg-info/10 text-info border-0 text-xs">{emp.breakdown.halfDays}</Badge></TableCell>
                      <TableCell className="text-right text-xs font-mono">{formatCurrency(emp.breakdown.finalSalary)}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {adjTotal !== 0 && (
                          <span className={adjTotal > 0 ? "text-success" : "text-destructive"}>
                            {adjTotal > 0 ? "+" : ""}{formatCurrency(adjTotal)}
                          </span>
                        )}
                        {adjTotal === 0 && "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm font-mono">{formatCurrency(finalSal)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STAGE_COLORS[emp.stage] || ""}`}>
                          {emp.record?.is_locked && <Lock className="h-3 w-3 mr-1 inline" />}
                          {STAGE_LABELS[emp.stage] || emp.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReviewTarget(emp)}>
                            <Eye className="h-3 w-3 mr-1" /> Review
                          </Button>
                          {emp.stage === "calculated" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReviewTarget(emp)}>
                              <Check className="h-3 w-3 mr-1" /> Quick Approve
                            </Button>
                          )}
                          {emp.stage === "approved" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" className="h-7 text-xs"><CreditCard className="h-3 w-3 mr-1" /> Pay</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Mark as Paid?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Mark <strong>{emp.full_name}</strong>'s salary of <strong>{formatCurrency(finalSal)}</strong> as paid?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => markPaid(emp)}>Yes, Mark Paid</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {emp.stage === "paid" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 text-xs">Undo</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Undo Payment?</AlertDialogTitle>
                                  <AlertDialogDescription>Revert {emp.full_name}'s payment?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => undoPaid(emp)}>Yes, Undo</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => printSlip(emp)}>
                            <Printer className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payroll Analytics */}
      {filtered.length > 0 && (
        <>
          <h2 className="text-xl font-bold font-display mt-4">Payroll Analytics</h2>

          {/* Highlight Stats */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <StatCard title="Highest Salary" value={highestSalaryEmp ? `${formatCurrency(highestSalaryEmp.record?.final_salary || highestSalaryEmp.breakdown.finalSalary)}` : "—"} icon={Award} trend={highestSalaryEmp?.full_name} />
            <StatCard title="Most Absent" value={mostAbsentEmp ? `${mostAbsentEmp.breakdown.absentDays}d` : "—"} icon={UserX} trend={mostAbsentEmp?.full_name} />
            <StatCard title="Most Present" value={mostPresentEmp ? `${mostPresentEmp.breakdown.presentDays}d` : "—"} icon={UserCheck} trend={mostPresentEmp?.full_name} />
            <StatCard title="Total Bonuses" value={formatCurrency(totalBonuses)} icon={TrendingUp} />
            <StatCard title="Total Deductions" value={formatCurrency(totalDeductions)} icon={TrendingDown} />
            <StatCard title="vs Last Month" value={payrollChange ? `${payrollChange}%` : "N/A"} icon={TrendingUp} trend={payrollChange && parseFloat(payrollChange) >= 0 ? "↑ Increase" : payrollChange ? "↓ Decrease" : undefined} />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Base vs Final Salary</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={salaryCompareData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Base Salary" fill="hsl(210,80%,52%)" radius={[4,4,0,0]} />
                    <Bar dataKey="Final Salary" fill="hsl(152,60%,40%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={attendanceBarData}>
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

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Payroll by Department</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={deptPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ৳${value.toLocaleString()}`}>
                      {deptPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Comparison Table */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Month-over-Month Comparison</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Last Month</TableHead>
                      <TableHead className="text-right">This Month</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map(c => (
                      <TableRow key={c.name}>
                        <TableCell className="text-sm">{c.name}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{formatCurrency(c.lastMonth)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{formatCurrency(c.thisMonth)}</TableCell>
                        <TableCell className={`text-right text-xs font-mono font-bold ${c.diff >= 0 ? "text-success" : "text-destructive"}`}>
                          {c.diff >= 0 ? "+" : ""}{formatCurrency(c.diff)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Review Sheet */}
      {reviewTarget && (
        <SalaryReviewSheet
          open={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          employeeId={reviewTarget.user_id}
          employeeName={reviewTarget.full_name}
          department={reviewTarget.department}
          baseSalary={reviewTarget.salary || 0}
          month={parseInt(month)}
          year={parseInt(year)}
          workingDays={workingDays}
          record={reviewTarget.record}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
