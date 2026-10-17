import React, { useState, useMemo } from "react";
import {
  SheetJob,
  SheetJobTask,
  SheetUser,
  SheetTimeLog,
  ActiveTechSession,
  TechnicianEfficiencyRow,
  UserRole,
  MasterDepartment,
} from "../types/shopFloor";
import {
  Play,
  Pause,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  CheckSquare,
  Wrench,
  Calendar,
  X,
  Layers,
  Car,
  ChevronsUpDown,
  ExternalLink,
} from "lucide-react";
import { getTaskScheduleAdherence, formatThaiDate } from "../utils/scheduleHelper";

interface DashboardViewProps {
  jobs: SheetJob[];
  jobTasks: SheetJobTask[];
  users: SheetUser[];
  timeLogs: SheetTimeLog[];
  activeSessions: ActiveTechSession[];
  efficiencyRows: TechnicianEfficiencyRow[];
  nowMs: number;
  targetEfficiencyPct: number;
  departments?: MasterDepartment[];
  onOpenCreateJob?: () => void;
  onSelectTechView: (techEmail: string) => void;
  onNavigateTab: (tab: "jobs" | "tech" | "efficiency" | "sheets") => void;
  currentUserRole?: UserRole;
}

export function formatClockFromSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((n) => (n < 10 ? `0${n}` : `${n}`)).join(":");
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  jobs,
  jobTasks,
  users,
  timeLogs,
  activeSessions,
  efficiencyRows,
  nowMs,
  targetEfficiencyPct,
  departments = [],
  onOpenCreateJob,
  onSelectTechView,
  onNavigateTab,
  currentUserRole,
}) => {
  const [viewingTaskTimeLogs, setViewingTaskTimeLogs] = useState<SheetJobTask | null>(null);

  const validTasks = jobTasks.filter(
    (t) =>
      t &&
      t.TaskID &&
      !t.TaskID.startsWith("EMP-") &&
      !t.JobID.includes("@") &&
      t.TaskName !== "123" &&
      t.TaskName !== "admin123" &&
      !["JOB-2610-001", "JOB-2610-002", "JOB-2610-003"].includes(t.JobID) &&
      jobs.some((j) => j.JobID === t.JobID)
  );

  const inProgressTasks = validTasks.filter((t) => t.Status === "In Progress");
  const pausedTasks = validTasks.filter((t) => t.Status === "Paused");
  const completedTasks = validTasks.filter((t) => t.Status === "Completed");

  const avgUtilization =
    efficiencyRows.length > 0
      ? Math.round(
          (efficiencyRows.reduce((acc, r) => acc + r.workHourUtilizationPct, 0) /
            efficiencyRows.length) *
            10
        ) / 10
      : 0;

  const avgTaskEff =
    efficiencyRows.length > 0
      ? Math.round(
          (efficiencyRows.reduce((acc, r) => acc + r.taskEfficiencyPct, 0) /
            efficiencyRows.length) *
            10
        ) / 10
      : 0;

  const getTechName = (email: string) => {
    const clean = email.trim().toLowerCase();
    const u = users.find((item) => item.Email.toLowerCase() === clean);
    return u ? (u.Nickname || u.Name) : email.split("@")[0];
  };

  const getLatestPauseReason = (taskId: string): string => {
    const logs = timeLogs.filter((l) => l.TaskID === taskId && l.Action === "PAUSE");
    if (logs.length === 0) return "หยุดพักชั่วคราว";
    return logs[logs.length - 1].Note || "หยุดพักชั่วคราว";
  };

  const formatDateTimeThai = (isoString?: string | null): string => {
    if (!isoString) return "-";
    const dt = new Date(isoString);
    if (isNaN(dt.getTime())) return isoString;
    const dateStr = dt.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
    });
    const timeStr = dt.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr} น.`;
  };

  // Filter out completed jobs and test placeholders as requested
  const activeJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (!j || !j.JobID) return false;
      if (j.Status === "Completed") return false;
      if (["JOB-2610-001", "JOB-2610-002", "JOB-2610-003"].includes(j.JobID)) return false;
      return true;
    });
  }, [jobs]);

  // Group tasks by JobID
  const tasksByJobId = useMemo(() => {
    const map = new Map<string, SheetJobTask[]>();
    validTasks.forEach((t) => {
      const list = map.get(t.JobID) || [];
      list.push(t);
      map.set(t.JobID, list);
    });
    return map;
  }, [validTasks]);

  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixStatusFilter, setMatrixStatusFilter] = useState<"ALL" | "In Progress" | "Paused" | "Open">("ALL");
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    jobs.forEach((j) => {
      if (j.Status === "In Progress") {
        initial.add(j.JobID);
      }
    });
    return initial;
  });

  const filteredActiveJobs = useMemo(() => {
    return activeJobs.filter((j) => {
      if (matrixStatusFilter !== "ALL") {
        if (j.Status !== matrixStatusFilter) return false;
      }
      if (matrixSearch.trim()) {
        const query = matrixSearch.trim().toLowerCase();
        const matchesJob =
          (j.JobID && j.JobID.toLowerCase().includes(query)) ||
          (j.LicensePlate && j.LicensePlate.toLowerCase().includes(query)) ||
          (j.VIN && j.VIN.toLowerCase().includes(query)) ||
          (j.CarBrand && j.CarBrand.toLowerCase().includes(query)) ||
          (j.CarModel && j.CarModel.toLowerCase().includes(query)) ||
          (j.CustomerName && j.CustomerName.toLowerCase().includes(query));

        if (matchesJob) return true;

        const jobTasksList = tasksByJobId.get(j.JobID) || [];
        const matchesTask = jobTasksList.some((t) => {
          if (t.TaskName.toLowerCase().includes(query)) return true;
          if (t.TaskID.toLowerCase().includes(query)) return true;
          if (t.AssignedTechs.toLowerCase().includes(query)) return true;
          return false;
        });

        return matchesTask;
      }
      return true;
    });
  }, [activeJobs, matrixStatusFilter, matrixSearch, tasksByJobId]);

  const toggleJobExpand = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const expandAllJobs = () => {
    setExpandedJobIds(new Set(filteredActiveJobs.map((j) => j.JobID)));
  };

  const collapseAllJobs = () => {
    setExpandedJobIds(new Set());
  };

  const activeTechs = users.filter((u) => u.Role === "Technician" && u.Status === "Active");

  const departmentGroups: { deptName: string; description?: string; techs: SheetUser[] }[] = [];
  const assignedTechIds = new Set<string>();

  if (departments.length > 0) {
    departments.forEach((dept) => {
      const matchedTechs = activeTechs.filter(
        (t) => (t.Department || "").trim().toLowerCase() === dept.name.trim().toLowerCase()
      );
      matchedTechs.forEach((t) => assignedTechIds.add(t.UserID));
      if (matchedTechs.length > 0) {
        departmentGroups.push({
          deptName: dept.name,
          description: dept.description,
          techs: matchedTechs,
        });
      }
    });

    const unassignedTechs = activeTechs.filter((t) => !assignedTechIds.has(t.UserID));
    if (unassignedTechs.length > 0) {
      departmentGroups.push({
        deptName: "อื่นๆ / ไม่ระบุแผนก (Other)",
        description: "ช่างที่ยังไม่ได้ระบุสังกัดแผนกในระบบ",
        techs: unassignedTechs,
      });
    }
  } else {
    departmentGroups.push({
      deptName: "ช่างซ่อมทั้งหมดในอู่",
      techs: activeTechs,
    });
  }

  const renderTechRow = (tech: SheetUser) => {
    const session = activeSessions.find(
      (s) => s.TechEmail.toLowerCase() === tech.Email.toLowerCase()
    );
    const activeTask = session
      ? jobTasks.find((t) => t.TaskID === session.TaskID)
      : undefined;
    const activeJob = activeTask
      ? jobs.find((j) => j.JobID === activeTask.JobID)
      : undefined;
    const currentRunSeconds = session
      ? Math.max(0, Math.floor((nowMs - new Date(session.StartTimestamp).getTime()) / 1000))
      : 0;
    const assignedCount = jobTasks.filter((t) =>
      t.AssignedTechs.toLowerCase().includes(tech.Email.toLowerCase())
    ).length;

    return (
      <div
        key={tech.UserID}
        className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-slate-900">{tech.Name}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
              {tech.Nickname}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-xs text-slate-600 font-medium">{tech.Department || "ไม่ระบุแผนก"}</span>
            <span className="text-slate-400">·</span>
            <span className="text-xs font-mono text-slate-500">{tech.Email}</span>
          </div>
          {session && activeTask ? (
            <div className="text-xs text-slate-700 flex flex-wrap items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 shrink-0" />
              <span className="font-semibold text-emerald-700">กำลังทำงาน:</span>
              <span className="font-mono font-semibold text-slate-900">
                {activeTask.TaskID}
              </span>
              <span>({activeJob?.CarBrand ? `${activeJob.CarBrand} ${activeJob.CarModel || ''} · ` : ''}{activeJob?.LicensePlate || activeTask.JobID})</span>
              <span>—</span>
              <span className="font-semibold text-slate-900">{activeTask.TaskName}</span>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              สถานะ: ว่าง / รอดึงงานเข้าแผนก · ถือครองคิวงานทั้งหมด {assignedCount} งาน
            </div>
          )}
        </div>
        <div className="flex items-center justify-between lg:justify-end gap-5">
          {session ? (
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">เวลาช่วงที่บันทึกอยู่</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-600">
                {formatClockFromSeconds(currentRunSeconds)}
              </div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-[10px] text-slate-400">เวลารอบปัจจุบัน</div>
              <div className="text-lg font-mono tabular-nums text-slate-400">00:00:00</div>
            </div>
          )}
          {currentUserRole === "Admin" && (
            <button
              onClick={() => onSelectTechView(tech.Email)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              เปิด Technician Board
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-blue-600 tracking-wider uppercase">
          Time Tracking Control System
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
          ภาพรวมการทำงานในอู่ (Dashboard)
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">ใบงานซ่อมทั้งหมด (Jobs)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {jobs.length}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              ขั้นตอนย่อย {jobTasks.length} Tasks
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            กำลังทำสี {jobs.filter((j) => j.Status === "In Progress").length} คัน · รออะไหล่{" "}
            {jobs.filter((j) => j.Status === "Paused").length} คัน
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">ขั้นตอนที่กำลังเดินเวลา (Live SOP)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-emerald-600">
              {inProgressTasks.length}
            </span>
            <span className="text-xs text-emerald-700 font-medium">
              ช่างกำลังซ่อม {activeSessions.length} คน
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            บันทึกประวัติละเอียดลงชีต TimeLogs รายบุคคล
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">ขั้นตอนที่หยุดพัก (Paused Stages)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-amber-600">
              {pausedTasks.length}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              เสร็จสมบูรณ์แล้ว {completedTasks.length} แผนก
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 truncate">
            {pausedTasks.length > 0
              ? `ล่าสุด: ${getLatestPauseReason(pausedTasks[0].TaskID)}`
              : "อู่สีโฟลว์คล่องตัว ไม่มีงานพักค้าง"}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">ความเร็วในการทำสีเฉลี่ย (SOP SLA)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                avgTaskEff >= targetEfficiencyPct ? "text-blue-600" : "text-amber-600"
              }`}
            >
              {avgTaskEff}%
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              เป้าหมาย {targetEfficiencyPct}%
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            อัตราลงเวลาช่างในแผนก:{" "}
            <strong className="font-mono tabular-nums text-slate-900">{avgUtilization}%</strong>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              สถานะช่างประจำช่องซ่อมสี Real-time (Technician Live Monitor - เรียงตามแผนก)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ติดตามชั่วโมงการจดบันทึกเวลาของช่างซ่อมตัวถังและช่างเตรียมพื้นผิวแต่ละคน แยกตามแผนกในอู่
            </p>
          </div>
          {currentUserRole === "Admin" && (
            <button
              onClick={() => onNavigateTab("efficiency")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              ดูสถิติแยกรายบุคคล
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {departmentGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="bg-white">
              <div className="bg-slate-50 border-y border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span className="uppercase tracking-wider text-slate-900">{group.deptName}</span>
                  {group.description && (
                    <span className="font-normal text-slate-500 hidden sm:inline">
                      — {group.description}
                    </span>
                  )}
                </div>
                <div className="text-slate-600 font-mono bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                  ช่างในแผนกนี้: {group.techs.length} คน
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {group.techs.length > 0 ? (
                  group.techs.map((tech) => renderTechRow(tech))
                ) : (
                  <div className="px-5 py-4 text-xs text-slate-400 italic">
                    ไม่มีช่างประจำในแผนกนี้
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LIVE SOP PROGRESS MATRIX (HYBRID & EXPANDABLE ROWS) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* Header Title & Actions */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                สถานะขั้นตอนทำสีรถยนต์ย่อย (Live SOP Progress Matrix)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              สรุปคุมงานราย JOB พร้อมระบบคลี่ดูขั้นตอนย่อย (Expandable SOP) แบบ Real-time · ซ่อนใบงานที่เสร็จสิ้นแล้ว (ไปดูที่หน้าสรุปใบงาน)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab("jobs")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              จัดการใบงานทั้งหมด (หน้าสรุปใบงาน)
            </button>
          </div>
        </div>

        {/* Search Bar & Quick Filters */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              placeholder="ค้นหา: เลขที่ JOB, ทะเบียนรถ, VIN, ยี่ห้อ/รุ่น, ช่าง หรือขั้นตอน..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-2xs"
            />
            {matrixSearch && (
              <button
                onClick={() => setMatrixSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Buttons & Expand All / Collapse All */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setMatrixStatusFilter("ALL")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  matrixStatusFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ทั้งหมด ({activeJobs.length})
              </button>
              <button
                onClick={() => setMatrixStatusFilter("In Progress")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  matrixStatusFilter === "In Progress"
                    ? "bg-emerald-600 text-white shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                กำลังทำ ({activeJobs.filter((j) => j.Status === "In Progress").length})
              </button>
              <button
                onClick={() => setMatrixStatusFilter("Paused")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  matrixStatusFilter === "Paused"
                    ? "bg-amber-600 text-white shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                พักงาน ({activeJobs.filter((j) => j.Status === "Paused").length})
              </button>
              <button
                onClick={() => setMatrixStatusFilter("Open")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  matrixStatusFilter === "Open"
                    ? "bg-sky-600 text-white shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                รอดำเนินการ ({activeJobs.filter((j) => j.Status === "Open").length})
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
              <button
                onClick={expandAllJobs}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="คลี่แสดงขั้นตอนย่อยของทุก JOB"
              >
                ขยายทั้งหมด
              </button>
              <button
                onClick={collapseAllJobs}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="ยุบขั้นตอนย่อยทั้งหมด"
              >
                ยุบทั้งหมด
              </button>
            </div>
          </div>
        </div>

        {/* Hybrid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center"></th>
                <th className="py-3 px-4 min-w-[200px]">ทะเบียนรถ · รหัสงาน · รุ่นรถ</th>
                <th className="py-3 px-4 min-w-[220px]">ความคืบหน้าขั้นตอน SOP</th>
                <th className="py-3 px-4 min-w-[130px]">กำหนดส่งมอบ</th>
                <th className="py-3 px-4 min-w-[140px]">ช่างที่กำลังทำ</th>
                <th className="py-3 px-4 min-w-[110px]">สถานะ JOB</th>
                <th className="py-3 px-4 min-w-[130px] text-right">เวลารวมจริงทั้ง JOB</th>
                <th className="py-3 px-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredActiveJobs.map((j) => {
                const isExpanded = expandedJobIds.has(j.JobID);
                const jobTasksList = (tasksByJobId.get(j.JobID) || []).sort((a, b) => {
                  if (a.StartDate && b.StartDate) return a.StartDate.localeCompare(b.StartDate);
                  return a.TaskID.localeCompare(b.TaskID);
                });

                // Compute aggregated stats for this Job
                let jobTotalSec = 0;
                let jobCompletedCount = 0;
                let jobInProgressCount = 0;
                let jobPausedCount = 0;

                const jobTasksWithStats = jobTasksList.map((task) => {
                  const taskLogs = timeLogs.filter((l) => l.TaskID === task.TaskID);
                  const adherence = getTaskScheduleAdherence(task, timeLogs);

                  let taskSec = 0;
                  let activeStart: string | null = null;
                  taskLogs.forEach((log) => {
                    if (log.Action === "START") {
                      activeStart = log.Timestamp;
                    } else if ((log.Action === "PAUSE" || log.Action === "COMPLETE") && activeStart) {
                      taskSec += Math.max(
                        0,
                        Math.floor(
                          (new Date(log.Timestamp).getTime() - new Date(activeStart).getTime()) / 1000
                        )
                      );
                      activeStart = null;
                    }
                  });
                  if (activeStart && task.Status === "In Progress") {
                    taskSec += Math.max(
                      0,
                      Math.floor((nowMs - new Date(activeStart).getTime()) / 1000)
                    );
                  }

                  jobTotalSec += taskSec;

                  if (task.Status === "Completed") jobCompletedCount++;
                  else if (task.Status === "In Progress") jobInProgressCount++;
                  else if (task.Status === "Paused") jobPausedCount++;

                  const startLogs = taskLogs
                    .filter((l) => l.Action === "START")
                    .sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
                  const completeLogs = taskLogs
                    .filter((l) => l.Action === "COMPLETE")
                    .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

                  const actualStart = startLogs.length > 0 ? startLogs[0].Timestamp : null;
                  const actualEnd = completeLogs.length > 0 ? completeLogs[0].Timestamp : null;

                  return {
                    task,
                    taskLogs,
                    adherence,
                    taskSec,
                    actualStart,
                    actualEnd,
                  };
                });

                const totalStepsCount = jobTasksList.length;
                const progressPct =
                  totalStepsCount > 0 ? Math.round((jobCompletedCount / totalStepsCount) * 100) : 0;

                const activeTaskInJob = jobTasksWithStats.find((item) => item.task.Status === "In Progress");
                const pausedTaskInJob = jobTasksWithStats.find((item) => item.task.Status === "Paused");

                // Technicians actively working on tasks of this Job
                const activeTechEmails = new Set<string>();
                activeSessions.forEach((sess) => {
                  if (jobTasksList.some((t) => t.TaskID === sess.TaskID)) {
                    activeTechEmails.add(sess.TechEmail.toLowerCase());
                  }
                });

                return (
                  <React.Fragment key={j.JobID}>
                    {/* TOP-LEVEL JOB ROW */}
                    <tr
                      onClick={() => toggleJobExpand(j.JobID)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded ? "bg-blue-50/30 font-medium" : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Expand Toggle Button */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleJobExpand(j.JobID);
                          }}
                          className={`p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer ${
                            isExpanded ? "bg-blue-100/60 text-blue-700" : ""
                          }`}
                          title={isExpanded ? "ยุบขั้นตอนย่อย" : "คลี่ดูขั้นตอนย่อย"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* License Plate & Car Details */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 font-mono text-xs sm:text-sm bg-slate-100 px-2 py-0.5 rounded border border-slate-300 shadow-2xs">
                            {j.LicensePlate || j.JobID}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">#{j.JobID}</span>
                        </div>
                        {(j.CarBrand || j.CarModel) && (
                          <div className="text-[11px] font-semibold text-slate-700 mt-1 flex items-center gap-1">
                            <Car className="w-3 h-3 text-slate-500" />
                            <span>
                              {j.CarBrand} {j.CarModel} {j.CarColor ? `(${j.CarColor})` : ""}
                            </span>
                          </div>
                        )}
                        {j.VIN && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]" title={j.VIN}>
                            VIN: {j.VIN}
                          </div>
                        )}
                      </td>

                      {/* SOP Progress & Current Step */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-slate-700">
                              เสร็จ {jobCompletedCount} / {totalStepsCount} ขั้นตอน
                            </span>
                            <span className="font-bold text-slate-900 font-mono">{progressPct}%</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-2 transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            ></div>
                            {jobInProgressCount > 0 && (
                              <div
                                className="bg-blue-500 h-2 animate-pulse"
                                style={{
                                  width: `${Math.round((jobInProgressCount / (totalStepsCount || 1)) * 100)}%`,
                                }}
                              ></div>
                            )}
                          </div>
                          {/* Current stage badge */}
                          <div>
                            {activeTaskInJob ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                กำลังทำ: {activeTaskInJob.task.TaskName}
                              </span>
                            ) : pausedTaskInJob ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                <Pause className="w-2.5 h-2.5 text-amber-600" />
                                พักงาน: {pausedTaskInJob.task.TaskName}
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                รอดำเนินการ
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Delivery Date / Due Date */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5 text-slate-800 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatThaiDate(j.DeliveryDate || j.DueDate)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {j.DeliveryDate ? "วันนัดส่งมอบรถ" : "กำหนดรถเสร็จ"}
                        </div>
                      </td>

                      {/* Active Technicians on this Job */}
                      <td className="py-3.5 px-4 align-top">
                        {activeTechEmails.size > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Array.from(activeTechEmails).map((email) => (
                              <span
                                key={email}
                                className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {getTechName(email)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">ยังไม่มีช่างกำลังทำ</span>
                        )}
                      </td>

                      {/* Job Status */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            j.Status === "In Progress"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : j.Status === "Paused"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : j.Status === "Completed"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {j.Status === "In Progress"
                            ? "กำลังทำสี"
                            : j.Status === "Paused"
                            ? "พักงาน"
                            : j.Status === "Completed"
                            ? "เสร็จสิ้น"
                            : "รอดำเนินการ"}
                        </span>
                      </td>

                      {/* Total Real-time Accumulated Time for this Job */}
                      <td className="py-3.5 px-4 align-top text-right font-mono font-bold tabular-nums">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 text-xs font-mono shadow-2xs border border-slate-200">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>{formatClockFromSeconds(jobTotalSec)}</span>
                        </div>
                      </td>

                      {/* Expand / Details Indicator */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <span
                          className={`inline-block text-[11px] font-semibold ${
                            isExpanded ? "text-blue-600" : "text-slate-400"
                          }`}
                        >
                          {isExpanded ? "ซ่อน" : "คลี่"}
                        </span>
                      </td>
                    </tr>

                    {/* EXPANDED SOP SUB-TASKS ROW */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={8} className="p-0 border-b border-slate-200">
                          <div className="p-4 sm:p-5 bg-gradient-to-b from-blue-50/20 to-slate-50 border-y border-blue-100/60 shadow-inner">
                            {/* Inner Sub-task Table Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-800">
                                  📋 รายการขั้นตอน SOP ทั้งหมด ({jobTasksList.length} ขั้นตอน)
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  สำหรับใบงาน {j.JobID} ({j.LicensePlate})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                  เสร็จ {jobCompletedCount}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                                  กำลังทำ {jobInProgressCount}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                  พัก {jobPausedCount}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                                  รอ {totalStepsCount - jobCompletedCount - jobInProgressCount - jobPausedCount}
                                </span>
                              </div>
                            </div>

                            {/* Nested Sub-task Table */}
                            {jobTasksWithStats.length > 0 ? (
                              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/90 text-[11px] font-bold text-slate-700 uppercase">
                                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                                      <th className="py-2.5 px-3 min-w-[150px]">ขั้นตอนทำสี (SOP Step)</th>
                                      <th className="py-2.5 px-3 min-w-[170px]">กำหนดการ & ติดตาม</th>
                                      <th className="py-2.5 px-3 min-w-[180px]">
                                        เวลาเริ่มจริง - เวลาเสร็จจริง
                                      </th>
                                      <th className="py-2.5 px-3 min-w-[180px]">
                                        ชิ้นส่วนตัวถังที่ทำสี (Checklist)
                                      </th>
                                      <th className="py-2.5 px-3 min-w-[120px]">ช่างรับผิดชอบ</th>
                                      <th className="py-2.5 px-3 min-w-[95px]">สถานะ</th>
                                      <th className="py-2.5 px-3 min-w-[110px] text-right">เวลาจริง (TimeLogs)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs">
                                    {jobTasksWithStats.map((item, idx) => {
                                      const { task, adherence, taskSec, actualStart, actualEnd } = item;

                                      const techNames = task.AssignedTechs
                                        ? task.AssignedTechs
                                            .split(",")
                                            .map((e: string) => getTechName(e))
                                            .join(", ")
                                        : "-";

                                      const checklistItems = task.PartsChecklist
                                        ? task.PartsChecklist.split("||").map((it: string) => {
                                            const parts = it.split("::");
                                            return { text: parts[0] || "", done: parts[1] === "true" };
                                          })
                                        : [];
                                      const completedChecklistCount = checklistItems.filter(
                                        (ci: { text: string; done: boolean }) => ci.done
                                      ).length;

                                      return (
                                        <tr
                                          key={task.TaskID}
                                          className={`hover:bg-slate-50 transition-colors ${
                                            task.Status === "In Progress"
                                              ? "bg-emerald-50/30"
                                              : task.Status === "Paused"
                                              ? "bg-amber-50/20"
                                              : ""
                                          }`}
                                        >
                                          {/* Step Index */}
                                          <td className="py-2.5 px-3 text-center align-top font-mono font-bold text-slate-500">
                                            {idx + 1}
                                          </td>

                                          {/* Step Name & TaskID */}
                                          <td className="py-2.5 px-3 align-top">
                                            <div className="font-bold text-slate-900">{task.TaskName}</div>
                                            <div className="text-[10px] font-mono text-slate-400">
                                              {task.TaskID}
                                            </div>
                                          </td>

                                          {/* Schedule & Adherence */}
                                          <td className="py-2.5 px-3 align-top">
                                            <div className="space-y-1">
                                              <div className="text-slate-800 font-mono text-[11px] flex items-center gap-1">
                                                <span className="font-semibold">{formatThaiDate(task.StartDate)}</span>
                                                <span className="text-slate-400">➔</span>
                                                <span className="font-semibold text-amber-800">{formatThaiDate(task.DueDate)}</span>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-medium ${adherence.startAdherence.badgeClass}`}>
                                                  {adherence.startAdherence.label}
                                                </span>
                                                {task.Status === "Completed" ? (
                                                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-medium ${adherence.dueAdherence.badgeClass}`}>
                                                    {adherence.dueAdherence.label}
                                                  </span>
                                                ) : adherence.dueAdherence.status === "in-progress-overdue" ? (
                                                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-bold ${adherence.dueAdherence.badgeClass}`}>
                                                    {adherence.dueAdherence.label}
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>
                                          </td>

                                          {/* Actual Start & Completion Time (for main system entry) */}
                                          <td className="py-2.5 px-3 align-top">
                                            <div className="space-y-1 text-[11px]">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-slate-500 font-medium text-[10px]">เริ่มจริง:</span>
                                                <span className="font-mono font-semibold text-slate-800">
                                                  {actualStart ? formatDateTimeThai(actualStart) : "-"}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-slate-500 font-medium text-[10px]">เสร็จจริง:</span>
                                                {task.Status === "Completed" && actualEnd ? (
                                                  <span className="font-mono font-bold text-blue-700">
                                                    {formatDateTimeThai(actualEnd)}
                                                  </span>
                                                ) : task.Status === "In Progress" ? (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    กำลังทำอยู่
                                                  </span>
                                                ) : task.Status === "Paused" ? (
                                                  <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded truncate max-w-[150px]" title={getLatestPauseReason(task.TaskID)}>
                                                    ⏸ พัก ({getLatestPauseReason(task.TaskID)})
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400 font-mono text-[10px]">ยังไม่เริ่ม</span>
                                                )}
                                              </div>
                                            </div>
                                          </td>

                                          {/* Parts Checklist */}
                                          <td className="py-2.5 px-3 align-top">
                                            {checklistItems.length > 0 ? (
                                              <div>
                                                <div className="text-slate-800 font-semibold text-[11px]">
                                                  {completedChecklistCount} / {checklistItems.length} ชิ้นส่วน
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {checklistItems.map((ci: { text: string; done: boolean }) => (
                                                    <span
                                                      key={ci.text}
                                                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${
                                                        ci.done
                                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium"
                                                          : "bg-slate-100 text-slate-600 border border-slate-200"
                                                      }`}
                                                    >
                                                      {ci.text} {ci.done ? "✓" : ""}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : (
                                              <span className="text-slate-400 text-[11px]">ไม่มี Checklist</span>
                                            )}
                                          </td>

                                          {/* Assigned Technicians */}
                                          <td className="py-2.5 px-3 align-top font-medium text-slate-800 text-[11px]">
                                            {techNames}
                                          </td>

                                          {/* Sub-task Status */}
                                          <td className="py-2.5 px-3 align-top">
                                            <span
                                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                task.Status === "In Progress"
                                                  ? "bg-emerald-100 text-emerald-800"
                                                  : task.Status === "Paused"
                                                  ? "bg-amber-100 text-amber-800"
                                                  : task.Status === "Completed"
                                                  ? "bg-blue-100 text-blue-800"
                                                  : "bg-slate-100 text-slate-600"
                                              }`}
                                            >
                                              {task.Status === "In Progress"
                                                ? "กำลังทำสี"
                                                : task.Status === "Paused"
                                                ? "พักงาน"
                                                : task.Status === "Completed"
                                                ? "เสร็จแล้ว"
                                                : "รอดำเนินการ"}
                                            </span>
                                          </td>

                                          {/* Real-time Accumulated Time & Log History Modal Trigger */}
                                          <td className="py-2.5 px-3 align-top text-right">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setViewingTaskTimeLogs(task);
                                              }}
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer text-xs font-mono shadow-2xs"
                                              title="คลิกดูประวัติ TimeLogs รายละเอียดของขั้นตอนนี้"
                                            >
                                              <Clock className="w-3 h-3 text-blue-500" />
                                              <span>{formatClockFromSeconds(taskSec)}</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                                ยังไม่มีขั้นตอนย่อย (SOP Tasks) ในใบงานนี้
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* No Active Jobs Matching Filter / Search */}
              {filteredActiveJobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="text-3xl">🚗</div>
                      <div className="text-sm font-semibold text-slate-700">
                        {activeJobs.length === 0
                          ? "ไม่มีใบงานที่กำลังดำเนินการอยู่ในขณะนี้"
                          : "ไม่พบใบงานที่ตรงกับการค้นหาหรือตัวกรอง"}
                      </div>
                      <p className="text-xs text-slate-500">
                        {activeJobs.length === 0
                          ? "ใบงานที่ทำเสร็จแล้ว (Completed) ทั้งหมดถูกซ่อนไว้ สามารถคลิกไปตรวจสอบที่หน้า 'จัดการใบงานทั้งหมด'"
                          : "ลองเปลี่ยนคำค้นหา หรือกดเลือกตัวกรองสถานะ 'ทั้งหมด'"}
                      </p>
                      {activeJobs.length === 0 ? (
                        <button
                          onClick={() => onNavigateTab("jobs")}
                          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                        >
                          ไปหน้าจัดการใบงานทั้งหมด (ดูงานที่ Completed)
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setMatrixSearch("");
                            setMatrixStatusFilter("ALL");
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          ล้างตัวกรองและคำค้นหา
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="text-blue-600 font-bold">ℹ️</span>
            <span>
              ซ่อนใบงานที่จบงาน (Completed) แล้วโดยอัตโนมัติ เพื่อให้กระดานกระชับและมุ่งเน้นงานที่กำลังเคลื่อนไหว
            </span>
          </div>
          <button
            onClick={() => onNavigateTab("jobs")}
            className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            ไปดูสรุปใบงานที่เสร็จสิ้นทั้งหมด
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* VIEW TASK TIMELOGS HISTORY MODAL */}
      {viewingTaskTimeLogs && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  ประวัติการบันทึกเวลา (TimeLogs History)
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  ขั้นตอน: {viewingTaskTimeLogs.TaskName} (รหัส: {viewingTaskTimeLogs.TaskID})
                </p>
              </div>
              <button
                onClick={() => setViewingTaskTimeLogs(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-center gap-2">
                <span>ℹ️</span>
                <span>ข้อมูล TimeLogs บันทึกประวัติการทำงานจริงโดยอัตโนมัติจากช่างหน้างาน (โหมดตรวจสอบ: Read-Only)</span>
              </div>

              {(() => {
                const logs = timeLogs
                  .filter((l) => l.TaskID === viewingTaskTimeLogs.TaskID)
                  .sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());

                if (logs.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 text-sm italic">
                      ยังไม่มีประวัติการบันทึกเวลา (TimeLogs) สำหรับขั้นตอนนี้
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 text-xs font-bold text-slate-600">
                      <div className="col-span-2">การกระทำ</div>
                      <div className="col-span-3">เวลา (Timestamp)</div>
                      <div className="col-span-3">ช่าง (Tech)</div>
                      <div className="col-span-2 text-right">ช่วงเวลานี้</div>
                      <div className="col-span-2 text-right">หมายเหตุ</div>
                    </div>
                    {logs.map((log) => {
                      const techObj = users.find((u) => u.Email.toLowerCase() === log.TechEmail.toLowerCase());
                      const techDisplayName = techObj ? (techObj.Nickname || techObj.Name) : log.TechEmail.split('@')[0];
                      const dt = new Date(log.Timestamp);
                      const timeStr = !isNaN(dt.getTime())
                        ? `${dt.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} ${dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : log.Timestamp;

                      return (
                        <div key={log.LogID} className="px-4 py-3 grid grid-cols-12 text-xs items-center hover:bg-slate-50/70">
                          <div className="col-span-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.Action === 'START'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.Action === 'PAUSE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {log.Action}
                            </span>
                          </div>
                          <div className="col-span-3 font-mono text-slate-700 text-[11px]">
                            {timeStr}
                          </div>
                          <div className="col-span-3 font-medium text-slate-800 truncate" title={log.TechEmail}>
                            {techDisplayName}
                          </div>
                          <div className="col-span-2 text-right font-mono font-semibold text-slate-900">
                            {log.DurationMinutes ? `${log.DurationMinutes} นาที` : '-'}
                          </div>
                          <div className="col-span-2 text-right text-slate-500 text-[11px] truncate" title={log.Note || ''}>
                            {log.Note || '-'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingTaskTimeLogs(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
