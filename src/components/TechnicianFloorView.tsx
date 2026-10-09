import React, { useState, useEffect } from 'react';
import {
  SheetJob,
  SheetJobTask,
  SheetTimeLog,
  SheetUser,
  ActiveTechSession,
  TimeLogAction,
} from '../types/shopFloor';
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Info,
  ArrowLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { formatClockFromSeconds } from './DashboardView';

interface TechnicianFloorViewProps {
  currentUser: SheetUser;
  users: SheetUser[];
  jobs: SheetJob[];
  jobTasks: SheetJobTask[];
  timeLogs: SheetTimeLog[];
  activeSessions: ActiveTechSession[];
  pauseReasons: string[];
  nowMs: number;
  selectedTechEmail: string;
  onChangeSelectedTechEmail: (email: string) => void;
  onRecordTimeAction: (
    taskId: string,
    techEmail: string,
    action: TimeLogAction,
    note: string
  ) => void;
  onUpdateTaskChecklist: (taskId: string, checklistString: string) => void;
}

export const TechnicianFloorView: React.FC<TechnicianFloorViewProps> = ({
  currentUser,
  users,
  jobs,
  jobTasks,
  timeLogs,
  activeSessions,
  pauseReasons,
  nowMs,
  selectedTechEmail,
  onChangeSelectedTechEmail,
  onRecordTimeAction,
  onUpdateTaskChecklist,
}) => {
  const technicians = users.filter((u) => u.Role === 'Technician' && u.Status === 'Active');

  // Decide which tech email we are active on (locked to self if Tech role, or switcher for Admin/Controller)
  const activeTechEmail =
    currentUser.Role === 'Technician'
      ? currentUser.Email
      : selectedTechEmail || (technicians[0]?.Email ?? '');

  const activeTechObj =
    users.find((u) => u.Email.toLowerCase() === activeTechEmail.toLowerCase()) || currentUser;

  // Selected Task ID to view / work on (null = Master Queue Screen)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Local state to keep track of checked parts before clicking START for each Task
  const [checkedPartsToStart, setCheckedPartsToStart] = useState<Record<string, string[]>>({});

  // Pause modal state
  const [pauseModalTaskId, setPauseModalTaskId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(pauseReasons[0] || 'รออะไหล่/รอชิ้นงาน');
  const [customPauseNote, setCustomPauseNote] = useState('');

  // Lock body scroll when pause modal is active
  useEffect(() => {
    if (pauseModalTaskId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [pauseModalTaskId]);

  // Filter tasks assigned to this technician
  const myAssignedTasks = jobTasks.filter((t) => {
    const emailList = t.AssignedTechs.toLowerCase()
      .split(',')
      .map((s) => s.trim());
    return emailList.includes(activeTechEmail.toLowerCase());
  });

  // 1. Pending / In Progress Tasks sorted strictly by StartDate ascending (earliest first FIFO)
  const pendingTasks = myAssignedTasks
    .filter((t) => t.Status !== 'Completed')
    .sort((a, b) => {
      // Sort primarily by StartDate (earliest date first)
      const dateA = a.StartDate || '9999-99-99';
      const dateB = b.StartDate || '9999-99-99';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      // Secondary sort by DueDate
      const dueA = a.DueDate || '9999-99-99';
      const dueB = b.DueDate || '9999-99-99';
      if (dueA !== dueB) {
        return dueA.localeCompare(dueB);
      }
      return a.TaskID.localeCompare(b.TaskID);
    });

  // 2. Completed Tasks sorted by DueDate descending (latest completed on top)
  const completedTasks = myAssignedTasks
    .filter((t) => t.Status === 'Completed')
    .sort((a, b) => {
      const dateA = a.DueDate || a.StartDate || '';
      const dateB = b.DueDate || b.StartDate || '';
      return dateB.localeCompare(dateA);
    });

  // Recent time logs belonging to this technician
  const myLogs = timeLogs
    .filter((l) => l.TechEmail.toLowerCase() === activeTechEmail.toLowerCase())
    .slice()
    .reverse();

  // Helper to toggle part selection before starting
  const handleTogglePartSelectForStart = (taskId: string, partName: string) => {
    setCheckedPartsToStart((prev) => {
      const current = prev[taskId] || [];
      const next = current.includes(partName)
        ? current.filter((p) => p !== partName)
        : [...current, partName];
      return { ...prev, [taskId]: next };
    });
  };

  // Helper to trigger START log
  const handleStartSession = (task: SheetJobTask) => {
    const selected = checkedPartsToStart[task.TaskID] || [];
    if (selected.length === 0) return;

    const partsString = selected.join(', ');
    onRecordTimeAction(
      task.TaskID,
      activeTechEmail,
      'START',
      `เริ่มทำสีชิ้นส่วน: ${partsString}`
    );
  };

  const handleOpenPauseModal = (taskId: string) => {
    setPauseModalTaskId(taskId);
    setSelectedReason(pauseReasons[0] || 'รออะไหล่/รอชิ้นงาน');
    setCustomPauseNote('');
  };

  const handleConfirmPause = () => {
    if (!pauseModalTaskId) return;
    const note = customPauseNote.trim()
      ? `${selectedReason} (${customPauseNote.trim()})`
      : selectedReason;
    onRecordTimeAction(pauseModalTaskId, activeTechEmail, 'PAUSE', note);
    setPauseModalTaskId(null);
  };

  // Helper to trigger COMPLETE for the active parts
  const handleCompleteActiveParts = (task: SheetJobTask, activePartsFromSession: string[]) => {
    const listItems = task.PartsChecklist
      ? task.PartsChecklist.split(',').map((p) => {
          const [name, state] = p.split(':');
          return { name, state };
        })
      : [];

    const updatedList = listItems.map((item) => {
      if (activePartsFromSession.includes(item.name)) {
        return { name: item.name, state: 'done' };
      }
      return item;
    });

    const checklistString = updatedList.map((i) => `${i.name}:${i.state}`).join(',');
    const hasPendingParts = updatedList.some((item) => item.state === 'todo');

    onUpdateTaskChecklist(task.TaskID, checklistString);

    if (hasPendingParts) {
      onRecordTimeAction(
        task.TaskID,
        activeTechEmail,
        'PAUSE',
        `เสร็จบางส่วนแล้ว: ทำสี [${activePartsFromSession.join(', ')}] เรียบร้อยแล้วค้างส่วนเหลือ`
      );
    } else {
      onRecordTimeAction(
        task.TaskID,
        activeTechEmail,
        'COMPLETE',
        `เสร็จครบหมดแล้ว: ทำสี [${activePartsFromSession.join(', ')}] ครบเรียบร้อย`
      );
    }

    setCheckedPartsToStart((prev) => {
      const copy = { ...prev };
      delete copy[task.TaskID];
      return copy;
    });
  };

  // Find which parts are currently active in the running session for this task
  const getActivePartsInSession = (taskId: string): string[] => {
    const activeSess = activeSessions.find(
      (s) => s.TaskID === taskId && s.TechEmail.toLowerCase() === activeTechEmail.toLowerCase()
    );
    if (!activeSess) return [];

    const logs = timeLogs.filter(
      (l) =>
        l.TaskID === taskId &&
        l.TechEmail.toLowerCase() === activeTechEmail.toLowerCase() &&
        l.Action === 'START'
    );
    if (logs.length === 0) return [];

    const latestStartLog = logs[logs.length - 1];
    const note = latestStartLog.Note || '';
    if (note.includes('เริ่มทำสีชิ้นส่วน: ')) {
      return note.replace('เริ่มทำสีชิ้นส่วน: ', '').split(', ').map((s) => s.trim());
    }
    return [];
  };

  // Resolve currently selected task object
  const selectedTask = selectedTaskId ? jobTasks.find((t) => t.TaskID === selectedTaskId) : null;
  const selectedJob = selectedTask ? jobs.find((j) => j.JobID === selectedTask.JobID) : null;

  return (
    <div className="space-y-6 max-w-[760px] mx-auto animate-fadeIn pb-12">
      {/* Simulation Bar for Admin/Controller */}
      {currentUser.Role !== 'Technician' && (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            จำลองหน้าจอเครื่องช่าง:
          </span>
          <select
            value={activeTechEmail}
            onChange={(e) => {
              onChangeSelectedTechEmail(e.target.value);
              setSelectedTaskId(null); // Return to queue when switching technician
            }}
            className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none"
          >
            {technicians.map((t) => (
              <option key={t.UserID} value={t.Email}>
                {t.Name} ({t.Nickname || 'ช่าง'})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Technician Profile Card Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-wider">
            SOP Terminal • Technician Board
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            ช่าง {activeTechObj.Name} ({activeTechObj.Nickname || 'ช่างสี'})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            แผนก: {activeTechObj.Department} · ทักษะ: {activeTechObj.Skills}
          </p>
        </div>
        <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-sm text-blue-700 shrink-0">
          {(activeTechObj.Nickname || activeTechObj.Name).slice(0, 2)}
        </div>
      </div>

      {/* VIEW MODE 1: MASTER QUEUE SCREEN (เมื่อยังไม่ได้กดเลือกคันใดคันหนึ่ง) */}
      {!selectedTask ? (
        <div className="space-y-6">
          {/* 1. ตารางชุดบน: งานที่รอดำเนินการ (เรียงตามกำหนดเริ่มงาน ลำดับก่อน-หลัง) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  งานที่รอดำเนินการ ({pendingTasks.length} รายการ)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  เรียงตามกำหนดเริ่มงาน (งานด่วนเริ่มก่อนอยู่บนสุด) • แตะที่แถวของรถเพื่อเปิดเข้าทำงาน
                </p>
              </div>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                ไม่มีงานที่รอดำเนินการในขณะนี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขที่ JOB</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ทะเบียน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขตัวถัง (VIN)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">กำหนดเริ่มงาน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">กำหนดเสร็จ</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pendingTasks.map((task) => {
                      const job = jobs.find((j) => j.JobID === task.JobID);
                      const isRunning = activeSessions.some(
                        (s) =>
                          s.TaskID === task.TaskID &&
                          s.TechEmail.toLowerCase() === activeTechEmail.toLowerCase()
                      );

                      return (
                        <tr
                          key={task.TaskID}
                          onClick={() => setSelectedTaskId(task.TaskID)}
                          className={`cursor-pointer transition-colors hover:bg-blue-50/40 active:bg-blue-100/50 ${
                            isRunning ? 'bg-emerald-50/60 font-semibold' : ''
                          }`}
                        >
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-blue-600">
                            <div className="flex items-center gap-1.5">
                              {isRunning && (
                                <span
                                  className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                                  title="กำลังจับเวลา"
                                ></span>
                              )}
                              <span>{job?.JobID || task.JobID}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-normal block truncate max-w-[130px]">
                              {task.TaskName.replace(' — ', ' · ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-bold text-slate-900">
                            {job?.LicensePlate || '-'}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {job?.VIN || '-'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-slate-700">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                              {task.StartDate || '-'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-amber-700 font-semibold">
                            <span className="bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                              {task.DueDate || '-'}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-right whitespace-nowrap">
                            <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. ตารางชุดล่าง: งานที่เสร็จแล้ว */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  งานที่เสร็จแล้ว ({completedTasks.length} รายการ)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ประวัติผลงานที่ส่งมอบขั้นตอนเสร็จสมบูรณ์เรียบร้อยแล้ว
                </p>
              </div>
            </div>

            {completedTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                ยังไม่มีรายการงานที่เสร็จสมบูรณ์
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขที่ JOB</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ทะเบียน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขตัวถัง (VIN)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">กำหนดเริ่มงาน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">กำหนดเสร็จ</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {completedTasks.map((task) => {
                      const job = jobs.find((j) => j.JobID === task.JobID);

                      return (
                        <tr
                          key={task.TaskID}
                          onClick={() => setSelectedTaskId(task.TaskID)}
                          className="cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100"
                        >
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-slate-700">
                            {job?.JobID || task.JobID}
                            <span className="text-[10px] text-slate-400 font-normal block truncate max-w-[130px]">
                              {task.TaskName.replace(' — ', ' · ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-semibold text-slate-700">
                            {job?.LicensePlate || '-'}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                            {job?.VIN || '-'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-slate-500 text-[11px]">
                            {task.StartDate || '-'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-slate-500 text-[11px]">
                            {task.DueDate || '-'}
                          </td>
                          <td className="py-3.5 px-2 text-right whitespace-nowrap">
                            <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mini-feed ประวัติการลงเวลาล่าสุด */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              บันทึกเวลากดงานล่าสุด (Recent Logs)
            </h4>
            {myLogs.length === 0 ? (
              <p className="text-[11px] text-slate-400">ยังไม่มีประวัติการกดเวลาในเครื่องนี้</p>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {myLogs.slice(0, 4).map((log) => {
                  const taskObj = jobTasks.find((t) => t.TaskID === log.TaskID);
                  return (
                    <div
                      key={log.LogID}
                      className="text-[11px] flex justify-between gap-2 border-b border-slate-100 pb-1.5"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-slate-800">[{log.Action}]</span>{' '}
                        <span className="text-slate-600">
                          {taskObj?.TaskName.split(' — ')[1] || taskObj?.TaskName || log.TaskID}
                        </span>
                      </div>
                      <div className="font-mono text-slate-400 text-right whitespace-nowrap tabular-nums">
                        {log.DurationMinutes > 0 && `+${log.DurationMinutes}น. · `}
                        {new Date(log.Timestamp).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} น.
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: TASK FOCUS WORKSTATION (หน้าจอทำงานเฉพาะคันที่เลือก) */
        <div className="space-y-4 animate-scaleUp">
          {/* Back button to return to queue */}
          <button
            type="button"
            onClick={() => setSelectedTaskId(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600" />
            <span>ย้อนกลับไปคิวงานทั้งหมด</span>
          </button>

          {/* Active Job Card Details */}
          {(() => {
            const task = selectedTask;
            const parentJob = selectedJob;
            if (!parentJob) return null;

            const activeSession = activeSessions.find(
              (s) =>
                s.TaskID === task.TaskID &&
                s.TechEmail.toLowerCase() === activeTechEmail.toLowerCase()
            );
            const isRunning = !!activeSession;

            const elapsedSeconds = activeSession
              ? Math.max(
                  0,
                  Math.floor((nowMs - new Date(activeSession.StartTimestamp).getTime()) / 1000)
                )
              : 0;

            const totalLoggedSeconds = task.TotalMinutes * 60;
            const currentTotalSeconds = totalLoggedSeconds + elapsedSeconds;

            const listItems = task.PartsChecklist
              ? task.PartsChecklist.split(',').map((p) => {
                  const [name, state] = p.split(':');
                  return { name, done: state === 'done' };
                })
              : [];

            const pendingParts = listItems.filter((item) => !item.done);
            const completedParts = listItems.filter((item) => item.done);
            const currentCheckedToStart = checkedPartsToStart[task.TaskID] || [];
            const activePartsInSession = getActivePartsInSession(task.TaskID);

            return (
              <div
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all ${
                  isRunning
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Header Block: Plate, Job No, VIN, Symptom, SLA Standard Minutes */}
                <div className="p-4 border-b border-slate-100 space-y-2 bg-slate-50/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-base font-bold text-slate-900 block truncate">
                        🚗 {parentJob.LicensePlate}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                        {parentJob.JobID} · VIN: {parentJob.VIN}
                      </span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                        เวลามาตรฐาน
                      </span>
                      <span className="text-xs font-bold font-mono tabular-nums text-blue-700 block mt-0.5">
                        ⏱ {task.StandardMinutes} นาที
                      </span>
                    </div>
                  </div>

                  {/* Symptom & Step Info */}
                  <div className="text-xs leading-relaxed text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-950">{task.TaskName}</div>
                    <div className="text-[11px] text-slate-500">
                      รายละเอียดอาการ: {parentJob.JobDetails}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                      <span>เริ่ม: {task.StartDate || '-'}</span>
                      <span>·</span>
                      <span>กำหนดเสร็จของแผนก (SLA): {task.DueDate || '-'}</span>
                      <span>·</span>
                      <span className="text-blue-600 font-semibold">ส่งมอบลูกค้า (SA): {parentJob.DeliveryDate || parentJob.DueDate || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Checklist & Timer Section */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Case 1: Timer NOT running (Pending / Paused) */}
                  {!isRunning && task.Status !== 'Completed' && (
                    <div className="space-y-2.5">
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span>1. ติ๊กเลือกชิ้นส่วนที่จะลงมือทำรอบนี้:</span>
                        <span className="text-blue-600 font-normal text-[10px]">
                          (เลือกอย่างน้อย 1 ชิ้นเพื่อกดเริ่ม)
                        </span>
                      </div>

                      {pendingParts.length === 0 ? (
                        <div className="text-xs font-semibold text-slate-400 py-1">
                          ไม่มีชิ้นส่วนคงค้างในขั้นตอนนี้
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {pendingParts.map((part) => {
                            const isChecked = currentCheckedToStart.includes(part.name);
                            return (
                              <button
                                key={part.name}
                                type="button"
                                onClick={() =>
                                  handleTogglePartSelectForStart(task.TaskID, part.name)
                                }
                                className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer select-none active:scale-[0.98] ${
                                  isChecked
                                    ? 'bg-blue-50/60 border-blue-500 text-blue-950 ring-1 ring-blue-500/20'
                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                                style={{ minHeight: '46px' }}
                              >
                                <span
                                  className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 text-xs font-bold ${
                                    isChecked
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isChecked && '✓'}
                                </span>
                                <span className="truncate">{part.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Case 2: Timer IS running */}
                  {isRunning && (
                    <div className="bg-emerald-50/70 border border-emerald-300 p-4 rounded-xl space-y-2">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                        กำลังจับเวลาชิ้นงานที่กำลังลงมือทำ:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activePartsInSession.map((pName, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold px-2.5 py-1 rounded-md"
                          >
                            🛠 {pName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timer & Main Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">เวลาซ่อมรวมสะสม:</span>
                      <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {formatClockFromSeconds(currentTotalSeconds)}
                      </span>
                    </div>

                    {!isRunning ? (
                      task.Status !== 'Completed' ? (
                        <button
                          type="button"
                          onClick={() => handleStartSession(task)}
                          disabled={currentCheckedToStart.length === 0}
                          className={`w-full py-4 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm ${
                            currentCheckedToStart.length === 0
                              ? 'bg-slate-300 border-slate-300 cursor-not-allowed opacity-60'
                              : 'bg-blue-600 hover:bg-blue-500 border-blue-600 cursor-pointer active:scale-[0.98]'
                          }`}
                          style={{ minHeight: '48px' }}
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>▶ เริ่มบันทึกเวลางานชิ้นที่เลือก (START)</span>
                        </button>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-center py-3 rounded-xl text-xs flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ขั้นตอนซ่อมสีนี้เสร็จสมบูรณ์เรียบร้อยแล้ว
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleOpenPauseModal(task.TaskID)}
                          className="py-3.5 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
                          style={{ minHeight: '48px' }}
                        >
                          <Pause className="w-4 h-4 fill-white" />
                          <span>⏸ พักเวลา (PAUSE)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCompleteActiveParts(task, activePartsInSession)
                          }
                          className="py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
                          style={{ minHeight: '48px' }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>✓ ปิดงานสีชิ้นนี้ (COMPLETE)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Completed Parts Box */}
                  {completedParts.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        ชิ้นส่วนที่เสร็จเรียบร้อยแล้ว ({completedParts.length} ชิ้น):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {completedParts.map((p) => (
                          <span
                            key={p.name}
                            className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-md"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* PAUSE REASON DIALOG MODAL */}
      {pauseModalTaskId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-500" />
              ระบุสาเหตุการหยุดบันทึกเวลางาน
            </h3>

            <div className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 mb-1">สาเหตุมาตรฐาน</label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-slate-900 focus:outline-none"
                >
                  {pauseReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">บันทึกเพิ่มเติม (ตัวเลือก)</label>
                <input
                  type="text"
                  value={customPauseNote}
                  onChange={(e) => setCustomPauseNote(e.target.value)}
                  placeholder="เช่น พักเบรก 15 นาที หรือ รอสีแห้ง"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs font-bold pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPauseModalTaskId(null)}
                className="px-3.5 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmPause}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg transition-colors cursor-pointer"
              >
                บันทึกสถานะพักงาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
