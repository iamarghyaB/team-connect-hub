import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Megaphone } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeNotices() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("notices").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setNotices(data);
      setLoading(false);
    });
  }, []);

  const priorityColor = (p: string) => p === "urgent" ? "destructive" : p === "high" ? "default" : "secondary";

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Notice Board</h1>
      {notices.length === 0 ? (
        <EmptyState title="No notices" description="No announcements at the moment." icon={Megaphone} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notices.map(n => (
            <Card key={n.id} className="animate-fade-in">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">{n.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, yyyy")}</p>
                </div>
                <Badge variant={priorityColor(n.priority) as any} className="capitalize">{n.priority}</Badge>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{n.content}</p></CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
