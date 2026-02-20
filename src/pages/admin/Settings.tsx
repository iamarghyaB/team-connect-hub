import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">System Settings</h1>
        <p className="text-muted-foreground mt-1">Manage system-wide configuration</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Departments are currently managed inline. Available departments: Engineering, Marketing, Sales, HR, Finance, Operations, Design.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">StaffHub v1.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Backend</span>
              <span className="font-medium">Lovable Cloud</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
