import React, { useState, useMemo } from 'react';
import {
  TechnicianEfficiencyRow,
  SheetWorkCalendar,
  SheetTimeLog,
  SheetUser,
  SheetJobTask,
  TechLeave,
  MasterDepartment,
} from '../types/shopFloor';
import {
  Building2,
  Users,
  Layers,
  CheckCircle2,
  Clock,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Wrench,
  Percent,
} from 'lucide-react';

interface EfficiencyReportViewProps {
  users: SheetUser[];
  jobTasks: SheetJobTask[];
  timeLogs: SheetTimeLog[];
  workCalendar: SheetWorkCalendar[];
  techLeaves?: TechLeave[];
  targetEfficiencyPct: number;
  departments?: MasterDepartment[];
}

export interface DepartmentEfficiencyGroup {
  deptId: string;
  deptName: string;
  description?: string;
  rows: TechnicianEfficiencyRow[];
  totalTechs: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  actualWorkedMinutes: number;
  availableCalendarMinutes: number;
  standardTaskMinutes: number;
  actualTaskMinutes: number;
  workHourUtilizationPct: number;
  taskEfficiencyPct: number;
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
      availableCalendarMinutes: techAvailableCalendarMinutes,
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
  departments = [],
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const startOfMonthStr = `${todayStr.slice(0, 7)}-01`;
  const [startDate, setStartDate] = useState(startOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Grouping & Filtering state
  const [isGroupedByDept, setIsGroupedByDept] = useState(true);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

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

  const toggleDeptCollapse = (deptId: string) => {
    setCollapsedDepts((prev) => ({
      ...prev,
      [deptId]: !prev[deptId],
    }));
  };

  // Build department groups
  const departmentGroups: DepartmentEfficiencyGroup[] = useMemo(() => {
    const groups: DepartmentEfficiencyGroup[] = [];
    const assignedUserIds = new Set<string>();

    // 1. Process defined master departments
    if (departments && departments.length > 0) {
      departments.forEach((dept) => {
        const deptRows = report.rows.filter(
          (r) => (r.user.Department || '').trim().toLowerCase() === dept.name.trim().toLowerCase()
        );
        deptRows.forEach((r) => assignedUserIds.add(r.user.UserID));

        if (deptRows.length > 0) {
          const totalActualWorked = deptRows.reduce((acc, r) => acc + r.actualWorkedMinutes, 0);
          const totalAvailable = deptRows.reduce((acc, r) => acc + r.availableCalendarMinutes, 0);
          const totalStandardTask = deptRows.reduce((acc, r) => acc + r.standardTaskMinutes, 0);
          const totalActualTask = deptRows.reduce((acc, r) => acc + r.actualTaskMinutes, 0);
          const totalCompleted = deptRows.reduce((acc, r) => acc + r.completedTasksCount, 0);
          const totalInProgress = deptRows.reduce((acc, r) => acc + r.inProgressTasksCount, 0);

          const workHourUtilizationPct =
            totalAvailable > 0
              ? Math.round((totalActualWorked / totalAvailable) * 1000) / 10
              : 0;

          const taskEfficiencyPct =
            totalActualTask > 0
              ? Math.round((totalStandardTask / totalActualTask) * 1000) / 10
              : 0;

          groups.push({
            deptId: dept.id || `dept-${dept.name}`,
            deptName: dept.name,
            description: dept.description,
            rows: deptRows,
            totalTechs: deptRows.length,
            completedTasksCount: totalCompleted,
            inProgressTasksCount: totalInProgress,
            actualWorkedMinutes: totalActualWorked,
            availableCalendarMinutes: totalAvailable,
            standardTaskMinutes: totalStandardTask,
            actualTaskMinutes: totalActualTask,
            workHourUtilizationPct,
            taskEfficiencyPct,
          });
        }
      });
    }

    // 2. Process technicians with department not in master departments list
    const remainingRows = report.rows.filter((r) => !assignedUserIds.has(r.user.UserID));
    const unassignedMap = new Map<string, TechnicianEfficiencyRow[]>();

    remainingRows.forEach((r) => {
      const rawDept = (r.user.Department || '').trim();
      const key = rawDept || 'อื่นๆ / ไม่ระบุแผนก';
      if (!unassignedMap.has(key)) {
        unassignedMap.set(key, []);
      }
      unassignedMap.get(key)!.push(r);
    });

    unassignedMap.forEach((deptRows, deptName) => {
      const totalActualWorked = deptRows.reduce((acc, r) => acc + r.actualWorkedMinutes, 0);
      const totalAvailable = deptRows.reduce((acc, r) => acc + r.availableCalendarMinutes, 0);
      const totalStandardTask = deptRows.reduce((acc, r) => acc + r.standardTaskMinutes, 0);
      const totalActualTask = deptRows.reduce((acc, r) => acc + r.actualTaskMinutes, 0);
      const totalCompleted = deptRows.reduce((acc, r) => acc + r.completedTasksCount, 0);
      const totalInProgress = deptRows.reduce((acc, r) => acc + r.inProgressTasksCount, 0);

      const workHourUtilizationPct =
        totalAvailable > 0
          ? Math.round((totalActualWorked / totalAvailable) * 1000) / 10
          : 0;

      const taskEfficiencyPct =
        totalActualTask > 0
          ? Math.round((totalStandardTask / totalActualTask) * 1000) / 10
          : 0;

      groups.push({
        deptId: `extra-${deptName}`,
        deptName,
        rows: deptRows,
        totalTechs: deptRows.length,
        completedTasksCount: totalCompleted,
        inProgressTasksCount: totalInProgress,
        actualWorkedMinutes: totalActualWorked,
        availableCalendarMinutes: totalAvailable,
        standardTaskMinutes: totalStandardTask,
        actualTaskMinutes: totalActualTask,
        workHourUtilizationPct,
        taskEfficiencyPct,
      });
    });

    return groups;
  }, [report.rows, departments]);

  // Filter department groups according to UI selection and search
  const filteredGroups = useMemo(() => {
    let result = departmentGroups;
    if (selectedDeptFilter !== 'all') {
      result = result.filter(
        (g) => g.deptName.toLowerCase() === selectedDeptFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result
        .map((g) => ({
          ...g,
          rows: g.rows.filter(
            (r) =>
              r.user.Name.toLowerCase().includes(q) ||
              (r.user.Nickname && r.user.Nickname.toLowerCase().includes(q)) ||
              r.user.Email.toLowerCase().includes(q) ||
              r.user.Skills.toLowerCase().includes(q) ||
              g.deptName.toLowerCase().includes(q)
          ),
        }))
        .filter((g) => g.rows.length > 0);
    }

    return result;
  }, [departmentGroups, selectedDeptFilter, searchQuery]);

  // Overall totals across all active technicians
  const grandTotalTechs = report.rows.length;
  const grandActualWorkedMinutes = report.rows.reduce((acc, r) => acc + r.actualWorkedMinutes, 0);
  const grandAvailableMinutes = report.rows.reduce((acc, r) => acc + r.availableCalendarMinutes, 0);
  const grandStandardTaskMinutes = report.rows.reduce((acc, r) => acc + r.standardTaskMinutes, 0);
  const grandActualTaskMinutes = report.rows.reduce((acc, r) => acc + r.actualTaskMinutes, 0);
  const grandCompletedTasks = report.rows.reduce((acc, r) => acc + r.completedTasksCount, 0);
  const grandInProgressTasks = report.rows.reduce((acc, r) => acc + r.inProgressTasksCount, 0);

  const grandUtilizationPct =
    grandAvailableMinutes > 0
      ? Math.round((grandActualWorkedMinutes / grandAvailableMinutes) * 1000) / 10
      : 0;

  const grandEfficiencyPct =
    grandActualTaskMinutes > 0
      ? Math.round((grandStandardTaskMinutes / grandActualTaskMinutes) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Analytics & Performance · คำนวณจากชีต TimeLogs, JobTasks และ WorkCalendar
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <span>สรุปประสิทธิภาพช่าง (Efficiency Report)</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <Building2 className="w-3.5 h-3.5" />
              แบ่งตามแผนก
            </span>
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

      {/* Formula Reference & Overall Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              มิติที่ 1: อัตราการใช้ชั่วโมงทำงาน (% Work Hour Utilization)
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              ภาพรวมทั้งอู่: {grandUtilizationPct}%
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            (เวลาทำงานจริงจาก TimeLogs ÷ เวลางานตามปฏิทิน WorkCalendar) × 100
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            ในช่วงวันที่เลือก มีวันทำงานปกติของอู่รวม <strong className="font-mono">{report.workDaysCount}</strong> วัน
            คิดเป็นเวลามาตรฐานอู่ {Math.round((report.availableCalendarMinutes / 60) * 10) / 10} ชั่วโมง ({report.availableCalendarMinutes} นาที) 
            <span className="text-blue-600 font-semibold block mt-1">
              * ระบบหักลบเวลามาตรฐานรายบุคคลออกให้โดยอัตโนมัติหากช่างคนนั้นมีวันลาหรือวันหยุด
            </span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              มิติที่ 2: ประสิทธิภาพความเร็วในการซ่อม (% Task Efficiency)
            </div>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                grandEfficiencyPct >= targetEfficiencyPct
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              ภาพรวมทั้งอู่: {grandEfficiencyPct}%
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            (เวลามาตรฐานของงาน StandardMinutes ÷ เวลาที่ใช้จริง TotalMinutes) × 100
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            หากช่างซ่อมเสร็จเร็วกว่าเวลามาตรฐาน ค่าจะสูงกว่า 100% · เป้าหมายเกณฑ์มาตรฐานของอู่อยู่ที่{' '}
            <strong className="font-mono text-slate-900">{targetEfficiencyPct}%</strong>
            <span className="text-slate-500 block mt-1">
              * งานเสร็จรวมทั้งอู่ {grandCompletedTasks} งาน · งานกำลังทำ {grandInProgressTasks} งาน
            </span>
          </p>
        </div>
      </div>

      {/* Department Performance Comparison Benchmark Cards */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              สรุปภาพรวมเปรียบเทียบตามแผนก (Department Performance Benchmark)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              เปรียบเทียบประสิทธิภาพและอัตราการทำงานจริงระหว่างแผนก เพื่อวิเคราะห์สมรรถนะของทีมช่าง
            </p>
          </div>
          <div className="text-xs text-slate-500">
            จำนวนช่างทั้งหมด <strong className="font-mono text-slate-800">{grandTotalTechs}</strong> คน ใน{' '}
            <strong className="font-mono text-slate-800">{departmentGroups.length}</strong> แผนก
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {departmentGroups.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs text-slate-400">
              ยังไม่มีข้อมูลแผนกในระบบ
            </div>
          ) : (
            departmentGroups.map((dept) => {
              const isSelected = selectedDeptFilter.toLowerCase() === dept.deptName.toLowerCase();
              const isGoodEfficiency = dept.taskEfficiencyPct >= targetEfficiencyPct;

              return (
                <button
                  type="button"
                  key={dept.deptId}
                  onClick={() =>
                    setSelectedDeptFilter((prev) =>
                      prev.toLowerCase() === dept.deptName.toLowerCase() ? 'all' : dept.deptName
                    )
                  }
                  className={`text-left p-4 rounded-xl border transition-all relative ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                        <Wrench className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 line-clamp-1">
                          {dept.deptName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {dept.totalTechs} คน · เสร็จ {dept.completedTasksCount} งาน
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                        เลือกอยู่
                      </span>
                    )}
                  </div>

                  {/* Utilization Metric */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">% Utilization</span>
                      <span className="font-bold font-mono text-blue-700">
                        {dept.workHourUtilizationPct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, dept.workHourUtilizationPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Task Efficiency Metric */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">% Task Efficiency</span>
                    <span
                      className={`font-bold font-mono px-1.5 py-0.5 rounded text-xs ${
                        isGoodEfficiency
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {dept.taskEfficiencyPct}%
                    </span>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>จริง: {Math.round((dept.actualWorkedMinutes / 60) * 10) / 10} ชม.</span>
                    <span>เป้าหมาย {targetEfficiencyPct}%</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Technician Efficiency Table (Grouped by Department) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* Table Top Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>ตารางสรุปประสิทธิภาพรายบุคคล (Individual Technician Performance)</span>
                {isGroupedByDept && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    จัดกลุ่มตามแผนก
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบชั่วโมงทำงานจริง, เวลาปฏิทิน, % Utilization และความเร็วซ่อมเทียบเกณฑ์มาตรฐาน SOP
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsGroupedByDept(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isGroupedByDept
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>แบ่งตามแผนก</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGroupedByDept(false)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    !isGroupedByDept
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>เรียงรวมทุกคน</span>
                </button>
              </div>
            </div>
          </div>

          {/* Department Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" />
                แผนก:
              </span>
              <button
                type="button"
                onClick={() => setSelectedDeptFilter('all')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedDeptFilter === 'all'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                ทั้งหมด ({grandTotalTechs})
              </button>
              {departmentGroups.map((g) => {
                const isActive = selectedDeptFilter.toLowerCase() === g.deptName.toLowerCase();
                return (
                  <button
                    type="button"
                    key={g.deptId}
                    onClick={() => setSelectedDeptFilter(g.deptName)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{g.deptName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {g.totalTechs}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อช่าง / ทักษะ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs">
                <th className="py-3 px-4 min-w-[220px]">ชื่อช่าง / ชื่อเล่น (Technician)</th>
                <th className="py-3 px-4 min-w-[150px]">แผนก · ทักษะ</th>
                <th className="py-3 px-4 text-right min-w-[130px]">งานเสร็จ / กำลังทำ</th>
                <th className="py-3 px-4 text-right min-w-[140px]">เวลาบันทึกจริง (TimeLogs)</th>
                <th className="py-3 px-4 text-right min-w-[130px]">เวลาปฏิทิน (WorkCalendar)</th>
                <th className="py-3 px-4 text-right min-w-[130px]">% Utilization</th>
                <th className="py-3 px-4 text-right min-w-[150px]">% Task Efficiency</th>
                <th className="py-3 px-4 min-w-[200px]">สาเหตุการกดพักงาน (Pause)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลช่างเทคนิคที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรอง
                  </td>
                </tr>
              ) : isGroupedByDept ? (
                /* =================================================== */
                /* GROUPED BY DEPARTMENT VIEW                           */
                /* =================================================== */
                filteredGroups.map((deptGroup) => {
                  const isCollapsed = !!collapsedDepts[deptGroup.deptId];
                  const isGoodEfficiency = deptGroup.taskEfficiencyPct >= targetEfficiencyPct;

                  return (
                    <React.Fragment key={deptGroup.deptId}>
                      {/* Department Section Header Banner */}
                      <tr className="bg-slate-100/90 border-t-2 border-slate-300">
                        <td colSpan={8} className="py-2.5 px-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            {/* Left: Department Name & Tech Count */}
                            <button
                              type="button"
                              onClick={() => toggleDeptCollapse(deptGroup.deptId)}
                              className="flex items-center gap-2.5 text-left group"
                            >
                              <div className="text-slate-500 group-hover:text-slate-900 transition-colors">
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                  <Building2 className="w-4 h-4 text-blue-600" />
                                  {deptGroup.deptName}
                                </span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                  {deptGroup.totalTechs} คน
                                </span>
                                {deptGroup.description && (
                                  <span className="text-xs text-slate-500 hidden md:inline">
                                    · {deptGroup.description}
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Right: Department Subtotal Badges */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-medium">
                                งานเสร็จ <strong className="text-slate-900">{deptGroup.completedTasksCount}</strong> · ทำอยู่ <strong className="text-emerald-700">{deptGroup.inProgressTasksCount}</strong>
                              </span>
                              <span className="text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono font-medium">
                                รวมเวลาจริง: <strong className="text-slate-900">{deptGroup.actualWorkedMinutes}</strong> นาที ({Math.round((deptGroup.actualWorkedMinutes / 60) * 10) / 10} ชม.)
                              </span>
                              <span className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded font-mono font-bold">
                                Avg Util: {deptGroup.workHourUtilizationPct}%
                              </span>
                              <span
                                className={`border px-2 py-0.5 rounded font-mono font-bold ${
                                  isGoodEfficiency
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}
                              >
                                Avg Eff: {deptGroup.taskEfficiencyPct}%
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Department Individual Technician Rows */}
                      {!isCollapsed &&
                        deptGroup.rows.map((row) => {
                          const pauseText = Object.entries(row.pauseBreakdown)
                            .map(([reason, count]) => `${reason} (${count})`)
                            .join(' · ');

                          return (
                            <tr key={row.user.UserID} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 pl-8">
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
                              <td className="py-3 px-4">
                                <div className="text-xs font-semibold text-slate-800">
                                  {row.user.Department || deptGroup.deptName}
                                </div>
                                <div className="text-xs text-slate-500">{row.user.Skills || '-'}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                                <span className="font-bold text-slate-900">{row.completedTasksCount}</span> เสร็จ ·{' '}
                                <span className="text-emerald-700 font-bold">{row.inProgressTasksCount}</span>{' '}
                                กำลังทำ
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                                {row.actualWorkedMinutes} นาที
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                                {row.availableCalendarMinutes} นาที
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">
                                <div className="font-bold text-blue-600">{row.workHourUtilizationPct}%</div>
                                <div className="w-24 ml-auto h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                  <div
                                    className="h-full bg-blue-600"
                                    style={{ width: `${Math.min(100, row.workHourUtilizationPct)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">
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
                              <td className="py-3 px-4 text-xs text-slate-600">
                                {pauseText || 'ไม่มีประวัติหยุดงาน'}
                              </td>
                            </tr>
                          );
                        })}

                      {/* Department Subtotal / Average Summary Row */}
                      {!isCollapsed && deptGroup.rows.length > 1 && (
                        <tr className="bg-slate-50/70 border-b-2 border-slate-200 text-xs text-slate-700 font-semibold">
                          <td className="py-2.5 px-4 pl-8" colSpan={2}>
                            <span className="text-slate-500 font-medium">รวม/เฉลี่ยแผนก</span>{' '}
                            <span className="font-bold text-slate-900">{deptGroup.deptName}</span> ({deptGroup.totalTechs} คน)
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {deptGroup.completedTasksCount} เสร็จ · {deptGroup.inProgressTasksCount} ทำ
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {deptGroup.actualWorkedMinutes} นาที
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                            {deptGroup.availableCalendarMinutes} นาที
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700">
                            {deptGroup.workHourUtilizationPct}%
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            <span
                              className={
                                deptGroup.taskEfficiencyPct >= targetEfficiencyPct
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }
                            >
                              {deptGroup.taskEfficiencyPct}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 italic">
                            เฉลี่ยภาพรวมของแผนก
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                /* =================================================== */
                /* FLAT LIST VIEW (ALL TECHNICIANS)                    */
                /* =================================================== */
                filteredGroups
                  .flatMap((g) => g.rows)
                  .map((row) => {
                    const pauseText = Object.entries(row.pauseBreakdown)
                      .map(([reason, count]) => `${reason} (${count})`)
                      .join(' · ');

                    return (
                      <tr key={row.user.UserID} className="hover:bg-slate-50/80 transition-colors">
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {row.user.Department || 'ไม่ระบุแผนก'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{row.user.Skills || '-'}</div>
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
                  })
              )}
            </tbody>
            {/* Grand Total Footer */}
            {filteredGroups.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs">
                  <td className="py-3.5 px-4" colSpan={2}>
                    รวมทั้งหมด ({grandTotalTechs} ช่างเทคนิค · {departmentGroups.length} แผนก)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    {grandCompletedTasks} เสร็จ · {grandInProgressTasks} กำลังทำ
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    {grandActualWorkedMinutes} นาที ({Math.round((grandActualWorkedMinutes / 60) * 10) / 10} ชม.)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                    {grandAvailableMinutes} นาที
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-blue-300">
                    {grandUtilizationPct}%
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-300">
                    {grandEfficiencyPct}%
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    เป้าหมายมาตรฐาน {targetEfficiencyPct}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bottleneck / Pause Reason Analysis */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
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
              <div key={reason} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
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
