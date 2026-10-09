import React from 'react';
import {
  SheetJob,
  SheetJobTask,
  SheetUser,
  SheetTimeLog,
  ActiveTechSession,
  TechnicianEfficiencyRow,
  UserRole,
} from '../types/shopFloor';
import { Play, Pause, CheckCircle2, ArrowUpRight, Clock, Users } from 'lucide-react';

interface DashboardViewProps {
  jobs: SheetJob[];
  jobTasks: SheetJobTask[];
  users: SheetUser[];
  timeLogs: SheetTimeLog[];
  activeSessions: ActiveTechSession[];
  efficiencyRows: TechnicianEfficiencyRow[];
  nowMs: number;
  targetEfficiencyPct: number;
  onOpenCreateJob?: () => void;
  onSelectTechView: (techEmail: string) => void;
  onNavigateTab: (tab: 'jobs' | 'tech' | 'efficiency' | 'sheets') => void;
  currentUserRole?: UserRole;
}

export function formatClockFromSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((n) => (n < 10 ? `0${n}` : `${n}`)).join(':');
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
  onOpenCreateJob,
  onSelectTechView,
  onNavigateTab,
  currentUserRole,
}) => {
  // Filter out any invalid tasks, demo jobs, or tasks without a valid existing Job
  const validTasks = jobTasks.filter(
    (t) =>
      t &&
      t.TaskID &&
      !t.TaskID.startsWith('EMP-') &&
      !t.JobID.includes('@') &&
      t.TaskName !== '123' &&
      t.TaskName !== 'admin123' &&
      !['JOB-2610-001', 'JOB-2610-002', 'JOB-2610-003'].includes(t.JobID) &&
      jobs.some((j) => j.JobID === t.JobID)
  );
  const inProgressTasks = validTasks.filter((t) => t.Status === 'In Progress');
  const pausedTasks = validTasks.filter((t) => t.Status === 'Paused');
  const completedTasks = validTasks.filter((t) => t.Status === 'Completed');

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
    return u ? (u.Nickname || u.Name) : email.split('@')[0];
  };

  const getLatestPauseReason = (taskId: string): string => {
    const logs = timeLogs.filter((l) => l.TaskID === taskId && l.Action === 'PAUSE');
    if (logs.length === 0) return 'หยุดพักชั่วคราว';
    return logs[logs.length - 1].Note || 'หยุดพักชั่วคราว';
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-blue-600 tracking-wider uppercase">
          Time Tracking Control System
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
          ภาพรวมการทำงานในอู่ (Dashboard)
        </h1>
      </div>

      {/* Top KPI Strip - Single Elevation */}
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
            กำลังทำสี {jobs.filter((j) => j.Status === 'In Progress').length} คัน · รออะไหล่{' '}
            {jobs.filter((j) => j.Status === 'Paused').length} คัน
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
              : 'อู่สีโฟลว์คล่องตัว ไม่มีงานพักค้าง'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">ความเร็วในการทำสีเฉลี่ย (SOP SLA)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                avgTaskEff >= targetEfficiencyPct ? 'text-blue-600' : 'text-amber-600'
              }`}
            >
              {avgTaskEff}%
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              เป้าหมาย {targetEfficiencyPct}%
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            อัตราลงเวลาช่างในแผนก:{' '}
            <strong className="font-mono tabular-nums text-slate-900">{avgUtilization}%</strong>
          </div>
        </div>
      </div>

      {/* Active Technician Live Sessions Monitor */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              สถานะช่างประจำช่องซ่อมสี Real-time (Technician Live Monitor)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ติดตามชั่วโมงการจดบันทึกเวลาของช่างซ่อมตัวถังและช่างเตรียมพื้นผิวแต่ละคนในขณะนี้
            </p>
          </div>
          {currentUserRole === 'Admin' && (
            <button
              onClick={() => onNavigateTab('efficiency')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              ดูสถิติแยกรายบุคคล
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {users
            .filter((u) => u.Role === 'Technician' && u.Status === 'Active')
            .map((tech) => {
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
                      <span className="text-xs text-slate-600">{tech.Department}</span>
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
                        <span>({activeJob?.LicensePlate || activeTask.JobID})</span>
                        <span>—</span>
                        <span className="font-semibold text-slate-900">{activeTask.TaskName}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">
                        สถานะ: ว่าง / รอดึงงานเข้าแผนก · ถือครองคิวงานทั้งหมด {assignedCount} แผนก Sops
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

                    {currentUserRole === 'Admin' && (
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
            })}
        </div>
      </div>

      {/* Live SOP Subtasks Grid List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              สถานะขั้นตอนทำสีรถยนต์ย่อยทั้งหมด (Live SOP Progress Matrix)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงสถานะการเคลื่อนตัวถังและระบบ Checklist คุมรายชิ้นงานของใบงานปัจจุบัน
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('jobs')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            จัดการใบงานทั้งหมด
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">ทะเบียนรถ · รหัสงาน</th>
                <th className="py-3 px-4">ขั้นตอนทำสีย่อย (SOP Step)</th>
                <th className="py-3 px-4">ชิ้นส่วนตัวถังที่ทำสี (Parts Checklist)</th>
                <th className="py-3 px-4">ช่างผู้รับผิดชอบ</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4 text-right">เวลาสะสมจริง (Real-time)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {validTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    ยังไม่มีขั้นตอนงานในระบบ (สามารถกดปุ่ม "จัดการใบงานทั้งหมด" เพื่อเปิดใบงาน)
                  </td>
                </tr>
              ) : (
                validTasks.map((task) => {
                const job = jobs.find((j) => j.JobID === task.JobID);
                const taskRunningSessions = activeSessions.filter((s) => s.TaskID === task.TaskID);
                const extraLiveSeconds = taskRunningSessions.reduce((sum, s) => {
                  return sum + Math.max(0, Math.floor((nowMs - new Date(s.StartTimestamp).getTime()) / 1000));
                }, 0);
                const totalLiveSeconds = task.TotalMinutes * 60 + extraLiveSeconds;

                const techNames = task.AssignedTechs.split(',')
                  .map((e) => e.trim())
                  .filter(Boolean)
                  .map(getTechName)
                  .join(' · ');

                // Parse parts checklist
                const checklistItems = task.PartsChecklist
                  ? task.PartsChecklist.split(',').map((item) => {
                      const [name, state] = item.split(':');
                      return { name, done: state === 'done' };
                    })
                  : [];

                const doneCount = checklistItems.filter((i) => i.done).length;

                return (
                  <tr key={task.TaskID} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-bold text-slate-900">
                        {task.TaskID} · {task.JobID}
                      </div>
                      <div className="text-xs text-slate-600 font-semibold mt-0.5">
                        {job ? job.LicensePlate : '-'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {job ? job.CustomerName : '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 text-sm">{task.TaskName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        เวลามาตรฐาน: {task.StandardMinutes} นาที
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {checklistItems.length > 0 ? (
                        <div className="space-y-1.5 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {checklistItems.map((item, idx) => (
                              <span
                                key={idx}
                                className={`text-[10px] px-1.5 py-0.5 rounded-sm border font-medium ${
                                  item.done
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                              >
                                {item.name} {item.done ? '✓' : ''}
                              </span>
                            ))}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            ความสำเร็จรายชิ้นส่วน: {doneCount} / {checklistItems.length} ชิ้น ({Math.round((doneCount / checklistItems.length) * 100)}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">ไม่ได้ระบุชิ้นส่วน</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">{techNames}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {task.Status === 'In Progress' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <Play className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                          In Progress
                        </span>
                      )}
                      {task.Status === 'Paused' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                          <Pause className="w-3.5 h-3.5 text-amber-600" />
                          Paused
                        </span>
                      )}
                      {task.Status === 'Completed' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          Completed
                        </span>
                      )}
                      {task.Status === 'Pending' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <div
                        className={`text-sm font-bold ${
                          taskRunningSessions.length > 0 ? 'text-emerald-600 animate-pulse' : 'text-slate-900'
                        }`}
                      >
                        {formatClockFromSeconds(totalLiveSeconds)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        จดแล้ว {task.TotalMinutes} นาที
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
