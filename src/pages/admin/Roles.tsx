import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Shield } from "lucide-react";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

interface ProfileInfo {
  user_id: string;
  full_name: string;
  email: string;
}

export default function AdminRoles() {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRoles = async () => {
    const [rolesRes, profilesRes] = await Promise.all([
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, email"),
    ]);
    if (rolesRes.data) setUserRoles(rolesRes.data as UserRole[]);
    const map: Record<string, ProfileInfo> = {};
    profilesRes.data?.forEach(p => { map[p.user_id] = p; });
    setProfiles(map);
    setLoading(false);
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleRoleChange = async (userId: string, newRole: "owner" | "employee" | "super_admin") => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Role updated successfully" });
    fetchRoles();
  };

  const roleColor = (role: string) => {
    if (role === "super_admin") return "destructive";
    if (role === "owner") return "default";
    return "secondary";
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Role Management</h1>
        <p className="text-muted-foreground mt-1">Change user roles across the system</p>
      </div>
      {userRoles.length === 0 ? (
        <EmptyState title="No users" description="No users found." icon={Shield} />
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userRoles.map(ur => (
                <TableRow key={ur.id}>
                  <TableCell className="font-medium">{profiles[ur.user_id]?.full_name || "Unknown"}</TableCell>
                  <TableCell>{profiles[ur.user_id]?.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={roleColor(ur.role) as any} className="capitalize">{ur.role.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={ur.role} onValueChange={(v) => handleRoleChange(ur.user_id, v as "owner" | "employee" | "super_admin")}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
