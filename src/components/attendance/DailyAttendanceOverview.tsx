import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/shared/StatCard";
import { UserCheck, UserX, Clock, CalendarOff } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as ReTooltip } from "recharts";

interface DailyOverviewProps {
  todayRecords: { status: string }[];
  totalEmployees: number;
}

const STATUS_COLORS: Record<string, string> = {
  present: "hsl(152, 60%, 40%)",
  absent: "hsl(0, 72%, 51%)",
  leave: "hsl(38, 92%, 50%)",
  half_day: "hsl(210, 80%, 52%)",
  unmarked: "hsl(215, 13%, 80%)",
};

export default function DailyAttendanceOverview({ todayRecords, totalEmployees }: DailyOverviewProps) {
  const present = todayRecords.filter((r) => r.status === "present").length;
  const absent = todayRecords.filter((r) => r.status === "absent").length;
  const leave = todayRecords.filter((r) => r.status === "leave").length;
  const halfDay = todayRecords.filter((r) => r.status === "half_day").length;
  const unmarked = totalEmployees - todayRecords.length;

  const chartData = [
    { name: "Present", value: present, color: STATUS_COLORS.present },
    { name: "Absent", value: absent, color: STATUS_COLORS.absent },
    { name: "Leave", value: leave, color: STATUS_COLORS.leave },
    { name: "Half Day", value: halfDay, color: STATUS_COLORS.half_day },
    { name: "Unmarked", value: unmarked, color: STATUS_COLORS.unmarked },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Present" value={present} icon={UserCheck} className="border-l-4 border-l-success" />
        <StatCard title="Absent" value={absent} icon={UserX} className="border-l-4 border-l-destructive" />
        <StatCard title="On Leave" value={leave} icon={CalendarOff} className="border-l-4 border-l-warning" />
        <StatCard title="Half Day" value={halfDay} icon={Clock} className="border-l-4 border-l-info" />
      </div>

      {/* Pie Chart */}
      {totalEmployees > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip
                    formatter={(value: number, name: string) => [`${value} employees`, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
