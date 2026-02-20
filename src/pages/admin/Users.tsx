import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Users, Search } from "lucide-react";
import { format } from "date-fns";

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  created_at: string;
  role?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap: Record<string, string> = {};
      rolesRes.data?.forEach(r => { roleMap[r.user_id] = r.role; });
      setRoles(roleMap);
      if (profilesRes.data) setUsers(profilesRes.data as UserWithRole[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) => {
    if (role === "super_admin") return "destructive";
    if (role === "owner") return "default";
    return "secondary";
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">All Users</h1>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No users found" description="No users match your search." icon={Users} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleColor(roles[u.user_id] || "employee") as any} className="capitalize">
                      {(roles[u.user_id] || "employee").replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.department || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${u.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>{format(new Date(u.created_at), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
