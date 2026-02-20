import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import DashboardLayout from "./components/shared/DashboardLayout";

import OwnerDashboard from "./pages/owner/Dashboard";
import Employees from "./pages/owner/Employees";
import OwnerLeaves from "./pages/owner/Leaves";
import OwnerNotices from "./pages/owner/Notices";
import OwnerAttendance from "./pages/owner/Attendance";
import OwnerSalary from "./pages/owner/Salary";
import OwnerTasks from "./pages/owner/Tasks";
import OwnerRequests from "./pages/owner/Requests";

import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeProfile from "./pages/employee/Profile";
import EmployeeLeave from "./pages/employee/Leave";
import EmployeeNotices from "./pages/employee/Notices";
import EmployeeAttendance from "./pages/employee/Attendance";
import EmployeeSalary from "./pages/employee/Salary";
import EmployeeTasks from "./pages/employee/Tasks";
import EmployeeRequests from "./pages/employee/Requests";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminRoles from "./pages/admin/Roles";
import AdminSettings from "./pages/admin/Settings";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function HomeRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (role === "super_admin") return <Navigate to="/admin" replace />;
  return <Navigate to={role === "owner" ? "/owner" : "/employee"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />

            {/* Owner Routes */}
            <Route path="/owner" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><OwnerDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/owner/employees" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><Employees /></DashboardLayout></ProtectedRoute>} />
            <Route path="/owner/leaves" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><OwnerLeaves /></DashboardLayout></ProtectedRoute>} />
            <Route path="/owner/notices" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><OwnerNotices /></DashboardLayout></ProtectedRoute>} />
            <Route path="/owner/attendance" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><OwnerAttendance /></DashboardLayout></ProtectedRoute>} />
            <Route path="/owner/salary" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><OwnerSalary /></DashboardLayout></ProtectedRoute>} />
            <Route path="/owner/tasks" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><OwnerTasks /></DashboardLayout></ProtectedRoute>} />
            <Route path="/owner/requests" element={<ProtectedRoute allowedRole="owner"><DashboardLayout><OwnerRequests /></DashboardLayout></ProtectedRoute>} />

            {/* Employee Routes */}
            <Route path="/employee" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/employee/profile" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeProfile /></DashboardLayout></ProtectedRoute>} />
            <Route path="/employee/leave" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeLeave /></DashboardLayout></ProtectedRoute>} />
            <Route path="/employee/notices" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeNotices /></DashboardLayout></ProtectedRoute>} />
            <Route path="/employee/attendance" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeAttendance /></DashboardLayout></ProtectedRoute>} />
            <Route path="/employee/salary" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeSalary /></DashboardLayout></ProtectedRoute>} />
            <Route path="/employee/tasks" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeTasks /></DashboardLayout></ProtectedRoute>} />
            <Route path="/employee/requests" element={<ProtectedRoute allowedRole="employee"><DashboardLayout><EmployeeRequests /></DashboardLayout></ProtectedRoute>} />

            {/* Super Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><AdminDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><AdminUsers /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><AdminRoles /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/employees" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><Employees /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/leaves" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><OwnerLeaves /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/notices" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><OwnerNotices /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><OwnerAttendance /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/salary" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><OwnerSalary /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/tasks" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><OwnerTasks /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/requests" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><OwnerRequests /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute allowedRole="super_admin"><DashboardLayout><AdminSettings /></DashboardLayout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
