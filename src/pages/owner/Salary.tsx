import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { DollarSign, Check } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function OwnerSalary() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const { toast } = useToast();

  const fetchData = async () => {
    const [salRes, empRes] = await Promise.all([
      supabase.from("salary_records").select("*, profiles!salary_records_employee_id_fkey(full_name)").eq("month", parseInt(month)).eq("year", parseInt(year)),
      supabase.from("profiles").select("user_id, full_name, salary").eq("is_active", true),
    ]);
    if (salRes.data) setRecords(salRes.data);
    if (empRes.data) setEmployees(empRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [month, year]);

  const markPaid = async (employeeId: string, salary: number) => {
    const { error } = await supabase.from("salary_records").upsert({
      employee_id: employeeId, month: parseInt(month), year: parseInt(year),
      amount: salary, is_paid: true, paid_date: new Date().toISOString().split("T")[0],
    }, { onConflict: "employee_id,month,year" });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salary marked as paid" }); fetchData();
  };

  const getRecord = (userId: string) => records.find(r => r.employee_id === userId);

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold font-display">Salary Management</h1>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {employees.length === 0 ? (
        <EmptyState title="No employees" description="Add employees first." icon={DollarSign} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => {
                const rec = getRecord(emp.user_id);
                return (
                  <TableRow key={emp.user_id}>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell>${emp.salary?.toLocaleString() || "N/A"}</TableCell>
                    <TableCell>
                      {rec?.is_paid ? (
                        <Badge className="bg-success/10 text-success border-0">Paid</Badge>
                      ) : (
                        <Badge variant="outline">Unpaid</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!rec?.is_paid && emp.salary && (
                        <Button size="sm" onClick={() => markPaid(emp.user_id, emp.salary)}>
                          <Check className="h-4 w-4 mr-1" /> Mark Paid
                        </Button>
                      )}
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
