import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { calculateSalary, formatCurrency, type SalaryBreakdown } from "@/lib/salaryCalculation";
import { Check, AlertTriangle, Plus, Minus, History, ShieldCheck, Lock, Unlock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUSES = ["present", "absent", "leave", "half_day"];

interface AttendanceDay {
  id: string;
  date: string;
  status: string;
  marked_by: string | null;
  note: string | null;
  edited?: boolean;
  originalStatus?: string;
}

interface Adjustment {
  id?: string;
  type: "bonus" | "deduction";
  amount: number;
  reason: string;
  isNew?: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  done_by: string;
  reason: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  department: string | null;
  baseSalary: number;
  month: number;
  year: number;
  workingDays: number;
  record: any;
  onRefresh: () => void;
}

export default function SalaryReviewSheet({
  open, onClose, employeeId, employeeName, department,
  baseSalary, month, year, workingDays, record, onRefresh
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [editReasons, setEditReasons] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState(record?.review_note || "");
  const [reviewChecked, setReviewChecked] = useState(false);
  const [newAdj, setNewAdj] = useState<{ type: "bonus" | "deduction"; amount: string; reason: string }>({ type: "bonus", amount: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approvedLeaves, setApprovedLeaves] = useState<any[]>([]);
  const [unlockReason, setUnlockReason] = useState("");

  const isLocked = record?.is_locked || record?.stage === "approved" || record?.stage === "paid";

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [attRes, adjRes, auditRes, leaveRes, editsRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("employee_id", employeeId).gte("date", startDate).lte("date", endDate).order("date"),
      supabase.from("salary_adjustments").select("*").eq("employee_id", employeeId).eq("month", month).eq("year", year),
      supabase.from("salary_audit_log").select("*").eq("employee_id", employeeId).eq("month", month).eq("year", year).order("created_at", { ascending: false }),
      supabase.from("leave_requests").select("*").eq("employee_id", employeeId).eq("status", "approved"),
      supabase.from("attendance_edits_log").select("*").eq("employee_id", employeeId).gte("date", startDate).lte("date", endDate),
    ]);

    setAttendance((attRes.data || []).map(a => {
      const edit = (editsRes.data || []).find(e => e.attendance_id === a.id);
      return { ...a, edited: !!edit, originalStatus: edit?.original_status };
    }));
    setAdjustments((adjRes.data || []).map(a => ({ id: a.id, type: a.type as "bonus" | "deduction", amount: a.amount, reason: a.reason })));
    setAuditLog(auditRes.data || []);
    setApprovedLeaves(leaveRes.data || []);
    setLoading(false);
  }, [open, employeeId, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute salary breakdown from current attendance state
  const breakdown = useMemo(() => {
    const summary = {
      present: attendance.filter(a => a.status === "present").length,
      absent: attendance.filter(a => a.status === "absent").length,
      leave: attendance.filter(a => a.status === "leave").length,
      half_day: attendance.filter(a => a.status === "half_day").length,
    };
    const approvedLeaveDays = approvedLeaves.reduce((count, l) => {
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      let days = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() + 1 === month && d.getFullYear() === year) days++;
      }
      return count + days;
    }, 0);
    return calculateSalary(baseSalary, summary, workingDays, approvedLeaveDays);
  }, [attendance, baseSalary, workingDays, approvedLeaves, month, year]);

  const totalBonus = useMemo(() => adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + a.amount, 0), [adjustments]);
  const totalExtraDeduction = useMemo(() => adjustments.filter(a => a.type === "deduction").reduce((s, a) => s + a.amount, 0), [adjustments]);
  const finalWithAdjustments = breakdown.finalSalary + totalBonus - totalExtraDeduction;

  // Warnings
  const warnings = useMemo(() => {
    const w: { type: "warning" | "error" | "success"; message: string }[] = [];
    const totalDays = new Date(year, month, 0).getDate();
    const accounted = attendance.length;
    if (accounted === totalDays) w.push({ type: "success", message: `Attendance Days Match: ${accounted}/${totalDays} days accounted for` });
    else w.push({ type: "warning", message: `Only ${accounted}/${totalDays} days have attendance records` });

    const approvedLeaveCount = approvedLeaves.filter(l => l.employee_id === employeeId).length;
    if (approvedLeaveCount > 0) w.push({ type: "success", message: `${approvedLeaveCount} approved leave request(s) included` });

    const editedDays = attendance.filter(a => a.edited);
    if (editedDays.length > 0) w.push({ type: "warning", message: `${editedDays.length} day(s) manually edited by owner` });

    if (totalBonus > 0) w.push({ type: "success", message: `Bonus added: ${formatCurrency(totalBonus)}` });
    if (totalExtraDeduction > 0) w.push({ type: "error", message: `Deduction applied: -${formatCurrency(totalExtraDeduction)}` });

    const absentCount = breakdown.absentDays;
    if (absentCount >= 8) w.push({ type: "warning", message: `Employee had ${absentCount} absents this month - unusual` });

    const leaveDaysInAtt = attendance.filter(a => a.status === "leave").length;
    if (leaveDaysInAtt > 0 && approvedLeaveCount === 0) w.push({ type: "warning", message: "Leave taken but no approved leave request found" });

    if (breakdown.halfDays > 3) w.push({ type: "warning", message: `More than 3 half days detected (${breakdown.halfDays})` });

    return w;
  }, [attendance, approvedLeaves, breakdown, totalBonus, totalExtraDeduction, employeeId, month, year]);

  const changeAttendanceStatus = async (att: AttendanceDay, newStatus: string) => {
    const reason = editReasons[att.date];
    if (!reason?.trim()) {
      toast({ title: "Reason required", description: "Please enter a reason for this change.", variant: "destructive" });
      return;
    }

    // Update attendance
    const { error } = await supabase.from("attendance").update({ status: newStatus }).eq("id", att.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // Log the edit
    await supabase.from("attendance_edits_log").insert({
      attendance_id: att.id, employee_id: employeeId, date: att.date,
      original_status: att.originalStatus || att.status, new_status: newStatus,
      changed_by: user!.id, reason: reason.trim(),
    });

    // Audit log
    await supabase.from("salary_audit_log").insert({
      salary_record_id: record?.id, employee_id: employeeId, month, year,
      action: `Attendance changed for ${att.date}`,
      old_value: att.status, new_value: newStatus,
      done_by: user!.id, reason: reason.trim(),
    });

    setEditReasons(prev => ({ ...prev, [att.date]: "" }));
    toast({ title: "Attendance updated" });
    fetchData();
  };

  const addAdjustment = async () => {
    const amount = parseFloat(newAdj.amount);
    if (!amount || amount <= 0 || !newAdj.reason.trim()) {
      toast({ title: "Invalid", description: "Enter a valid amount and reason.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("salary_adjustments").insert({
      salary_record_id: record?.id, employee_id: employeeId, month, year,
      type: newAdj.type, amount, reason: newAdj.reason.trim(), added_by: user!.id,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    await supabase.from("salary_audit_log").insert({
      salary_record_id: record?.id, employee_id: employeeId, month, year,
      action: `${newAdj.type === "bonus" ? "Bonus" : "Deduction"} added: ${formatCurrency(amount)}`,
      old_value: null, new_value: String(amount), done_by: user!.id, reason: newAdj.reason.trim(),
    });

    setNewAdj({ type: "bonus", amount: "", reason: "" });
    toast({ title: "Adjustment added" });
    fetchData();
  };

  const removeAdjustment = async (adj: Adjustment) => {
    if (!adj.id) return;
    await supabase.from("salary_adjustments").delete().eq("id", adj.id);
    await supabase.from("salary_audit_log").insert({
      salary_record_id: record?.id, employee_id: employeeId, month, year,
      action: `${adj.type} removed: ${formatCurrency(adj.amount)}`,
      old_value: String(adj.amount), new_value: null, done_by: user!.id, reason: "Removed adjustment",
    });
    toast({ title: "Adjustment removed" });
    fetchData();
  };

  const saveAndApprove = async () => {
    setSaving(true);
    const b = breakdown;
    const { error } = await supabase.from("salary_records").upsert({
      employee_id: employeeId, month, year,
      amount: finalWithAdjustments, base_salary: b.baseSalary,
      total_working_days: b.totalWorkingDays, present_days: b.presentDays,
      absent_days: b.absentDays, leave_days: b.leaveDays, half_days: b.halfDays,
      per_day_rate: b.perDayRate, present_amount: b.presentAmount,
      half_day_amount: b.halfDayAmount, leave_amount: b.leaveAmount,
      deduction_amount: b.deductionAmount, final_salary: finalWithAdjustments,
      bonus_total: totalBonus, deduction_extra_total: totalExtraDeduction,
      stage: "approved", reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
      approved_by: user!.id, approved_at: new Date().toISOString(),
      review_note: reviewNote, is_locked: true,
      is_paid: false, generated_at: new Date().toISOString(),
    }, { onConflict: "employee_id,month,year" });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }

    await supabase.from("salary_audit_log").insert({
      salary_record_id: record?.id, employee_id: employeeId, month, year,
      action: "Salary Approved", old_value: null,
      new_value: String(finalWithAdjustments), done_by: user!.id,
      reason: reviewNote || "Approved after review",
    });

    toast({ title: "Salary approved & locked" });
    setSaving(false);
    onRefresh();
    onClose();
  };

  const saveReview = async () => {
    setSaving(true);
    const b = breakdown;
    const { error } = await supabase.from("salary_records").upsert({
      employee_id: employeeId, month, year,
      amount: finalWithAdjustments, base_salary: b.baseSalary,
      total_working_days: b.totalWorkingDays, present_days: b.presentDays,
      absent_days: b.absentDays, leave_days: b.leaveDays, half_days: b.halfDays,
      per_day_rate: b.perDayRate, present_amount: b.presentAmount,
      half_day_amount: b.halfDayAmount, leave_amount: b.leaveAmount,
      deduction_amount: b.deductionAmount, final_salary: finalWithAdjustments,
      bonus_total: totalBonus, deduction_extra_total: totalExtraDeduction,
      stage: "under_review", reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
      review_note: reviewNote, is_locked: false,
      is_paid: false, generated_at: new Date().toISOString(),
    }, { onConflict: "employee_id,month,year" });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }

    await supabase.from("salary_audit_log").insert({
      salary_record_id: record?.id, employee_id: employeeId, month, year,
      action: "Salary saved for review", old_value: null,
      new_value: String(finalWithAdjustments), done_by: user!.id,
      reason: reviewNote || "Under review",
    });

    toast({ title: "Saved for review" });
    setSaving(false);
    onRefresh();
  };

  const handleUnlock = async () => {
    if (!unlockReason.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    await supabase.from("salary_records").update({ is_locked: false, stage: "under_review" }).eq("id", record.id);
    await supabase.from("salary_audit_log").insert({
      salary_record_id: record.id, employee_id: employeeId, month, year,
      action: "Salary unlocked (super-override)", old_value: "locked", new_value: "unlocked",
      done_by: user!.id, reason: unlockReason.trim(),
    });
    toast({ title: "Salary unlocked" });
    setUnlockReason("");
    onRefresh();
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "present": return "bg-success/10 text-success border-0";
      case "absent": return "bg-destructive/10 text-destructive border-0";
      case "leave": return "bg-warning/10 text-warning border-0";
      case "half_day": return "bg-info/10 text-info border-0";
      default: return "";
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full overflow-hidden p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle className="flex items-center gap-2 font-display">
            Review: {employeeName}
            {isLocked && <Badge className="bg-warning/10 text-warning border-0"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{department || "N/A"} • {MONTHS[month - 1]} {year}</p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-6 pt-2 space-y-6">
            <Tabs defaultValue="attendance">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              {/* ATTENDANCE TAB */}
              <TabsContent value="attendance" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Day-by-Day Attendance</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[90px]">Date</TableHead>
                            <TableHead className="w-[50px]">Day</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Note</TableHead>
                            {!isLocked && <TableHead>Change</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendance.map(att => {
                            const d = new Date(att.date + "T00:00:00");
                            const dayName = d.toLocaleDateString("en", { weekday: "short" });
                            return (
                              <TableRow key={att.id} className={att.edited ? "bg-warning/5" : ""}>
                                <TableCell className="text-xs font-mono">{att.date}</TableCell>
                                <TableCell className="text-xs">{dayName}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Badge className={statusColor(att.status)}>{att.status}</Badge>
                                    {att.edited && (
                                      <span className="text-[10px] text-warning">
                                        (was: {att.originalStatus})
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{att.note || "—"}</TableCell>
                                {!isLocked && (
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <Select
                                        value={att.status}
                                        onValueChange={(val) => {
                                          if (val !== att.status) {
                                            setAttendance(prev => prev.map(a => a.id === att.id ? { ...a, status: val } : a));
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        className="h-7 text-xs"
                                        placeholder="Reason..."
                                        value={editReasons[att.date] || ""}
                                        onChange={(e) => setEditReasons(p => ({ ...p, [att.date]: e.target.value }))}
                                      />
                                      <Button
                                        size="sm" variant="outline" className="h-6 text-xs"
                                        onClick={() => changeAttendanceStatus(att, att.status)}
                                        disabled={!editReasons[att.date]?.trim()}
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                          {attendance.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No attendance records</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ADJUSTMENTS TAB */}
              <TabsContent value="adjustments" className="space-y-4 mt-4">
                {/* Live salary box */}
                <Card className="border-2 border-primary/20">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Auto Calculated:</span><span className="font-mono">{formatCurrency(breakdown.finalSalary)}</span></div>
                    {totalBonus > 0 && <div className="flex justify-between text-success"><span>Bonuses:</span><span>+{formatCurrency(totalBonus)}</span></div>}
                    {totalExtraDeduction > 0 && <div className="flex justify-between text-destructive"><span>Extra Deductions:</span><span>-{formatCurrency(totalExtraDeduction)}</span></div>}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg"><span>Final Salary:</span><span className="text-success">{formatCurrency(finalWithAdjustments)} ✅</span></div>
                  </CardContent>
                </Card>

                {/* Existing adjustments */}
                {adjustments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Current Adjustments</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {adjustments.map((adj, i) => (
                        <div key={adj.id || i} className="flex items-center justify-between text-sm border rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            {adj.type === "bonus" ? <Plus className="h-4 w-4 text-success" /> : <Minus className="h-4 w-4 text-destructive" />}
                            <span className={adj.type === "bonus" ? "text-success" : "text-destructive"}>
                              {adj.type === "bonus" ? "+" : "-"}{formatCurrency(adj.amount)}
                            </span>
                            <span className="text-muted-foreground">— {adj.reason}</span>
                          </div>
                          {!isLocked && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => removeAdjustment(adj)}>Remove</Button>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Add new adjustment */}
                {!isLocked && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Add Adjustment</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Select value={newAdj.type} onValueChange={(v: "bonus" | "deduction") => setNewAdj(p => ({ ...p, type: v }))}>
                          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bonus">+ Bonus</SelectItem>
                            <SelectItem value="deduction">- Deduction</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="number" placeholder="Amount" className="w-[120px]" value={newAdj.amount} onChange={e => setNewAdj(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                      <Input placeholder="Reason (required)" value={newAdj.reason} onChange={e => setNewAdj(p => ({ ...p, reason: e.target.value }))} />
                      <Button size="sm" onClick={addAdjustment} disabled={!newAdj.amount || !newAdj.reason.trim()}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* SUMMARY TAB */}
              <TabsContent value="summary" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cross-Check Summary</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {warnings.map((w, i) => (
                      <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
                        w.type === "success" ? "bg-success/5 text-success" :
                        w.type === "warning" ? "bg-warning/5 text-warning" :
                        "bg-destructive/5 text-destructive"
                      }`}>
                        {w.type === "success" ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> :
                         w.type === "warning" ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> :
                         <Minus className="h-4 w-4 mt-0.5 shrink-0" />}
                        <span>{w.message}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-2 border-primary/20">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Base Salary:</span><span>{formatCurrency(breakdown.baseSalary)}</span></div>
                    <div className="flex justify-between"><span>Present ({breakdown.presentDays}d):</span><span className="text-success">+{formatCurrency(breakdown.presentAmount)}</span></div>
                    <div className="flex justify-between"><span>Half Day ({breakdown.halfDays}d):</span><span className="text-success">+{formatCurrency(breakdown.halfDayAmount)}</span></div>
                    <div className="flex justify-between"><span>Leave ({breakdown.leaveDays}d):</span><span className="text-success">+{formatCurrency(breakdown.leaveAmount)}</span></div>
                    <div className="flex justify-between"><span>Absent ({breakdown.absentDays}d):</span><span className="text-destructive">-{formatCurrency(breakdown.deductionAmount)}</span></div>
                    {totalBonus > 0 && <div className="flex justify-between"><span>Bonuses:</span><span className="text-success">+{formatCurrency(totalBonus)}</span></div>}
                    {totalExtraDeduction > 0 && <div className="flex justify-between"><span>Extra Deductions:</span><span className="text-destructive">-{formatCurrency(totalExtraDeduction)}</span></div>}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg"><span>Final:</span><span className="text-success">{formatCurrency(finalWithAdjustments)}</span></div>
                  </CardContent>
                </Card>

                <Textarea placeholder="Review note (optional)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} />

                {!isLocked && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="review-check" checked={reviewChecked} onCheckedChange={(c) => setReviewChecked(!!c)} />
                      <label htmlFor="review-check" className="text-sm font-medium">I have reviewed and verified this salary ✅</label>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={saveReview} disabled={saving}>
                        <ShieldCheck className="h-4 w-4 mr-1" /> Save Review
                      </Button>
                      <Button onClick={saveAndApprove} disabled={saving || !reviewChecked}>
                        <Check className="h-4 w-4 mr-1" /> {saving ? "Approving..." : "Approve Salary"}
                      </Button>
                    </div>
                  </div>
                )}

                {isLocked && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium flex items-center gap-1"><Lock className="h-4 w-4" /> This salary is locked.</p>
                    <Input placeholder="Reason to unlock (mandatory)" value={unlockReason} onChange={e => setUnlockReason(e.target.value)} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={!unlockReason.trim()}>
                          <Unlock className="h-4 w-4 mr-1" /> Super Override: Unlock
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unlock Salary?</AlertDialogTitle>
                          <AlertDialogDescription>This will unlock {employeeName}'s salary for {MONTHS[month - 1]} {year}. This action is logged permanently.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleUnlock}>Unlock</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </TabsContent>

              {/* HISTORY TAB */}
              <TabsContent value="history" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><History className="h-4 w-4" /> Audit Log</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Timestamp</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Old</TableHead>
                            <TableHead>New</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLog.map(log => (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs font-mono">{new Date(log.created_at).toLocaleString()}</TableCell>
                              <TableCell className="text-xs font-medium">{log.action}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{log.old_value || "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{log.new_value || "—"}</TableCell>
                              <TableCell className="text-xs">{log.reason || "—"}</TableCell>
                            </TableRow>
                          ))}
                          {auditLog.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit entries yet</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
