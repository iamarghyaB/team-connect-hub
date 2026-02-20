import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: "owner" | "employee" | "super_admin";
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;
  if (allowedRole && role !== allowedRole) {
    const redirectPath = role === "super_admin" ? "/admin" : role === "owner" ? "/owner" : "/employee";
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
