import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import StatCard from "@/components/shared/StatCard";
import {
  ClipboardList, Plus, Trash2, Copy, Eye, Send, Edit, Users, UserCheck,
  AlertTriangle, CheckCircle2, Clock, BarChart3, Calendar
} from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = ["Meeting", "Development", "Design", "Sales", "Support", "Admin", "Other"];
const PRIORITIES = [
  { value: "high", label: "🔴 High", color: "destructive" },
  { value: "medium", label: "🟡 Medium", color: "default" },
  { value: "low", label: "🟢 Low", color: "secondary" },
] as const;

interface TemplateTask {
  id?: string;
  title: string;
  description: string;
  expected_duration_minutes: number;
  priority: string;
  category: string;
  is_mandatory: boolean;
  repeat_type: string;
  sort_order: number;
}

interface Template {
  id: string;
  template_name: string;
  department: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  tasks?: TemplateTask[];
}

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  department: string | null;
}

interface DailyPlan {
  id: string;
  employee_id: string;
  plan_date: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  note_from_owner: string | null;
}

interface DailyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  employee_note: string | null;
  stuck_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  deadline_time: string | null;
  expected_duration_minutes: number | null;
}

export default function OwnerWorkPlans() {
  const { user } = useAuth();
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Template builder state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDept, setTemplateDept] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateTasks, setTemplateTasks] = useState<TemplateTask[]>([]);

  // Assign state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [assignMode, setAssignMode] = useState<"individual" | "department" | "all">("individual");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assignDate, setAssignDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [assignNote, setAssignNote] = useState("");

  // Tracking state
  const [trackingDate, setTrackingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [trackingFilter, setTrackingFilter] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [planTasks, setPlanTasks] = useState<DailyTask[]>([]);

  // Stats
  const [stats, setStats] = useState({ assigned: 0, completed: 0, stuck: 0, unassigned: 0 });

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (tab === "tracking") fetchPlans();
  }, [tab, trackingDate]);

  const fetchAll = async () => {
    setLoading(true);
    const [tRes, eRes] = await Promise.all([
      supabase.from("work_plan_templates").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, user_id, full_name, department").eq("is_active", true),
    ]);
    setTemplates(tRes.data || []);
    setEmployees(eRes.data || []);
    setLoading(false);
  };

  const fetchPlans = async () => {
    const { data: planData } = await supabase
      .from("daily_work_plans")
      .select("*")
      .eq("plan_date", trackingDate)
      .order("created_at");

    setPlans(planData || []);

    // Calculate stats
    const totalEmp = employees.length;
    const assignedEmp = new Set((planData || []).map(p => p.employee_id)).size;
    const completedPlans = (planData || []).filter(p => p.completion_percentage >= 100).length;
    const stuckCount = 0; // Will be calculated from tasks
    setStats({
      assigned: assignedEmp,
      completed: completedPlans,
      stuck: stuckCount,
      unassigned: totalEmp - assignedEmp,
    });
  };

  // ─── TEMPLATE CRUD ───
  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDept("");
    setTemplateDesc("");
    setTemplateTasks([{ title: "", description: "", expected_duration_minutes: 60, priority: "medium", category: "Other", is_mandatory: false, repeat_type: "daily", sort_order: 0 }]);
    setShowTemplateDialog(true);
  };

  const openEditTemplate = async (t: Template) => {
    setEditingTemplate(t);
    setTemplateName(t.template_name);
    setTemplateDept(t.department || "");
    setTemplateDesc(t.description || "");
    const { data } = await supabase.from("template_tasks").select("*").eq("template_id", t.id).order("sort_order");
    setTemplateTasks(data?.map(d => ({ ...d })) || []);
    setShowTemplateDialog(true);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) { toast({ title: "Template name required", variant: "destructive" }); return; }
    if (templateTasks.length === 0 || !templateTasks[0].title.trim()) { toast({ title: "Add at least one task", variant: "destructive" }); return; }

    const validTasks = templateTasks.filter(t => t.title.trim());

    if (editingTemplate) {
      await supabase.from("work_plan_templates").update({
        template_name: templateName, department: templateDept || null, description: templateDesc || null,
      }).eq("id", editingTemplate.id);
      await supabase.from("template_tasks").delete().eq("template_id", editingTemplate.id);
      await supabase.from("template_tasks").insert(validTasks.map((t, i) => ({
        template_id: editingTemplate.id, title: t.title, description: t.description || null,
        expected_duration_minutes: t.expected_duration_minutes, priority: t.priority, category: t.category,
        is_mandatory: t.is_mandatory, repeat_type: t.repeat_type, sort_order: i,
      })));
      toast({ title: "Template updated" });
    } else {
      const { data } = await supabase.from("work_plan_templates").insert({
        template_name: templateName, department: templateDept || null, description: templateDesc || null,
        created_by: user!.id,
      }).select().single();
      if (data) {
        await supabase.from("template_tasks").insert(validTasks.map((t, i) => ({
          template_id: data.id, title: t.title, description: t.description || null,
          expected_duration_minutes: t.expected_duration_minutes, priority: t.priority, category: t.category,
          is_mandatory: t.is_mandatory, repeat_type: t.repeat_type, sort_order: i,
        })));
      }
      toast({ title: "Template created" });
    }
    setShowTemplateDialog(false);
    fetchAll();
  };

  const duplicateTemplate = async (t: Template) => {
    const { data: tasks } = await supabase.from("template_tasks").select("*").eq("template_id", t.id);
    const { data: newT } = await supabase.from("work_plan_templates").insert({
      template_name: t.template_name + " (Copy)", department: t.department, description: t.description, created_by: user!.id,
    }).select().single();
    if (newT && tasks) {
      await supabase.from("template_tasks").insert(tasks.map(tk => ({
        template_id: newT.id, title: tk.title, description: tk.description,
        expected_duration_minutes: tk.expected_duration_minutes, priority: tk.priority, category: tk.category,
        is_mandatory: tk.is_mandatory, repeat_type: tk.repeat_type, sort_order: tk.sort_order,
      })));
    }
    toast({ title: "Template duplicated" });
    fetchAll();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("work_plan_templates").update({ is_active: false }).eq("id", id);
    toast({ title: "Template deleted" });
    fetchAll();
  };

  // ─── ASSIGN ───
  const handleAssign = async () => {
    if (!assignTemplateId) { toast({ title: "Select a template", variant: "destructive" }); return; }

    const { data: tasks } = await supabase.from("template_tasks").select("*").eq("template_id", assignTemplateId).order("sort_order");
    if (!tasks?.length) { toast({ title: "Template has no tasks", variant: "destructive" }); return; }

    let targetEmployees: Employee[] = [];
    if (assignMode === "individual") {
      const emp = employees.find(e => e.user_id === assignEmployeeId);
      if (emp) targetEmployees = [emp];
    } else if (assignMode === "department") {
      targetEmployees = employees.filter(e => e.department === assignDepartment);
    } else {
      targetEmployees = employees;
    }

    if (!targetEmployees.length) { toast({ title: "No employees selected", variant: "destructive" }); return; }

    let assigned = 0;
    for (const emp of targetEmployees) {
      const { data: plan, error } = await supabase.from("daily_work_plans").upsert({
        employee_id: emp.user_id, plan_date: assignDate, assigned_by: user!.id,
        template_id: assignTemplateId, note_from_owner: assignNote || null,
        total_tasks: tasks.length, completed_tasks: 0, completion_percentage: 0, status: "active",
      }, { onConflict: "employee_id,plan_date" }).select().single();

      if (plan) {
        // Delete existing tasks for this plan before inserting new ones
        await supabase.from("daily_tasks").delete().eq("plan_id", plan.id);
        await supabase.from("daily_tasks").insert(tasks.map((t, i) => ({
          plan_id: plan.id, employee_id: emp.user_id, title: t.title, description: t.description,
          priority: t.priority, category: t.category, is_mandatory: t.is_mandatory,
          expected_duration_minutes: t.expected_duration_minutes, sort_order: i, status: "not_started",
        })));
        assigned++;
      }
    }

    toast({ title: `Plan assigned to ${assigned} employee(s)` });
    setShowAssignDialog(false);
    if (tab === "tracking") fetchPlans();
  };

  // ─── TRACKING ───
  const viewPlanDetails = async (planId: string) => {
    setSelectedPlan(planId);
    const { data } = await supabase.from("daily_tasks").select("*").eq("plan_id", planId).order("sort_order");
    setPlanTasks(data || []);
  };

  const getEmployeeName = (empId: string) => employees.find(e => e.user_id === empId)?.full_name || "Unknown";
  const getEmployeeDept = (empId: string) => employees.find(e => e.user_id === empId)?.department || "—";

  const getProgressColor = (pct: number) => {
    if (pct >= 75) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getRowBg = (pct: number) => {
    if (pct >= 75) return "bg-green-50 dark:bg-green-950/20";
    if (pct >= 50) return "bg-yellow-50 dark:bg-yellow-950/20";
    return "bg-red-50 dark:bg-red-950/20";
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      not_started: { label: "⏳ Not Started", variant: "outline" },
      in_progress: { label: "🔄 In Progress", variant: "default" },
      paused: { label: "⏸ Paused", variant: "secondary" },
      completed: { label: "✅ Done", variant: "secondary" },
      stuck: { label: "🚨 Stuck", variant: "destructive" },
    };
    const s = map[status] || map.not_started;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];

  const filteredPlans = plans.filter(p => {
    if (trackingFilter === "all") return true;
    if (trackingFilter === "high") return p.completion_percentage >= 75;
    if (trackingFilter === "medium") return p.completion_percentage >= 50 && p.completion_percentage < 75;
    if (trackingFilter === "low") return p.completion_percentage < 50;
    return true;
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("work-plans-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_tasks" }, () => {
        if (tab === "tracking") fetchPlans();
        if (selectedPlan) viewPlanDetails(selectedPlan);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_work_plans" }, () => {
        if (tab === "tracking") fetchPlans();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab, selectedPlan, trackingDate]);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Work Plans</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-display">Work Plans & Workflow</h1>
        <div className="flex gap-2">
          <Button onClick={openNewTemplate} size="sm"><Plus className="h-4 w-4 mr-1" /> New Template</Button>
          <Button onClick={() => setShowAssignDialog(true)} variant="secondary" size="sm"><Send className="h-4 w-4 mr-1" /> Assign Plan</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates"><ClipboardList className="h-4 w-4 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="tracking"><BarChart3 className="h-4 w-4 mr-1" /> Tracking</TabsTrigger>
        </TabsList>

        {/* ─── TEMPLATES TAB ─── */}
        <TabsContent value="templates" className="space-y-4">
          {templates.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm">Create a work plan template to get started</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map(t => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{t.template_name}</CardTitle>
                        {t.department && <Badge variant="outline" className="mt-1">{t.department}</Badge>}
                      </div>
                    </div>
                    {t.description && <CardDescription className="mt-2">{t.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-3">Created {format(new Date(t.created_at), "MMM d, yyyy")}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => openEditTemplate(t)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => duplicateTemplate(t)}><Copy className="h-3 w-3 mr-1" /> Duplicate</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTemplate(t.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── TRACKING TAB ─── */}
        <TabsContent value="tracking" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Plans Assigned" value={stats.assigned} icon={Send} />
            <StatCard title="100% Complete" value={stats.completed} icon={CheckCircle2} />
            <StatCard title="Stuck Tasks" value={stats.stuck} icon={AlertTriangle} />
            <StatCard title="Unassigned" value={stats.unassigned} icon={Users} />
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <Input type="date" value={trackingDate} onChange={e => setTrackingDate(e.target.value)} className="w-44" />
            <Select value={trackingFilter} onValueChange={setTrackingFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                <SelectItem value="high">🟢 &gt;75%</SelectItem>
                <SelectItem value="medium">🟡 50-75%</SelectItem>
                <SelectItem value="low">🔴 &lt;50%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPlans.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              No work plans found for this date
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map(p => (
                    <TableRow key={p.id} className={getRowBg(p.completion_percentage)}>
                      <TableCell className="font-medium">{getEmployeeName(p.employee_id)}</TableCell>
                      <TableCell>{getEmployeeDept(p.employee_id)}</TableCell>
                      <TableCell>{p.completed_tasks}/{p.total_tasks}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={p.completion_percentage} className="w-20 h-2" />
                          <span className={`text-sm font-semibold ${getProgressColor(p.completion_percentage)}`}>
                            {Math.round(p.completion_percentage)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => viewPlanDetails(p.id)}>
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Plan detail view */}
          {selectedPlan && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Task Breakdown</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedPlan(null)}>Close</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {planTasks.map(t => (
                    <div key={t.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={t.priority === "high" ? "destructive" : t.priority === "low" ? "secondary" : "default"} className="text-xs">
                            {t.priority === "high" ? "🔴" : t.priority === "low" ? "🟢" : "🟡"} {t.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{t.category}</Badge>
                          {t.deadline_time && <span className="text-xs text-muted-foreground">Due: {t.deadline_time}</span>}
                        </div>
                        <p className="font-medium">{t.title}</p>
                        {t.employee_note && <p className="text-sm text-muted-foreground mt-1">💬 {t.employee_note}</p>}
                        {t.stuck_reason && <p className="text-sm text-destructive mt-1">🚨 Blocked: {t.stuck_reason}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {t.started_at && <span>Started: {format(new Date(t.started_at), "h:mm a")}</span>}
                          {t.completed_at && <span>Done: {format(new Date(t.completed_at), "h:mm a")}</span>}
                        </div>
                      </div>
                      {getStatusBadge(t.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── TEMPLATE BUILDER DIALOG ─── */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Work Plan Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Template Name *</label>
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Sales Team Daily Plan" />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Select value={templateDept} onValueChange={setTemplateDept}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} rows={2} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Tasks</label>
                <Button size="sm" variant="outline" onClick={() => setTemplateTasks([...templateTasks, {
                  title: "", description: "", expected_duration_minutes: 60, priority: "medium",
                  category: "Other", is_mandatory: false, repeat_type: "daily", sort_order: templateTasks.length,
                }])}><Plus className="h-3 w-3 mr-1" /> Add Task</Button>
              </div>
              <div className="space-y-3">
                {templateTasks.map((task, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                      <Input value={task.title} onChange={e => {
                        const arr = [...templateTasks]; arr[i] = { ...arr[i], title: e.target.value }; setTemplateTasks(arr);
                      }} placeholder="Task title" className="flex-1" />
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => setTemplateTasks(templateTasks.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input value={task.description} onChange={e => {
                      const arr = [...templateTasks]; arr[i] = { ...arr[i], description: e.target.value }; setTemplateTasks(arr);
                    }} placeholder="Description (optional)" />
                    <div className="flex gap-2 flex-wrap">
                      <Select value={task.priority} onValueChange={v => {
                        const arr = [...templateTasks]; arr[i] = { ...arr[i], priority: v }; setTemplateTasks(arr);
                      }}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={task.category} onValueChange={v => {
                        const arr = [...templateTasks]; arr[i] = { ...arr[i], category: v }; setTemplateTasks(arr);
                      }}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" value={task.expected_duration_minutes} onChange={e => {
                        const arr = [...templateTasks]; arr[i] = { ...arr[i], expected_duration_minutes: parseInt(e.target.value) || 0 }; setTemplateTasks(arr);
                      }} className="w-24" placeholder="Min" />
                      <div className="flex items-center gap-1.5">
                        <Checkbox checked={task.is_mandatory} onCheckedChange={v => {
                          const arr = [...templateTasks]; arr[i] = { ...arr[i], is_mandatory: !!v }; setTemplateTasks(arr);
                        }} />
                        <span className="text-xs">Mandatory</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={saveTemplate}>{editingTemplate ? "Update" : "Create"} Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ASSIGN DIALOG ─── */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Work Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Template *</label>
              <Select value={assignTemplateId} onValueChange={setAssignTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Assign To</label>
              <Select value={assignMode} onValueChange={v => setAssignMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual Employee</SelectItem>
                  <SelectItem value="department">Entire Department</SelectItem>
                  <SelectItem value="all">All Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignMode === "individual" && (
              <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {assignMode === "department" && (
              <Select value={assignDepartment} onValueChange={setAssignDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div>
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Note for Employee</label>
              <Textarea value={assignNote} onChange={e => setAssignNote(e.target.value)} rows={2} placeholder="Optional instructions..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssign}><Send className="h-4 w-4 mr-1" /> Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
