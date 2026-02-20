import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, CalendarDays, Megaphone, Clock, DollarSign,
  ListTodo, MessageSquare, User, LogOut, Menu, X, Moon, Sun,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const ownerNav: NavItem[] = [
  { label: "Dashboard", href: "/owner", icon: LayoutDashboard },
  { label: "Employees", href: "/owner/employees", icon: Users },
  { label: "Leave Requests", href: "/owner/leaves", icon: CalendarDays },
  { label: "Notices", href: "/owner/notices", icon: Megaphone },
  { label: "Attendance", href: "/owner/attendance", icon: Clock },
  { label: "Salary", href: "/owner/salary", icon: DollarSign },
  { label: "Tasks", href: "/owner/tasks", icon: ListTodo },
  { label: "Requests", href: "/owner/requests", icon: MessageSquare },
];

const employeeNav: NavItem[] = [
  { label: "Dashboard", href: "/employee", icon: LayoutDashboard },
  { label: "Profile", href: "/employee/profile", icon: User },
  { label: "Leave", href: "/employee/leave", icon: CalendarDays },
  { label: "Notices", href: "/employee/notices", icon: Megaphone },
  { label: "Attendance", href: "/employee/attendance", icon: Clock },
  { label: "Salary", href: "/employee/salary", icon: DollarSign },
  { label: "Tasks", href: "/employee/tasks", icon: ListTodo },
  { label: "Requests", href: "/employee/requests", icon: MessageSquare },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const navItems = role === "owner" ? ownerNav : employeeNav;

  const toggleDark = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth/login");
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <LayoutDashboard className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-sidebar-accent-foreground">StaffHub</span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {profile?.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{profile?.full_name || "User"}</p>
              <p className="text-xs text-sidebar-foreground capitalize">{role}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground hover:text-destructive hover:bg-sidebar-accent" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggleDark}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
