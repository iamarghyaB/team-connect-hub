import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Play, CheckCircle2, AlertTriangle, Pause, Clock, ClipboardList,
  Plus, Trash2, CalendarDays, BarChart3, Send,
} from "lucide-react";
import { format } from "date-fns";

interface DailyTask {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  priority: string;
  category: string;
  is_mandatory: boolean;
  expected_duration_minutes: number | null;
  deadline_time: string | null;
  status: string;
  employee_note: string | null;
  stuck_reason: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  sort_order: number;
}

interface DailyPlan {
  id: string;
  plan_date: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  note_from_owner: string | null;
}

interface PersonalTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
}

interface DailyReport {
  id: string;
  report_date: string;
  tasks_completed: number;
  tasks_total: number;
  completion_percentage: number;
  employee_notes: string | null;
  blockers_for_tomorrow: string | null;
  submitted_at: string | null;
  is_locked: boolean;
  owner_feedback: string | null;
}

export default function EmployeeWorkPlan() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today");
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);

  // Action dialogs
  const [noteDialog, setNoteDialog] = useState<{ taskId: string; type: "done" | "stuck" } | null>(null);
  const [noteText, setNoteText] = useState("");

  // Personal task
  const [showAddPersonal, setShowAddPersonal] = useState(false);
  const [personalTitle, setPersonalTitle] = useState("");
  const [personalPriority, setPersonalPriority] = useState("medium");

  // Report
  const [reportNotes, setReportNotes] = useState("");
  const [reportBlockers, setReportBlockers] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (user) fetchTodayData();
  }, [user]);

  const fetchTodayData = async () => {
    setLoading(true);
    const [planRes, personalRes, reportRes] = await Promise.all([
      supabase.from("daily_work_plans").select("*").eq("employee_id", user!.id).eq("plan_date", today).maybeSingle(),
      supabase.from("personal_tasks").select("*").eq("employee_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("daily_reports").select("*").eq("employee_id", user!.id).eq("report_date", today).maybeSingle(),
    ]);
    setTodayPlan(planRes.data);
    setPersonalTasks(personalRes.data || []);
    setTodayReport(reportRes.data);

    if (planRes.data) {
      const { data } = await supabase.from("daily_tasks").select("*").eq("plan_id", planRes.data.id).order("sort_order");
      setTasks(data || []);
    } else {
      setTasks([]);
    }
    setLoading(false);
  };

  const updateTaskStatus = async (taskId: string, newStatus: string, note?: string, stuckReason?: string) => {
    const now = new Date().toISOString();
    const updates: any = { status: newStatus };

    if (newStatus === "in_progress") updates.started_at = now;
    if (newStatus === "completed") { updates.completed_at = now; if (note) updates.employee_note = note; }
    if (newStatus === "stuck") { updates.stuck_reason = stuckReason; }
    if (newStatus === "paused") updates.paused_at = now;

    await supabase.from("daily_tasks").update(updates).eq("id", taskId);

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: taskId, employee_id: user!.id,
      action: newStatus === "in_progress" ? "started" : newStatus === "completed" ? "completed" : newStatus === "stuck" ? "marked_stuck" : "paused",
      note: note || stuckReason || null,
    });

    // Update plan progress
    if (todayPlan) {
      const { data: allTasks } = await supabase.from("daily_tasks").select("status").eq("plan_id", todayPlan.id);
      const total = allTasks?.length || 0;
      const completed = allTasks?.filter(t => t.status === "completed").length || 0;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      await supabase.from("daily_work_plans").update({
        completed_tasks: completed, completion_percentage: pct,
        status: pct >= 100 ? "completed" : "active",
      }).eq("id", todayPlan.id);
    }

    fetchTodayData();
  };

  const handleTaskAction = (taskId: string, action: "start" | "done" | "stuck" | "pause") => {
    if (action === "start") updateTaskStatus(taskId, "in_progress");
    else if (action === "pause") updateTaskStatus(taskId, "paused");
    else if (action === "done" || action === "stuck") {
      setNoteDialog({ taskId, type: action });
      setNoteText("");
    }
  };

  const submitNote = () => {
    if (!noteDialog) return;
    if (noteDialog.type === "stuck" && !noteText.trim()) {
      toast({ title: "Please describe what's blocking you", variant: "destructive" });
      return;
    }
    if (noteDialog.type === "done") {
      updateTaskStatus(noteDialog.taskId, "completed", noteText || undefined);
    } else {
      updateTaskStatus(noteDialog.taskId, "stuck", undefined, noteText);
    }
    setNoteDialog(null);
  };

  // Personal tasks
  const addPersonalTask = async () => {
    if (!personalTitle.trim()) return;
    await supabase.from("personal_tasks").insert({
      employee_id: user!.id, title: personalTitle, priority: personalPriority, status: "not_started",
    });
    setPersonalTitle("");
    setShowAddPersonal(false);
    fetchTodayData();
    toast({ title: "Personal task added" });
  };

  const togglePersonalTask = async (t: PersonalTask) => {
    const newStatus = t.status === "completed" ? "not_started" : "completed";
    await supabase.from("personal_tasks").update({ status: newStatus }).eq("id", t.id);
    fetchTodayData();
  };

  const deletePersonalTask = async (id: string) => {
    await supabase.from("personal_tasks").delete().eq("id", id);
    fetchTodayData();
  };

  // End of day report
  const submitReport = async () => {
    const completedCount = tasks.filter(t => t.status === "completed").length;
    const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    await supabase.from("daily_reports").upsert({
      employee_id: user!.id, report_date: today,
      plan_id: todayPlan?.id || null,
      tasks_completed: completedCount, tasks_total: tasks.length,
      completion_percentage: pct,
      employee_notes: reportNotes || null,
      blockers_for_tomorrow: reportBlockers || null,
      submitted_at: new Date().toISOString(),
      is_locked: true,
    }, { onConflict: "employee_id,report_date" });

    toast({ title: "End of day report submitted!" });
    fetchTodayData();
  };

  // Stats
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const stuckCount = tasks.filter(t => t.status === "stuck").length;
  const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const getPriorityBadge = (p: string) => (
    <Badge variant={p === "high" ? "destructive" : p === "low" ? "secondary" : "default"} className="text-xs">
      {p === "high" ? "🔴" : p === "low" ? "🟢" : "🟡"} {p}
    </Badge>
  );

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("employee-tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_tasks", filter: `employee_id=eq.${user.id}` }, () => fetchTodayData())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_work_plans", filter: `employee_id=eq.${user.id}` }, () => fetchTodayData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Work Plan</h1>
      <Skeleton className="h-40 rounded-xl" />
      <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My Work Plan</h1>

      {/* Today's Summary */}
      <Card className="border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-lg font-semibold">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
              {todayPlan?.note_from_owner && (
                <p className="text-sm text-muted-foreground mt-1">📝 Owner's note: {todayPlan.note_from_owner}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold font-display">{pct}%</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </div>
          </div>
          <Progress value={pct} className="h-3 mb-3" />
          <div className="flex gap-4 text-sm">
            <span>Total: <strong>{tasks.length}</strong></span>
            <span className="text-primary">Done: <strong>{completedCount}</strong></span>
            <span className="text-accent-foreground">In Progress: <strong>{inProgressCount}</strong></span>
            <span className="text-destructive">Stuck: <strong>{stuckCount}</strong></span>
            <span>Remaining: <strong>{tasks.length - completedCount}</strong></span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today"><ClipboardList className="h-4 w-4 mr-1" /> Today's Tasks</TabsTrigger>
          <TabsTrigger value="personal"><Plus className="h-4 w-4 mr-1" /> Personal</TabsTrigger>
          <TabsTrigger value="report"><Send className="h-4 w-4 mr-1" /> End of Day</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1" /> My Stats</TabsTrigger>
        </TabsList>

        {/* ─── TODAY'S TASKS ─── */}
        <TabsContent value="today" className="space-y-3">
          {tasks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No work plan assigned for today</p>
              <p className="text-sm">Your manager will assign tasks when ready</p>
            </CardContent></Card>
          ) : (
            tasks.map(task => (
              <Card key={task.id} className={`transition-all ${task.status === "completed" ? "opacity-60" : task.status === "stuck" ? "border-destructive/50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getPriorityBadge(task.priority)}
                        <Badge variant="outline" className="text-xs">{task.category}</Badge>
                        {task.is_mandatory && <Badge variant="destructive" className="text-xs">Required</Badge>}
                        {task.deadline_time && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Due: {task.deadline_time}</span>}
                      </div>
                      <p className={`font-medium ${task.status === "completed" ? "line-through" : ""}`}>{task.title}</p>
                      {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                      {task.expected_duration_minutes && (
                        <p className="text-xs text-muted-foreground mt-1">⏱ Expected: {task.expected_duration_minutes} min</p>
                      )}
                      {task.employee_note && <p className="text-sm mt-2 bg-muted p-2 rounded">💬 {task.employee_note}</p>}
                      {task.stuck_reason && <p className="text-sm mt-2 text-destructive bg-destructive/10 p-2 rounded">🚨 {task.stuck_reason}</p>}
                      <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                        {task.started_at && <span>Started: {format(new Date(task.started_at), "h:mm a")}</span>}
                        {task.completed_at && <span>Done: {format(new Date(task.completed_at), "h:mm a")}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {task.status === "not_started" && (
                        <Button size="sm" onClick={() => handleTaskAction(task.id, "start")} className="gap-1">
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {task.status === "in_progress" && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => handleTaskAction(task.id, "pause")} className="gap-1">
                            <Pause className="h-3 w-3" /> Pause
                          </Button>
                          <Button size="sm" onClick={() => handleTaskAction(task.id, "done")} className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Done
                          </Button>
                        </>
                      )}
                      {task.status === "paused" && (
                        <Button size="sm" onClick={() => handleTaskAction(task.id, "start")} className="gap-1">
                          <Play className="h-3 w-3" /> Resume
                        </Button>
                      )}
                      {(task.status === "in_progress" || task.status === "not_started" || task.status === "paused") && (
                        <Button size="sm" variant="destructive" onClick={() => handleTaskAction(task.id, "stuck")} className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Stuck
                        </Button>
                      )}
                      {task.status === "completed" && (
                        <Badge variant="secondary" className="justify-center">✅ Done</Badge>
                      )}
                      {task.status === "stuck" && (
                        <Button size="sm" onClick={() => handleTaskAction(task.id, "start")} className="gap-1">
                          <Play className="h-3 w-3" /> Resume
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── PERSONAL TASKS ─── */}
        <TabsContent value="personal" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Private tasks — only you can see these</p>
            <Button size="sm" onClick={() => setShowAddPersonal(true)}><Plus className="h-4 w-4 mr-1" /> Add Task</Button>
          </div>
          {personalTasks.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No personal tasks yet</CardContent></Card>
          ) : (
            personalTasks.map(t => (
              <Card key={t.id} className={t.status === "completed" ? "opacity-60" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => togglePersonalTask(t)}>
                    {t.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <div className="h-4 w-4 rounded-full border-2" />}
                  </Button>
                  <div className="flex-1">
                    <p className={`font-medium text-sm ${t.status === "completed" ? "line-through" : ""}`}>{t.title}</p>
                  </div>
                  {getPriorityBadge(t.priority)}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deletePersonalTask(t.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}

          <Dialog open={showAddPersonal} onOpenChange={setShowAddPersonal}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Personal Task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input value={personalTitle} onChange={e => setPersonalTitle(e.target.value)} placeholder="Task title" />
                <Select value={personalPriority} onValueChange={setPersonalPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 High</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddPersonal(false)}>Cancel</Button>
                <Button onClick={addPersonalTask}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── END OF DAY REPORT ─── */}
        <TabsContent value="report" className="space-y-4">
          {todayReport?.is_locked ? (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Report Submitted</CardTitle>
                <CardDescription>Submitted at {todayReport.submitted_at ? format(new Date(todayReport.submitted_at), "h:mm a") : "—"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Tasks:</strong> {todayReport.tasks_completed}/{todayReport.tasks_total} ({todayReport.completion_percentage}%)</p>
                {todayReport.employee_notes && <p><strong>Notes:</strong> {todayReport.employee_notes}</p>}
                {todayReport.blockers_for_tomorrow && <p><strong>Blockers:</strong> {todayReport.blockers_for_tomorrow}</p>}
                {todayReport.owner_feedback && (
                  <div className="bg-muted p-3 rounded-lg mt-3">
                    <p className="text-sm font-medium">Owner's Feedback:</p>
                    <p className="text-sm">{todayReport.owner_feedback}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">End of Day Report — {format(new Date(), "MMM d, yyyy")}</CardTitle>
                <CardDescription>Auto-filled from your task data. Add notes and submit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                  <p className="font-medium">Tasks: {completedCount}/{tasks.length} ({pct}%)</p>
                  {tasks.map(t => (
                    <p key={t.id} className="text-sm">
                      {t.status === "completed" ? "✅" : t.status === "in_progress" ? "🔄" : t.status === "stuck" ? "🚨" : "⏳"} {t.title}
                    </p>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium">Your notes for today</label>
                  <Textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)} rows={3} placeholder="How did your day go?" />
                </div>
                <div>
                  <label className="text-sm font-medium">Any blockers for tomorrow?</label>
                  <Textarea value={reportBlockers} onChange={e => setReportBlockers(e.target.value)} rows={2} placeholder="Optional" />
                </div>
                <Button onClick={submitReport} className="w-full"><Send className="h-4 w-4 mr-1" /> Submit Report</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── MY STATS ─── */}
        <TabsContent value="stats">
          <MyPerformanceStats userId={user!.id} />
        </TabsContent>
      </Tabs>

      {/* Note/Stuck reason dialog */}
      <Dialog open={!!noteDialog} onOpenChange={() => setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noteDialog?.type === "done" ? "Task Completed!" : "What's blocking you?"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={3}
            placeholder={noteDialog?.type === "done" ? "Add a note about this task (optional)" : "Describe what's blocking you (required)"}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button onClick={submitNote}>{noteDialog?.type === "done" ? "Mark Done" : "Report Blocked"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Performance Stats Sub-component ───
function MyPerformanceStats({ userId }: { userId: string }) {
  const [stats, setStats] = useState({ weekPct: 0, monthPct: 0, totalCompleted: 0, avgDaily: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [weekRes, monthRes] = await Promise.all([
        supabase.from("daily_work_plans").select("completed_tasks, total_tasks").eq("employee_id", userId).gte("plan_date", format(weekAgo, "yyyy-MM-dd")),
        supabase.from("daily_work_plans").select("completed_tasks, total_tasks").eq("employee_id", userId).gte("plan_date", format(monthStart, "yyyy-MM-dd")),
      ]);

      const weekData = weekRes.data || [];
      const monthData = monthRes.data || [];

      const weekTotal = weekData.reduce((s, p) => s + p.total_tasks, 0);
      const weekDone = weekData.reduce((s, p) => s + p.completed_tasks, 0);
      const monthTotal = monthData.reduce((s, p) => s + p.total_tasks, 0);
      const monthDone = monthData.reduce((s, p) => s + p.completed_tasks, 0);

      setStats({
        weekPct: weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0,
        monthPct: monthTotal > 0 ? Math.round((monthDone / monthTotal) * 100) : 0,
        totalCompleted: monthDone,
        avgDaily: monthData.length > 0 ? Math.round(monthDone / monthData.length * 10) / 10 : 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, [userId]);

  if (loading) return <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">This Week</p>
          <p className="text-3xl font-bold font-display">{stats.weekPct}%</p>
          <Progress value={stats.weekPct} className="h-2 mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">This Month</p>
          <p className="text-3xl font-bold font-display">{stats.monthPct}%</p>
          <Progress value={stats.monthPct} className="h-2 mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Tasks Completed (Month)</p>
          <p className="text-3xl font-bold font-display">{stats.totalCompleted}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Avg Daily Completion</p>
          <p className="text-3xl font-bold font-display">{stats.avgDaily}</p>
        </CardContent>
      </Card>
    </div>
  );
}
