import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { DollarSign, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/salaryCalculation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

export default function EmployeeSalary() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("salary_records").select("*").eq("employee_id", user.id).order("year", { ascending: false }).order("month", { ascending: false }).then(({ data }) => {
      if (data) setRecords(data);
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
        <tr class="total"><td class="bold">Final Payable</td><td class="right bold green">${formatCurrency(r.final_salary || r.amount || 0)}</td></tr>
      </table>
      <p style="margin-top:32px;color:#888;font-size:12px">Generated on ${new Date().toLocaleDateString()}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Salary History</h1>
      {records.length === 0 ? (
        <EmptyState title="No salary records" description="Your salary records will appear here." icon={DollarSign} />
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const isExpanded = expandedId === r.id;
            const hasBD = r.base_salary != null; // has breakdown data
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
                        <Badge variant="outline">Unpaid</Badge>
                      )}
                      {hasBD && (
                        <div className="flex gap-2 ml-auto flex-wrap">
                          <Badge className="bg-success/10 text-success border-0">{r.present_days}P</Badge>
                          <Badge className="bg-destructive/10 text-destructive border-0">{r.absent_days}A</Badge>
                          <Badge className="bg-warning/10 text-warning border-0">{r.leave_days}L</Badge>
                          <Badge className="bg-info/10 text-info border-0">{r.half_days}H</Badge>
                        </div>
                      )}
                      {r.deduction_amount > 0 && (
                        <span className="text-xs text-destructive">-{formatCurrency(r.deduction_amount)}</span>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {hasBD && (
                      <div className="border-t p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span>Base Salary:</span><span>{formatCurrency(r.base_salary)}</span></div>
                        <div className="flex justify-between"><span>Working Days:</span><span>{r.total_working_days}</span></div>
                        <div className="flex justify-between"><span>Per Day Rate:</span><span>{formatCurrency(r.per_day_rate)}</span></div>
                        <div className="border-t my-2" />
                        <div className="flex justify-between"><span>Present ({r.present_days}d):</span><span className="text-success">+{formatCurrency(r.present_amount)}</span></div>
                        <div className="flex justify-between"><span>Half Day ({r.half_days}d):</span><span className="text-success">+{formatCurrency(r.half_day_amount)}</span></div>
                        <div className="flex justify-between"><span>Approved Leave ({r.leave_days}d):</span><span className="text-success">+{formatCurrency(r.leave_amount)}</span></div>
                        <div className="flex justify-between"><span>Absent Deduction ({r.absent_days}d):</span><span className="text-destructive">-{formatCurrency(r.deduction_amount)}</span></div>
                        <div className="border-t pt-2 flex justify-between font-bold"><span>Final Payable:</span><span className="text-success">{formatCurrency(r.final_salary)}</span></div>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => printSlip(r)}>
                          <Printer className="h-4 w-4 mr-1" /> Download Salary Slip
                        </Button>
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
