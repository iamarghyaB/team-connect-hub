import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Minus, Flame, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AttendanceRecord {
  date: string;
  status: string;
}

interface EmployeePerformanceCardProps {
  employee: {
    user_id: string;
    full_name: string;
    department: string | null;
    position: string | null;
  };
  monthRecords: AttendanceRecord[];
  totalWorkingDays: number;
}

export default function EmployeePerformanceCard({
  employee,
  monthRecords,
  totalWorkingDays,
}: EmployeePerformanceCardProps) {
  const present = monthRecords.filter((r) => r.status === "present").length;
  const absent = monthRecords.filter((r) => r.status === "absent").length;
  const leave = monthRecords.filter((r) => r.status === "leave").length;
  const halfDay = monthRecords.filter((r) => r.status === "half_day").length;
  const effectiveDays = present + halfDay * 0.5 + leave;
  const attendanceRate = totalWorkingDays > 0 ? Math.round((effectiveDays / totalWorkingDays) * 100) : 0;

  // Calculate current streak
  const sortedRecords = [...monthRecords].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const r of sortedRecords) {
    if (r.status === "present" || r.status === "half_day") streak++;
    else break;
  }

  // Trend: compare first half vs second half of available records
  const mid = Math.floor(monthRecords.length / 2);
  const firstHalf = monthRecords.slice(0, mid);
  const secondHalf = monthRecords.slice(mid);
  const firstPresent = firstHalf.filter((r) => r.status === "present" || r.status === "half_day").length;
  const secondPresent = secondHalf.filter((r) => r.status === "present" || r.status === "half_day").length;
  const trendUp = secondPresent > firstPresent;
  const trendDown = secondPresent < firstPresent;

  const initials = employee.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const ratingColor =
    attendanceRate >= 90
      ? "text-success"
      : attendanceRate >= 70
        ? "text-warning"
        : "text-destructive";

  const progressColor =
    attendanceRate >= 90
      ? "[&>div]:bg-success"
      : attendanceRate >= 70
        ? "[&>div]:bg-warning"
        : "[&>div]:bg-destructive";

  return (
    <Card className="animate-fade-in hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">{employee.full_name}</CardTitle>
            <p className="text-xs text-muted-foreground truncate">
              {employee.position || employee.department || "—"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {trendUp && <TrendingUp className="h-4 w-4 text-success" />}
            {trendDown && <TrendingDown className="h-4 w-4 text-destructive" />}
            {!trendUp && !trendDown && <Minus className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Attendance Rate */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-muted-foreground">Attendance Rate</span>
            <span className={`text-lg font-bold font-display ${ratingColor}`}>{attendanceRate}%</span>
          </div>
          <Progress value={attendanceRate} className={`h-2 ${progressColor}`} />
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-4 gap-1 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-md bg-success/10 py-1.5 cursor-default">
                <p className="text-sm font-bold text-success">{present}</p>
                <p className="text-[10px] text-muted-foreground">Present</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>Days present this month</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-md bg-destructive/10 py-1.5 cursor-default">
                <p className="text-sm font-bold text-destructive">{absent}</p>
                <p className="text-[10px] text-muted-foreground">Absent</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>Days absent this month</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-md bg-warning/10 py-1.5 cursor-default">
                <p className="text-sm font-bold text-warning">{leave}</p>
                <p className="text-[10px] text-muted-foreground">Leave</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>Approved leaves this month</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-md bg-info/10 py-1.5 cursor-default">
                <p className="text-sm font-bold text-info">{halfDay}</p>
                <p className="text-[10px] text-muted-foreground">Half</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>Half days this month</TooltipContent>
          </Tooltip>
        </div>

        {/* Streak & Warnings */}
        <div className="flex items-center justify-between text-xs">
          {streak > 0 && (
            <div className="flex items-center gap-1 text-warning">
              <Flame className="h-3.5 w-3.5" />
              <span>{streak}-day streak</span>
            </div>
          )}
          {absent >= 5 && (
            <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] gap-1">
              <AlertTriangle className="h-3 w-3" />
              High absence
            </Badge>
          )}
        </div>

        {/* Mini Calendar Heatmap - last 7 records */}
        <div className="flex gap-1 justify-center pt-1">
          {sortedRecords.slice(0, 7).reverse().map((r, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className={`h-5 w-5 rounded-sm cursor-default ${
                    r.status === "present"
                      ? "bg-success"
                      : r.status === "absent"
                        ? "bg-destructive"
                        : r.status === "leave"
                          ? "bg-warning"
                          : "bg-info"
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent>
                {new Date(r.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })} — {r.status.replace("_", " ")}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
