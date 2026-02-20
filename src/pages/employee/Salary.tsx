import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmptyState from "@/components/shared/EmptyState";
import { DollarSign, Printer, History, Plus, Minus, Lock } from "lucide-react";
import { formatCurrency } from "@/lib/salaryCalculation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

export default function EmployeeSalary() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("salary_records").select("*").eq("employee_id", user.id)
        .in("stage", ["approved", "paid"])
        .order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("salary_adjustments").select("*").eq("employee_id", user.id),
      supabase.from("salary_audit_log").select("*").eq("employee_id", user.id).order("created_at", { ascending: false }),
    ]).then(([salRes, adjRes, auditRes]) => {
      if (salRes.data) setRecords(salRes.data);
      if (adjRes.data) setAdjustments(adjRes.data);
      if (auditLog) setAuditLog(auditRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const printSlip = (r: any) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Salary Slip - ${MONTHS[r.month]} ${r.year}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:auto}
      h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      td{padding:8px 4px;border-bottom:1px solid #eee}
      .right{text-align:right}.bold{font-weight:bold}
      .total{border-top:2px solid #333;font-size:18px}
      .green{color:#2e7d32}</style></head><body>
      <h1>Salary Slip</h1>
      <p>${MONTHS[r.month]} ${r.year}</p>
      <table>
        <tr><td>Base Salary</td><td class="right">${formatCurrency(r.base_salary || r.amount || 0)}</td></tr>
        <tr><td>Working Days</td><td class="right">${r.total_working_days || "—"}</td></tr>
        <tr><td>Per Day Rate</td><td class="right">${formatCurrency(r.per_day_rate || 0)}</td></tr>
        <tr><td colspan="2" style="height:12px"></td></tr>
        <tr><td>Present (${r.present_days || 0}d)</td><td class="right">+${formatCurrency(r.present_amount || 0)}</td></tr>
        <tr><td>Half Day (${r.half_days || 0}d)</td><td class="right">+${formatCurrency(r.half_day_amount || 0)}</td></tr>
        <tr><td>Approved Leave (${r.leave_days || 0}d)</td><td class="right">+${formatCurrency(r.leave_amount || 0)}</td></tr>
        <tr><td>Absent Deduction (${r.absent_days || 0}d)</td><td class="right" style="color:#c62828">-${formatCurrency(r.deduction_amount || 0)}</td></tr>
        ${(r.bonus_total || 0) > 0 ? `<tr><td>Bonuses</td><td class="right" style="color:#2e7d32">+${formatCurrency(r.bonus_total)}</td></tr>` : ""}
        ${(r.deduction_extra_total || 0) > 0 ? `<tr><td>Extra Deductions</td><td class="right" style="color:#c62828">-${formatCurrency(r.deduction_extra_total)}</td></tr>` : ""}
        <tr class="total"><td class="bold">Final Payable</td><td class="right bold green">${formatCurrency(r.final_salary || r.amount || 0)}</td></tr>
      </table>
      <p style="margin-top:32px;color:#888;font-size:12px">Generated on ${new Date().toLocaleDateString()}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  const getRecordAdj = (r: any) => adjustments.filter(a => a.month === r.month && a.year === r.year);
  const getRecordAudit = (r: any) => auditLog.filter(a => a.month === r.month && a.year === r.year);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Salary History</h1>
      {records.length === 0 ? (
        <EmptyState title="No salary records" description="Your approved salary records will appear here." icon={DollarSign} />
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const isExpanded = expandedId === r.id;
            const hasBD = r.base_salary != null;
            const adj = getRecordAdj(r);
            const audit = getRecordAudit(r);

            return (
              <Collapsible key={r.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : r.id)}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <div className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="min-w-[140px]">
                        <p className="font-medium text-sm">{MONTHS[r.month]} {r.year}</p>
                      </div>
                      <span className="font-bold text-sm">{formatCurrency(r.final_salary || r.amount || 0)}</span>
                      {r.is_paid ? (
                        <Badge className="bg-success/10 text-success border-0">Paid</Badge>
                      ) : (
                        <Badge className="bg-info/10 text-info border-0">Approved</Badge>
                      )}
                      {r.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {hasBD && (
                        <div className="flex gap-2 ml-auto flex-wrap">
                          <Badge className="bg-success/10 text-success border-0">{r.present_days}P</Badge>
                          <Badge className="bg-destructive/10 text-destructive border-0">{r.absent_days}A</Badge>
                          <Badge className="bg-warning/10 text-warning border-0">{r.leave_days}L</Badge>
                          <Badge className="bg-info/10 text-info border-0">{r.half_days}H</Badge>
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {hasBD && (
                      <div className="border-t p-4">
                        <Tabs defaultValue="breakdown">
                          <TabsList className="grid grid-cols-3 w-full max-w-sm">
                            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                            <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                            <TabsTrigger value="history">History</TabsTrigger>
                          </TabsList>

                          <TabsContent value="breakdown" className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between"><span>Base Salary:</span><span>{formatCurrency(r.base_salary)}</span></div>
                            <div className="flex justify-between"><span>Working Days:</span><span>{r.total_working_days}</span></div>
                            <div className="flex justify-between"><span>Per Day Rate:</span><span>{formatCurrency(r.per_day_rate)}</span></div>
                            <div className="border-t my-2" />
                            <div className="flex justify-between"><span>Present ({r.present_days}d):</span><span className="text-success">+{formatCurrency(r.present_amount)}</span></div>
                            <div className="flex justify-between"><span>Half Day ({r.half_days}d):</span><span className="text-success">+{formatCurrency(r.half_day_amount)}</span></div>
                            <div className="flex justify-between"><span>Approved Leave ({r.leave_days}d):</span><span className="text-success">+{formatCurrency(r.leave_amount)}</span></div>
                            <div className="flex justify-between"><span>Absent Deduction ({r.absent_days}d):</span><span className="text-destructive">-{formatCurrency(r.deduction_amount)}</span></div>
                            {(r.bonus_total || 0) > 0 && <div className="flex justify-between"><span>Bonuses:</span><span className="text-success">+{formatCurrency(r.bonus_total)}</span></div>}
                            {(r.deduction_extra_total || 0) > 0 && <div className="flex justify-between"><span>Extra Deductions:</span><span className="text-destructive">-{formatCurrency(r.deduction_extra_total)}</span></div>}
                            <div className="border-t pt-2 flex justify-between font-bold"><span>Final Payable:</span><span className="text-success">{formatCurrency(r.final_salary)}</span></div>
                            <Button size="sm" variant="outline" className="mt-2" onClick={() => printSlip(r)}>
                              <Printer className="h-4 w-4 mr-1" /> Download Salary Slip
                            </Button>
                          </TabsContent>

                          <TabsContent value="adjustments" className="mt-3">
                            {adj.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4">No adjustments for this month.</p>
                            ) : (
                              <div className="space-y-2">
                                {adj.map(a => (
                                  <div key={a.id} className="flex items-center gap-2 text-sm p-2 border rounded-lg">
                                    {a.type === "bonus" ? <Plus className="h-4 w-4 text-success" /> : <Minus className="h-4 w-4 text-destructive" />}
                                    <span className={a.type === "bonus" ? "text-success" : "text-destructive"}>
                                      {a.type === "bonus" ? "+" : "-"}{formatCurrency(a.amount)}
                                    </span>
                                    <span className="text-muted-foreground">— {a.reason}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="history" className="mt-3">
                            {audit.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4">No audit history.</p>
                            ) : (
                              <ScrollArea className="max-h-[300px]">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Time</TableHead>
                                      <TableHead className="text-xs">Action</TableHead>
                                      <TableHead className="text-xs">Reason</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {audit.map(log => (
                                      <TableRow key={log.id}>
                                        <TableCell className="text-xs font-mono">{new Date(log.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-xs">{log.action}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{log.reason || "—"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </ScrollArea>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
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
