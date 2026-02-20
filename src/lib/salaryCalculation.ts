export interface AttendanceSummary {
  present: number;
  absent: number;
  leave: number;
  half_day: number;
}

export interface SalaryBreakdown {
  baseSalary: number;
  totalWorkingDays: number;
  perDayRate: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  presentAmount: number;
  halfDayAmount: number;
  leaveAmount: number;
  deductionAmount: number;
  finalSalary: number;
}

export function calculateSalary(
  baseSalary: number,
  summary: AttendanceSummary,
  totalWorkingDays: number = 26,
  approvedLeaveDays: number = 0
): SalaryBreakdown {
  const perDayRate = baseSalary / totalWorkingDays;

  // Use approved leave days (from leave_requests table), not raw attendance "leave" count
  const leaveDays = approvedLeaveDays;
  const presentDays = summary.present;
  const absentDays = summary.absent + (summary.leave - approvedLeaveDays); // non-approved leaves count as absent
  const halfDays = summary.half_day;

  const presentAmount = presentDays * perDayRate;
  const halfDayAmount = halfDays * perDayRate * 0.5;
  const leaveAmount = leaveDays * perDayRate;
  const deductionAmount = absentDays * perDayRate;

  const finalSalary = presentAmount + halfDayAmount + leaveAmount - deductionAmount;

  return {
    baseSalary,
    totalWorkingDays,
    perDayRate: Math.round(perDayRate * 100) / 100,
    presentDays,
    absentDays: Math.max(0, absentDays),
    leaveDays,
    halfDays,
    presentAmount: Math.round(presentAmount * 100) / 100,
    halfDayAmount: Math.round(halfDayAmount * 100) / 100,
    leaveAmount: Math.round(leaveAmount * 100) / 100,
    deductionAmount: Math.round(Math.max(0, deductionAmount) * 100) / 100,
    finalSalary: Math.round(Math.max(0, finalSalary) * 100) / 100,
  };
}

export function formatCurrency(amount: number): string {
  return `৳${amount.toLocaleString()}`;
}
