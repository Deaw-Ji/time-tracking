import React, { useState } from 'react';
import {
  TechnicianEfficiencyRow,
  SheetWorkCalendar,
  SheetTimeLog,
  SheetUser,
  SheetJobTask,
  TechLeave,
} from '../types/shopFloor';

interface EfficiencyReportViewProps {
  users: SheetUser[];
  jobTasks: SheetJobTask[];
  timeLogs: SheetTimeLog[];
  workCalendar: SheetWorkCalendar[];
  techLeaves?: TechLeave[];
  targetEfficiencyPct: number;
}

export function calculateDualEfficiency(
  users: SheetUser[],
  jobTasks: SheetJobTask[],
  timeLogs: SheetTimeLog[],
  workCalendar: SheetWorkCalendar[],
  startDate: string,
  endDate: string,
  techLeaves?: TechLeave[]
): {
  rows: TechnicianEfficiencyRow[];
  workDaysCount: number;
  availableCalendarMinutes: number;
  pauseTotals: Record<string, number>;
} {
  const technicians = users.filter((u) => u.Role === 'Technician' && u.Status === 'Active');

  // Dynamic rule-based calendar: if dates exist in workCalendar use them; otherwise automatically calculate Mon-Sat = 8h, Sun = 0h
  const buildEffectiveWorkDays = (): { Date: string; StandardHours: number }[] => {
    if (!startDate || !endDate) {
      return workCalendar
        .filter((d) => d.IsWorkDay)
        .map((d) => ({ Date: d.Date, StandardHours: Number(d.StandardHours) || 8 }));
    }

    const calendarMap = new Map<string, SheetWorkCalendar>();
    workCalendar.forEach((d) => calendarMap.set(d.Date, d));

    const result: { Date: string; StandardHours: number }[] = [];
    // Use string parsing to avoid timezone shift
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    const cur = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);

    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;

      const existing = calendarMap.get(dateStr);
      if (existing) {
        if (existing.IsWorkDay) {
          result.push({ Date: dateStr, StandardHours: Number(existing.StandardHours) || 8 });
        }
      } else {
        // Automatic Dynamic Shop Rule: Sunday (0) is weekly off; Mon-Sat (1-6) are standard working days (8h)
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0) {
          result.push({ Date: dateStr, StandardHours: 8 });
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  };

  const activeWorkDays = buildEffectiveWorkDays();

  const totalCalendarHours = activeWorkDays.reduce((acc, d) => acc + (Number(d.StandardHours) || 0), 0);
  const availableCalendarMinutes = Math.max(480, totalCalendarHours * 60);

  const pauseTotals: Record<string, number> = {};

  const rows: TechnicianEfficiencyRow[] = technicians.map((tech) => {
    const email = tech.Email.trim().toLowerCase();

    const techLogs = timeLogs.filter((l) => {
      if (l.TechEmail.trim().toLowerCase() !== email) return false;
      const logDate = l.Timestamp.slice(0, 10);
      if (startDate && logDate < startDate) return false;
      if (endDate && logDate > endDate) return false;
      return true;
    });

    const actualWorkedMinutes = techLogs.reduce(
      (sum, l) => sum + (Number(l.DurationMinutes) || 0),
      0
    );

    const assignedTasks = jobTasks.filter((t) => {
      const assignedList = t.AssignedTechs.toLowerCase()
         .split(',')
         .map((s) => s.trim());
      return assignedList.includes(email);
    });

    const completedTasksCount = assignedTasks.filter((t) => t.Status === 'Completed').length;
    const inProgressTasksCount = assignedTasks.filter((t) => t.Status === 'In Progress').length;

    let standardTaskMinutes = 0;
    let actualTaskMinutes = 0;

    assignedTasks.forEach((t) => {
      if (t.TotalMinutes > 0) {
        const numTechs = Math.max(
          1,
          t.AssignedTechs.split(',')
            .map((s) => s.trim())
            .filter(Boolean).length
        );
        standardTaskMinutes += Math.round((t.StandardMinutes || 60) / numTechs);
        actualTaskMinutes += Math.round(t.TotalMinutes / numTechs);
      }
    });

    // Dynamic available minutes per technician factoring in leaves!
    const techActiveDays = activeWorkDays.filter((d) => {
      const isOnLeave = techLeaves?.some(
        (l) => l.TechEmail.trim().toLowerCase() === email && l.Date === d.Date
      );
      return !isOnLeave;
    });
    const techCalendarHours = techActiveDays.reduce((acc, d) => acc + (Number(d.StandardHours) || 0), 0);
    const techAvailableCalendarMinutes = techCalendarHours * 60;

    const workHourUtilizationPct =
      techAvailableCalendarMinutes > 0
        ? Math.round((actualWorkedMinutes / techAvailableCalendarMinutes) * 1000) / 10
        : 0;

    const taskEfficiencyPct =
      actualTaskMinutes > 0
        ? Math.round((standardTaskMinutes / actualTaskMinutes) * 1000) / 10
        : 0;

    const pauseBreakdown: Record<string, number> = {};
    techLogs
      .filter((l) => l.Action === 'PAUSE')
      .forEach((l) => {
        const reason = (l.Note || 'ไม่ระบุสาเหตุ').split('(')[0].trim();
        pauseBreakdown[reason] = (pauseBreakdown[reason] || 0) + 1;
        pauseTotals[reason] = (pauseTotals[reason] || 0) + 1;
      });

    return {
      user: tech,
      actualWorkedMinutes,
      availableCalendarMinutes: techAvailableCalendarMinutes, // Factor in leaves
      workHourUtilizationPct,
      standardTaskMinutes,
      actualTaskMinutes,
      taskEfficiencyPct,
      completedTasksCount,
      inProgressTasksCount,
      pauseBreakdown,
    };
  });

  return {
    rows,
    workDaysCount: activeWorkDays.length,
    availableCalendarMinutes,
    pauseTotals,
  };
}

