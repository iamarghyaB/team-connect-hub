import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { DollarSign } from "lucide-react";

const MONTHS = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

export default function EmployeeSalary() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("salary_records").select("*").eq("employee_id", user.id).order("year", { ascending: false }).order("month", { ascending: false }).then(({ data }) => {
      if (data) setRecords(data);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Salary History</h1>
      {records.length === 0 ? (
        <EmptyState title="No salary records" description="Your salary records will appear here." icon={DollarSign} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Paid Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{MONTHS[r.month]} {r.year}</TableCell>
                  <TableCell className="font-medium">${r.amount?.toLocaleString()}</TableCell>
                  <TableCell>{r.is_paid ? <Badge className="bg-success/10 text-success border-0">Paid</Badge> : <Badge variant="outline">Unpaid</Badge>}</TableCell>
                  <TableCell>{r.paid_date || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
