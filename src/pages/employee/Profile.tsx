import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Save } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeProfile() {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setProfile(data); setPhone(data.phone || ""); setAddress(data.address || ""); }
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    const { error } = await supabase.from("profiles").update({ phone, address }).eq("user_id", user!.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Profile updated" });
  };

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Profile</h1>
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary font-display">
              {profile?.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <CardTitle>{profile?.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{profile?.position || "No position"} · {profile?.department || "No department"}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{profile?.email}</p></div>
            <div><p className="text-sm text-muted-foreground">Joining Date</p><p className="font-medium">{profile?.joining_date ? format(new Date(profile.joining_date), "MMM d, yyyy") : "—"}</p></div>
            <div><p className="text-sm text-muted-foreground">Salary</p><p className="font-medium">${profile?.salary?.toLocaleString() || "—"}</p></div>
            <div><p className="text-sm text-muted-foreground">Status</p><p className="font-medium">{profile?.is_active ? "Active" : "Inactive"}</p></div>
          </div>
          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold font-display">Edit Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            </div>
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