export const EfficiencyReportView: React.FC<EfficiencyReportViewProps> = ({
  users,
  jobTasks,
  timeLogs,
  workCalendar,
  techLeaves = [],
  targetEfficiencyPct,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const startOfMonthStr = `${todayStr.slice(0, 7)}-01`;
  const [startDate, setStartDate] = useState(startOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);

  const report = calculateDualEfficiency(
    users,
    jobTasks,
    timeLogs,
    workCalendar,
    startDate,
    endDate,
    techLeaves
  );

  const handleSelectThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    setStartDate(`${y}-${m}-01`);
    setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleSelectLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const handleSelectLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Analytics & Performance · คำนวณจากชีต TimeLogs, JobTasks และ WorkCalendar
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            สรุปประสิทธิภาพช่าง (Efficiency Report)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-600 px-1">ช่วงวันที่:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
          />
          <span className="text-xs text-slate-400">ถึง</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
          />
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              onClick={handleSelectThisMonth}
              className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
            >
              เดือนนี้
            </button>
            <button
              type="button"
              onClick={handleSelectLast7Days}
              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              7 วันล่าสุด
            </button>
            <button
              type="button"
              onClick={handleSelectLast30Days}
              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              30 วันล่าสุด
            </button>
          </div>
        </div>
      </div>

      {/* Formula Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="text-xs font-semibold text-blue-600">
            มิติที่ 1: อัตราการใช้ชั่วโมงทำงาน (% Work Hour Utilization)
          </div>
          <div className="text-sm font-bold text-slate-900">
            (เวลาทำงานจริงจาก TimeLogs ÷ เวลางานตามปฏิทิน WorkCalendar) × 100
          </div>
          <p className="text-xs text-slate-600">
            ในช่วงวันที่เลือก มีวันทำงานปกติของอู่รวม <strong className="font-mono">{report.workDaysCount}</strong> วัน
            คิดเป็นเวลามาตรฐานอู่ {Math.round((report.availableCalendarMinutes / 60) * 10) / 10} ชั่วโมง ({report.availableCalendarMinutes} นาที) 
            <span className="text-blue-600 font-semibold block mt-1">
              * ระบบจะหักลบเวลามาตรฐานรายบุคคลออกให้โดยอัตโนมัติหากช่างคนนั้นมีวันลาหรือวันหยุดลงทะเบียนไว้ในหน้าต่างตั้งค่า
            </span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="text-xs font-semibold text-emerald-700">
            มิติที่ 2: ประสิทธิภาพความเร็วในการซ่อม (% Task Efficiency)
          </div>
          <div className="text-sm font-bold text-slate-900">
            (เวลามาตรฐานของงาน StandardMinutes ÷ เวลาที่ใช้จริง TotalMinutes) × 100
          </div>
          <p className="text-xs text-slate-600">
            หากช่างซ่อมเสร็จเร็วกว่าเวลามาตรฐาน ค่าจะสูงกว่า 100% · เป้าหมายเกณฑ์มาตรฐานของอู่อยู่ที่{' '}
            <strong className="font-mono">{targetEfficiencyPct}%</strong>
          </p>
        </div>
      </div>

      {/* Main Technician Efficiency Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            ตารางสรุปประสิทธิภาพรายบุคคล (Individual Technician Performance)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs">
                <th className="py-3 px-4">ชื่อช่าง / ชื่อเล่น (Technician)</th>
                <th className="py-3 px-4">แผนก · ทักษะ</th>
                <th className="py-3 px-4 text-right">งานเสร็จ / กำลังทำ</th>
                <th className="py-3 px-4 text-right">เวลาบันทึกจริง (TimeLogs)</th>
                <th className="py-3 px-4 text-right">เวลาปฏิทิน (WorkCalendar)</th>
                <th className="py-3 px-4 text-right">% Utilization</th>
                <th className="py-3 px-4 text-right">% Task Efficiency</th>
                <th className="py-3 px-4">สาเหตุการกดพักงาน (Pause)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลช่างเทคนิคที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => {
                  const pauseText = Object.entries(row.pauseBreakdown)
                    .map(([reason, count]) => `${reason} (${count})`)
                    .join(' · ');

                  return (
                    <tr key={row.user.UserID} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{row.user.Name}</span>
                          {row.user.Nickname && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              {row.user.Nickname}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{row.user.Email}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {row.user.UserID}
                          </span>
                        </div>
                      </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-800">
                        {row.user.Department}
                      </div>
                      <div className="text-xs text-slate-500">{row.user.Skills}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                      <span className="font-bold text-slate-900">{row.completedTasksCount}</span> เสร็จ ·{' '}
                      <span className="text-emerald-700 font-bold">{row.inProgressTasksCount}</span>{' '}
                      กำลังทำ
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {row.actualWorkedMinutes} นาที
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.availableCalendarMinutes} นาที
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div className="font-bold text-blue-600">{row.workHourUtilizationPct}%</div>
                      <div className="w-24 ml-auto h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${Math.min(100, row.workHourUtilizationPct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div
                        className={`font-bold ${
                          row.taskEfficiencyPct >= targetEfficiencyPct
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {row.taskEfficiencyPct}%
                      </div>
                      <div className="text-[11px] text-slate-500">
                        มาตรฐาน {row.standardTaskMinutes} / จริง {row.actualTaskMinutes} นาที
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {pauseText || 'ไม่มีประวัติหยุดงาน'}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottleneck / Pause Reason Analysis */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            สรุปสาเหตุการหยุดพักงานในอู่ (Shop Floor Bottleneck Summary)
          </h3>
          <p className="text-xs text-slate-500">
            รวบรวมจากรายการ Action = PAUSE ในชีต TimeLogs เพื่อช่วยผู้จัดการอู่แก้ปัญหาคอขวด
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {Object.entries(report.pauseTotals).length === 0 ? (
            <div className="text-xs text-slate-500 col-span-4">
              ยังไม่มีการกดพักงานในช่วงเวลาที่เลือก
            </div>
          ) : (
            Object.entries(report.pauseTotals).map(([reason, count]) => (
              <div key={reason} className="border border-slate-200 rounded-lg p-3">
                <div className="text-xs font-medium text-slate-600">{reason}</div>
                <div className="text-xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                  {count} ครั้ง
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
