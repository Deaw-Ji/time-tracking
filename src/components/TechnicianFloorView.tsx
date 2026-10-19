import React, { useState, useEffect } from 'react';
import {
  SheetJob,
  SheetJobTask,
  SheetTimeLog,
  SheetUser,
  ActiveTechSession,
  TimeLogAction,
  HelpRequest,
} from '../types/shopFloor';
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Info,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  ScanLine,
  Search,
  QrCode,
  Copy,
  Check,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { formatClockFromSeconds } from './DashboardView';
import {
  getTaskScheduleAdherence,
  formatThaiDate,
  formatThaiDateTime,
  formatThaiTime,
} from '../utils/scheduleHelper';

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
    note: string,
    updatedChecklist?: string
  ) => void;
  onUpdateTaskChecklist: (taskId: string, checklistString: string) => void;
  helpRequests?: HelpRequest[];
  onRequestHelp?: (taskId: string, jobId: string, requesterEmail: string) => void;
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
  helpRequests = [],
  onRequestHelp = () => {},
}) => {
  const technicians = users.filter((u) => u.Role === 'Technician' && u.Status === 'Active');

  // Decide which tech email we are active on (locked to self if Tech role, or switcher for Admin/Controller)
  const activeTechEmail =
    currentUser.Role === 'Technician'
      ? currentUser.Email
      : selectedTechEmail || (technicians[0]?.Email ?? '');

  const activeTechObj =
    users.find((u) => u.Email.toLowerCase() === activeTechEmail.toLowerCase()) || currentUser;

  const getTechDisplayName = (email: string) => {
    const u = users.find((user) => user.Email.toLowerCase() === email.toLowerCase());
    if (!u) return email.split('@')[0];
    return u.Nickname || u.Name || email.split('@')[0];
  };

  const getTaskTechTimeBreakdown = (taskId: string) => {
    const taskLogs = timeLogs.filter((l) => l.TaskID === taskId);
    const sortedLogs = [...taskLogs].sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
    const techMap = new Map<string, number>();
    let activeStart: { [tech: string]: string } = {};
    sortedLogs.forEach((log) => {
      const tech = log.TechEmail.toLowerCase();
      if (log.Action === 'START') {
        activeStart[tech] = log.Timestamp;
      } else if ((log.Action === 'PAUSE' || log.Action === 'COMPLETE') && activeStart[tech]) {
        const secs = Math.max(0, Math.floor((new Date(log.Timestamp).getTime() - new Date(activeStart[tech]).getTime()) / 1000));
        techMap.set(tech, (techMap.get(tech) || 0) + secs);
        delete activeStart[tech];
      }
    });
    Object.entries(activeStart).forEach(([tech, startTs]) => {
      const secs = Math.max(0, Math.floor((nowMs - new Date(startTs).getTime()) / 1000));
      techMap.set(tech, (techMap.get(tech) || 0) + secs);
    });
    return techMap;
  };

  // Selected Task ID to view / work on (null = Master Queue Screen)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Barcode search & scanner modal state
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // Local state to keep track of checked parts before clicking START for each Task
  const [checkedPartsToStart, setCheckedPartsToStart] = useState<Record<string, string[]>>({});

  // Pause modal state
  const [pauseModalTaskId, setPauseModalTaskId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(pauseReasons[0] || 'รออะไหล่/รอชิ้นงาน');
  const [customPauseNote, setCustomPauseNote] = useState('');

  // Copy feedback state & session log history drawer
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showTimeLogsHistory, setShowTimeLogsHistory] = useState(false);
  const [confirmCompleteEntireTask, setConfirmCompleteEntireTask] = useState<SheetJobTask | null>(null);

  const handleCopyText = (text: string, fieldId: string) => {
    if (!text || text === '-' || text === 'ยังไม่ได้เริ่มงาน' || text === 'ยังไม่เสร็จสิ้น') return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedField(fieldId);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Lock body scroll when pause modal or scanner modal is active
  useEffect(() => {
    if (pauseModalTaskId || isScannerModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [pauseModalTaskId, isScannerModalOpen]);

  // Filter tasks assigned to this technician
  const baseMyAssignedTasks = jobTasks.filter((t) => {
    if (!t.AssignedTechs) return false;
    const emailList = t.AssignedTechs.toLowerCase()
      .split(',')
      .map((s) => s.trim());
    const candidates = [
      activeTechEmail.toLowerCase(),
      activeTechObj?.Email?.toLowerCase(),
      activeTechObj?.UserID?.toLowerCase(),
      activeTechObj?.Name?.toLowerCase(),
      activeTechObj?.Nickname?.toLowerCase(),
    ].filter(Boolean);
    return emailList.some((tech) => candidates.includes(tech));
  });

  const myAssignedTasks = baseMyAssignedTasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const job = jobs.find((j) => j.JobID === t.JobID);
    return (
      t.TaskID.toLowerCase().includes(q) ||
      t.JobID.toLowerCase().includes(q) ||
      t.TaskName.toLowerCase().includes(q) ||
      (job?.LicensePlate && job.LicensePlate.toLowerCase().includes(q)) ||
      (job?.VIN && job.VIN.toLowerCase().includes(q)) ||
      (job?.CarModel && job.CarModel.toLowerCase().includes(q))
    );
  });

  // 1. In Progress Tasks: กำลังทำงานอยู่หรือกำลังจับเวลา (Active / In Progress)
  const inProgressTasks = myAssignedTasks
    .filter((t) => {
      if (t.Status === 'Completed') return false;
      const isRunning = activeSessions.some(
        (s) =>
          s.TaskID === t.TaskID &&
          s.TechEmail.toLowerCase() === activeTechEmail.toLowerCase()
      );
      return isRunning || t.Status === 'In Progress';
    })
    .sort((a, b) => {
      const dateA = a.StartDate || '9999-99-99';
      const dateB = b.StartDate || '9999-99-99';
      return dateA.localeCompare(dateB);
    });

  // 2. Pending Tasks: งานที่รอดำเนินการ / พร้อมเริ่ม (Pending / Ready to Start)
  const pendingTasks = myAssignedTasks
    .filter((t) => {
      if (t.Status === 'Completed') return false;
      const isRunning = activeSessions.some(
        (s) =>
          s.TaskID === t.TaskID &&
          s.TechEmail.toLowerCase() === activeTechEmail.toLowerCase()
      );
      return !isRunning && t.Status !== 'In Progress';
    })
    .sort((a, b) => {
      // Sort primarily by StartDate (earliest date first FIFO)
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

  // 3. Completed Tasks: งานที่ทำเสร็จสมบูรณ์แล้ว
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

  // Helper to trigger completing currently active parts (pauses if more parts remain, completes if all parts are done)
  const handleCompleteActiveParts = (task: SheetJobTask, activePartsFromSession: string[]) => {
    const listItems = task.PartsChecklist
      ? task.PartsChecklist.split(',').map((p) => {
          const [name, state] = p.split(':');
          return { name, state: state || 'todo' };
        })
      : [];

    const updatedList = listItems.map((item) => {
      if (activePartsFromSession.includes(item.name)) {
        return { name: item.name, state: 'done' };
      }
      return item;
    });

    const checklistString = updatedList.map((i) => `${i.name}:${i.state}`).join(',');
    const hasPendingParts = updatedList.some((item) => item.state !== 'done');

    if (hasPendingParts) {
      onRecordTimeAction(
        task.TaskID,
        activeTechEmail,
        'PAUSE',
        `บันทึกเสร็จเฉพาะชิ้น: [${activePartsFromSession.join(', ')}] (พักเวลารอทำชิ้นที่เหลือ)`,
        checklistString
      );
    } else {
      onRecordTimeAction(
        task.TaskID,
        activeTechEmail,
        'COMPLETE',
        `เสร็จครบทุกชิ้นแล้ว: ทำสี [${activePartsFromSession.join(', ')}] ครบเรียบร้อย`,
        checklistString
      );
    }

    setCheckedPartsToStart((prev) => {
      const copy = { ...prev };
      delete copy[task.TaskID];
      return copy;
    });
  };

  // Helper to force complete ENTIRE task 100% (marks all checklist items done and sets task to Completed)
  const handleCompleteEntireTask100 = (task: SheetJobTask) => {
    const listItems = task.PartsChecklist
      ? task.PartsChecklist.split(',').map((p) => {
          const [name] = p.split(':');
          return `${name}:done`;
        }).join(',')
      : '';

    onRecordTimeAction(
      task.TaskID,
      activeTechEmail,
      'COMPLETE',
      'เสร็จสิ้นขั้นตอนนี้ทั้งหมด 100% (COMPLETE)',
      listItems
    );

    setCheckedPartsToStart((prev) => {
      const copy = { ...prev };
      delete copy[task.TaskID];
      return copy;
    });

    setConfirmCompleteEntireTask(null);
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

      {/* Search and Barcode Quick Scan Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="สแกนบาร์โค้ด หรือพิมพ์ค้นหาเลขที่ JOB, ทะเบียน, VIN, ขั้นตอน..."
            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
            >
              ล้างคำค้น
            </button>
          )}
        </div>
        <button
          onClick={() => setIsScannerModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer whitespace-nowrap"
        >
          <ScanLine className="w-4 h-4" />
          <span>📷 เปิดกล้องสแกนบาร์โค้ด</span>
        </button>
      </div>

      {/* VIEW MODE 1: MASTER QUEUE SCREEN (เมื่อยังไม่ได้กดเลือกคันใดคันหนึ่ง) */}
      {!selectedTask ? (
        <div className="space-y-6">
          {/* 1. ตารางชุดที่ 1: งานที่กำลังทำอยู่ (จับเวลาอยู่ หรือ In Progress) */}
          {inProgressTasks.length > 0 && (
            <div className="bg-white border-2 border-emerald-400 rounded-2xl overflow-hidden shadow-xs ring-2 ring-emerald-500/10">
              <div className="p-4 border-b border-emerald-200 flex items-center justify-between bg-emerald-50/70">
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <Play className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                    1. งานที่กำลังดำเนินการอยู่ ({inProgressTasks.length} คัน)
                  </h3>
                  <p className="text-[11px] text-emerald-800 mt-0.5 font-medium">
                    กำลังจับเวลาทำสีหรือเปิดงานค้างไว้ • แตะที่แถวเพื่อเข้าไปบันทึกหรือพักงาน
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white font-mono">
                  ACTIVE ({inProgressTasks.length})
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-emerald-100/60 text-emerald-900 font-bold border-b border-emerald-200">
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขที่ JOB / ขั้นตอน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ยี่ห้อ · รุ่น · สี (Vehicle)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ทะเบียน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขตัวถัง (VIN)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">กำหนดเริ่ม - เสร็จ</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">ติดตามเริ่มงานจริง</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 text-slate-700 bg-white">
                    {inProgressTasks.map((task) => {
                      const job = jobs.find((j) => j.JobID === task.JobID);
                      const isRunning = activeSessions.some(
                        (s) =>
                          s.TaskID === task.TaskID &&
                          s.TechEmail.toLowerCase() === activeTechEmail.toLowerCase()
                      );
                      const adherence = getTaskScheduleAdherence(task, timeLogs);

                      return (
                        <tr
                          key={task.TaskID}
                          onClick={() => setSelectedTaskId(task.TaskID)}
                          className="cursor-pointer transition-colors bg-emerald-50/30 hover:bg-emerald-100/50 active:bg-emerald-200/50"
                        >
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-emerald-800">
                            <div className="flex items-center gap-1.5">
                              {isRunning && (
                                <span
                                  className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                                  title="กำลังจับเวลา"
                                ></span>
                              )}
                              <span>{job?.JobID || task.JobID}</span>
                            </div>
                            <span className="text-[10px] text-slate-600 font-semibold block truncate max-w-[130px]">
                              {task.TaskName.replace(' — ', ' · ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>🚗 {job?.CarBrand || '-'} {job?.CarModel || ''}</span>
                            </div>
                            {job?.CarColor && (
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                สี: {job.CarColor}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-bold text-slate-900">
                            {job?.LicensePlate || '-'}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {job?.VIN || '-'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono">
                            <div className="flex items-center justify-center gap-1 text-[11px]">
                              <span className="font-semibold text-slate-800" title={`กำหนดเริ่ม: ${task.StartDate || '-'}`}>
                                {formatThaiDate(task.StartDate)}
                              </span>
                              <span className="text-slate-400">➔</span>
                              <span className="font-semibold text-amber-800" title={`กำหนดเสร็จ: ${task.DueDate || '-'}`}>
                                {formatThaiDate(task.DueDate)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <div className="space-y-1">
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${adherence.startAdherence.badgeClass}`}>
                                {adherence.startAdherence.label}
                              </span>
                              {adherence.dueAdherence.status === 'in-progress-overdue' && (
                                <div>
                                  <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded font-bold ${adherence.dueAdherence.badgeClass}`}>
                                    {adherence.dueAdherence.label}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-2 text-right whitespace-nowrap">
                            <ChevronRight className="w-4 h-4 text-emerald-600 inline font-bold" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. ตารางชุดที่ 2: งานที่รอดำเนินการ / พร้อมเริ่ม (เรียงตามกำหนดเริ่มงาน ลำดับก่อน-หลัง) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  2. งานที่รอดำเนินการ / พร้อมเริ่ม ({pendingTasks.length} รายการ)
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
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขที่ JOB / ขั้นตอน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ยี่ห้อ · รุ่น · สี (Vehicle)</th>
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
                      const adherence = getTaskScheduleAdherence(task, timeLogs);

                      return (
                        <tr
                          key={task.TaskID}
                          onClick={() => setSelectedTaskId(task.TaskID)}
                          className="cursor-pointer transition-colors hover:bg-blue-50/40 active:bg-blue-100/50"
                        >
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-blue-600">
                            <span>{job?.JobID || task.JobID}</span>
                            <span className="text-[10px] text-slate-500 font-normal block truncate max-w-[130px]">
                              {task.TaskName.replace(' — ', ' · ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>🚗 {job?.CarBrand || '-'} {job?.CarModel || ''}</span>
                            </div>
                            {job?.CarColor && (
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                สี: {job.CarColor}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-bold text-slate-900">
                            {job?.LicensePlate || '-'}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {job?.VIN || '-'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-slate-700">
                            <div className="space-y-1">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {formatThaiDate(task.StartDate)}
                              </span>
                              <div>
                                <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded font-medium ${adherence.startAdherence.badgeClass}`}>
                                  {adherence.startAdherence.label}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-amber-700 font-semibold">
                            <span className="bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                              {formatThaiDate(task.DueDate)}
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

          {/* 3. ตารางชุดที่ 3: งานที่เสร็จแล้ว */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  3. งานที่เสร็จแล้ว ({completedTasks.length} รายการ)
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
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขที่ JOB / ขั้นตอน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ยี่ห้อ · รุ่น · สี (Vehicle)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ทะเบียน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">เลขตัวถัง (VIN)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">เวลาเริ่มจริง (START)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">เวลาเสร็จจริง (FINISH)</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">รวมเวลาซ่อม</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {completedTasks.map((task) => {
                      const job = jobs.find((j) => j.JobID === task.JobID);
                      const adherence = getTaskScheduleAdherence(task, timeLogs);

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
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span>🚗 {job?.CarBrand || '-'} {job?.CarModel || ''}</span>
                            </div>
                            {job?.CarColor && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                สี: {job.CarColor}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-semibold text-slate-700">
                            {job?.LicensePlate || '-'}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                            {job?.VIN || '-'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-emerald-800 text-[11px]">
                            <span className="bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded font-semibold inline-block">
                              {adherence.actualStartFormatted}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-blue-800 text-[11px]">
                            <span className="bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded font-semibold inline-block">
                              {adherence.actualCompleteFormatted}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono text-slate-800 text-[11px]">
                            {(() => {
                              const techMap = getTaskTechTimeBreakdown(task.TaskID);
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  {techMap.size > 0 ? (
                                    <div className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                                      {Array.from(techMap.entries()).map(([techEmail, secs]) => (
                                        <div key={techEmail} className="flex items-center justify-center gap-1">
                                          <span className="text-slate-500">{getTechDisplayName(techEmail)}:</span>
                                          <span className="font-bold text-slate-800">{formatClockFromSeconds(secs)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">00:00:00</span>
                                  )}
                                  <div className="font-bold text-slate-900 border-t border-slate-200 pt-0.5 mt-0.5 w-full">
                                    รวม: {formatClockFromSeconds(task.TotalMinutes * 60)}
                                  </div>
                                </div>
                              );
                            })()}
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

          {/* Department Tasks / Help Request Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>👥</span>
              งานอื่นๆ ภายในแผนก {activeTechObj.Department} (ขอเข้าช่วยงานเพื่อนร่วมแผนก)
            </h4>
            <p className="text-[11px] text-slate-500">
              เมื่อคุณทำงานส่วนตัวเสร็จแล้ว สามารถกดขอเข้าช่วยงานเพื่อนร่วมแผนกในคันอื่นๆ ได้ เมื่อ Controller อนุมัติ คุณจะสามารถเข้าทำงานร่วมกันได้ทันที
            </p>

            {jobTasks
              .filter((t) => {
                if (t.Status === 'Completed') return false;
                const assigned = t.AssignedTechs.toLowerCase();
                if (assigned.includes(activeTechEmail.toLowerCase())) return false;
                const assignedUsers = users.filter((u) => assigned.includes(u.Email.toLowerCase()));
                return assignedUsers.some(
                  (u) => u.Department.trim().toLowerCase() === activeTechObj.Department.trim().toLowerCase()
                );
              })
              .length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">ไม่มีงานอื่นในแผนกขณะนี้</div>
            ) : (
              <div className="space-y-2">
                {jobTasks
                  .filter((t) => {
                    if (t.Status === 'Completed') return false;
                    const assigned = t.AssignedTechs.toLowerCase();
                    if (assigned.includes(activeTechEmail.toLowerCase())) return false;
                    const assignedUsers = users.filter((u) => assigned.includes(u.Email.toLowerCase()));
                    return assignedUsers.some(
                      (u) => u.Department.trim().toLowerCase() === activeTechObj.Department.trim().toLowerCase()
                    );
                  })
                  .map((task) => {
                    const job = jobs.find((j) => j.JobID === task.JobID);
                    const pendingReq = (helpRequests || []).find(
                      (r) =>
                        r.TaskID === task.TaskID &&
                        r.RequesterEmail.toLowerCase() === activeTechEmail.toLowerCase() &&
                        r.Status === 'Pending'
                    );
                    const approvedReq = (helpRequests || []).find(
                      (r) =>
                        r.TaskID === task.TaskID &&
                        r.RequesterEmail.toLowerCase() === activeTechEmail.toLowerCase() &&
                        r.Status === 'Approved'
                    );

                    return (
                      <div key={task.TaskID} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{job?.JobID || task.JobID} · {task.TaskName}</span>
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                              {job?.LicensePlate || '-'} ({job?.CarBrand || ''} {job?.CarModel || ''})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            ผู้รับผิดชอบหลัก: {task.AssignedTechs}
                          </div>
                        </div>
                        <div>
                          {approvedReq ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
                              ✓ ได้รับอนุมัติให้ช่วยงานแล้ว (คลิกเลือกที่คิวงานเพื่อเริ่ม)
                            </span>
                          ) : pendingReq ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-xs">
                              ⏳ ส่งคำขอแล้ว (รอ Controller อนุมัติ)
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onRequestHelp?.(task.TaskID, task.JobID, activeTechEmail)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs shadow-2xs"
                            >
                              🤝 ขอเข้าช่วยงานนี้
                            </button>
                          )}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900">
                          🚗 {parentJob.CarBrand || ''} {parentJob.CarModel || ''} {parentJob.LicensePlate}
                        </span>
                        {parentJob.CarColor && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-semibold border border-slate-300">
                            สี: {parentJob.CarColor}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 block mt-1">
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
                    {(() => {
                      const adherence = getTaskScheduleAdherence(task, timeLogs);
                      const taskLogs = timeLogs
                        .filter((l) => l.TaskID === task.TaskID)
                        .sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());

                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
                            <span>กำหนดเริ่ม: <strong className="text-slate-800">{formatThaiDate(task.StartDate)}</strong></span>
                            <span>·</span>
                            <span>กำหนดเสร็จ (SLA): <strong className="text-amber-800">{formatThaiDate(task.DueDate)}</strong></span>
                            <span>·</span>
                            <span className="text-blue-600 font-semibold">ส่งมอบลูกค้า (SA): {formatThaiDate(parentJob.DeliveryDate || parentJob.DueDate)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${adherence.startAdherence.badgeClass}`}>
                              {adherence.startAdherence.label}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${adherence.dueAdherence.badgeClass}`}>
                              {adherence.dueAdherence.label}
                            </span>
                          </div>

                          {/* ข้อมูลเวลาเริ่มจริงและเวลาเสร็จจริง สำหรับลงข้อมูลในระบบหลัก */}
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                <span>บันทึกเวลาจริง (สำหรับคีย์ลงระบบหลัก):</span>
                              </span>
                              {copiedField && (
                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full animate-fadeIn">
                                  ✓ คัดลอกแล้ว
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* กล่องเวลาเริ่มงานจริง */}
                              <div className="bg-emerald-50/80 border border-emerald-300/80 rounded-xl p-2.5 flex items-start justify-between gap-2 shadow-2xs">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-900 uppercase">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                    <span>เวลาเริ่มงานจริง (START)</span>
                                  </div>
                                  <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono mt-1">
                                    {adherence.actualStartFormatted}
                                  </div>
                                  {adherence.actualStartTime && (
                                    <div className="text-[10px] text-emerald-800 font-mono mt-0.5 font-semibold">
                                      เฉพาะเวลา: {adherence.actualStartTime}
                                    </div>
                                  )}
                                </div>
                                {adherence.hasStarted && adherence.actualStartFormatted !== 'ยังไม่ได้เริ่มงาน' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(adherence.actualStartFormatted, 'start-full')}
                                    title="คัดลอกวันและเวลาเริ่ม"
                                    className="px-2 py-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 bg-white shrink-0 flex items-center gap-1 cursor-pointer active:scale-95"
                                  >
                                    {copiedField === 'start-full' ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>คัดลอกแล้ว</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>คัดลอก</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* กล่องเวลาเสร็จจริง */}
                              <div className="bg-blue-50/80 border border-blue-300/80 rounded-xl p-2.5 flex items-start justify-between gap-2 shadow-2xs">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-900 uppercase">
                                    <span className={`h-2 w-2 rounded-full ${task.Status === 'Completed' ? 'bg-blue-600' : isRunning ? 'bg-amber-500 animate-ping' : 'bg-slate-400'}`}></span>
                                    <span>เวลาเสร็จจริง (FINISH)</span>
                                  </div>
                                  <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono mt-1">
                                    {adherence.actualCompleteFormatted}
                                  </div>
                                  {adherence.actualCompleteTime && task.Status === 'Completed' && (
                                    <div className="text-[10px] text-blue-800 font-mono mt-0.5 font-semibold">
                                      เฉพาะเวลา: {adherence.actualCompleteTime}
                                    </div>
                                  )}
                                </div>
                                {adherence.isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(adherence.actualCompleteFormatted, 'finish-full')}
                                    title="คัดลอกวันและเวลาเสร็จ"
                                    className="px-2 py-1 text-[11px] font-bold text-blue-800 hover:text-blue-950 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 bg-white shrink-0 flex items-center gap-1 cursor-pointer active:scale-95"
                                  >
                                    {copiedField === 'finish-full' ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-blue-600" />
                                        <span>คัดลอกแล้ว</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>คัดลอก</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* ลิสต์ประวัติรอบเวลา (Session Logs) */}
                            {taskLogs.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => setShowTimeLogsHistory(!showTimeLogsHistory)}
                                  className="text-[11px] font-semibold text-slate-600 hover:text-blue-700 flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  {showTimeLogsHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  <span>{showTimeLogsHistory ? 'ซ่อน' : 'แสดง'}ประวัติการกดเวลาแต่ละรอบย่อย ({taskLogs.length} รายการ)</span>
                                </button>
                                {showTimeLogsHistory && (
                                  <div className="mt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs animate-fadeIn">
                                    {taskLogs.map((log) => (
                                      <div key={log.LogID} className="flex items-center justify-between py-1 border-b border-slate-200/60 last:border-b-0 text-[11px]">
                                        <div className="flex items-center gap-2">
                                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                                            log.Action === 'START'
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                              : log.Action === 'PAUSE'
                                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                                          }`}>
                                            {log.Action}
                                          </span>
                                          <span className="font-mono text-slate-700 font-semibold">
                                            {formatThaiDateTime(log.Timestamp, false)}
                                          </span>
                                        </div>
                                        <div className="text-right text-[10px] text-slate-500">
                                          {log.DurationMinutes > 0 && (
                                            <span className="font-bold text-slate-800 mr-2">{log.DurationMinutes} นาที</span>
                                          )}
                                          {log.Note && <span className="text-slate-500 truncate max-w-[140px] inline-block">{log.Note}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
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
                    {/* Line 1: Per-technician breakdown */}
                    {(() => {
                      const techMap = getTaskTechTimeBreakdown(task.TaskID);
                      return techMap.size > 0 ? (
                        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            ⏱ เวลาทำงานแยกตามช่างแต่ละคน:
                          </div>
                          {Array.from(techMap.entries()).map(([techEmail, secs]) => (
                            <div key={techEmail} className="flex items-center justify-between text-xs">
                              <span className="text-slate-700 font-medium">👤 {getTechDisplayName(techEmail)}</span>
                              <span className="font-mono font-bold text-slate-800">{formatClockFromSeconds(secs)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {/* Line 2: Combined Total */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-700 font-bold">เวลาซ่อมรวมสะสม:</span>
                      <span className="font-mono text-xl font-extrabold text-blue-700 tabular-nums">
                        {formatClockFromSeconds(currentTotalSeconds)}
                      </span>
                    </div>

                    {task.Status === 'Completed' ? (() => {
                      const adherence = getTaskScheduleAdherence(task, timeLogs);
                      return (
                        <div className="bg-emerald-50/90 border border-emerald-300 text-emerald-950 rounded-xl p-3.5 space-y-2 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>ขั้นตอนซ่อมสีนี้เสร็จสมบูรณ์เรียบร้อยแล้ว</span>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                              พร้อมส่งต่องวดถัดไป
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-200/80 text-xs">
                            <div className="bg-white/95 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                              <div className="min-w-0">
                                <span className="text-[10px] text-slate-500 block">🟢 เวลาเริ่มงานจริง:</span>
                                <span className="font-bold font-mono text-slate-900 text-xs block mt-0.5 truncate">
                                  {adherence.actualStartFormatted}
                                </span>
                              </div>
                              {adherence.hasStarted && adherence.actualStartFormatted !== 'ยังไม่ได้เริ่มงาน' && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(adherence.actualStartFormatted, 'btm-start')}
                                  title="คัดลอกเวลาเริ่ม"
                                  className="p-1 text-slate-400 hover:text-emerald-700 rounded hover:bg-slate-100 shrink-0"
                                >
                                  {copiedField === 'btm-start' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>

                            <div className="bg-white/95 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                              <div className="min-w-0">
                                <span className="text-[10px] text-slate-500 block">🏁 เวลาเสร็จจริง:</span>
                                <span className="font-bold font-mono text-slate-900 text-xs block mt-0.5 truncate">
                                  {adherence.actualCompleteFormatted}
                                </span>
                              </div>
                              {adherence.isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(adherence.actualCompleteFormatted, 'btm-finish')}
                                  title="คัดลอกเวลาเสร็จ"
                                  className="p-1 text-slate-400 hover:text-blue-700 rounded hover:bg-slate-100 shrink-0"
                                >
                                  {copiedField === 'btm-finish' ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })() : !isRunning ? (
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
                      <div className="space-y-2">
                        {pendingParts.length > activePartsInSession.length ? (
                          <>
                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleOpenPauseModal(task.TaskID)}
                                className="py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                                style={{ minHeight: '44px' }}
                              >
                                <Pause className="w-3.5 h-3.5 fill-white" />
                                <span>⏸ พักเวลา (PAUSE)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCompleteActiveParts(task, activePartsInSession)
                                }
                                className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                                style={{ minHeight: '44px' }}
                                title="บันทึกชิ้นส่วนที่ทำอยู่นี้ว่าเสร็จ แล้วพักเวลารอทำชิ้นที่เหลือ"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>✓ บันทึกชิ้นนี้เสร็จ (พักรอชิ้นอื่น)</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfirmCompleteEntireTask(task)}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98] border border-emerald-500"
                              style={{ minHeight: '44px' }}
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>✓ เสร็จสิ้นขั้นตอนนี้ทั้งหมด 100% (COMPLETE)</span>
                            </button>
                          </>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenPauseModal(task.TaskID)}
                              className="py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
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
                              className="py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
                              style={{ minHeight: '48px' }}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>✓ เสร็จสิ้นขั้นตอนนี้ทั้งหมด (COMPLETE)</span>
                            </button>
                          </div>
                        )}
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

      {/* CONFIRM COMPLETE ENTIRE TASK MODAL */}
      {confirmCompleteEntireTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">ยืนยันปิดจบขั้นตอนนี้ 100%</h3>
                <p className="text-[11px] text-slate-500">ขั้นตอน: {confirmCompleteEntireTask.TaskName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              ระบบจะทำเครื่องหมายติ๊กถูก (✓) ชิ้นส่วนทั้งหมดในขั้นตอนนึงให้เสร็จสมบูรณ์ และปรับสถานะเป็น <b>Completed</b> ถาวร (ไม่สามารถแก้ไขกลับเป็นพักงานได้อีก)
            </p>

            <div className="flex justify-end gap-2 text-xs font-bold pt-2">
              <button
                type="button"
                onClick={() => setConfirmCompleteEntireTask(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleCompleteEntireTask100(confirmCompleteEntireTask)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                ยืนยันปิดจบ 100%
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onScanSuccess={(text) => {
          setSearchQuery(text);
          setIsScannerModalOpen(false);
        }}
        assignedTasks={baseMyAssignedTasks}
        jobs={jobs}
      />
    </div>
  );
};

function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  assignedTasks,
  jobs,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (text: string) => void;
  assignedTasks: SheetJobTask[];
  jobs: SheetJob[];
}) {
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (isOpen) {
      const timer = setTimeout(() => {
        try {
          html5QrCode = new Html5Qrcode('reader');
          html5QrCode
            .start(
              { facingMode: 'environment' },
              { fps: 10, qrbox: { width: 250, height: 150 } },
              (decodedText) => {
                onScanSuccess(decodedText);
                if (html5QrCode && html5QrCode.isScanning) {
                  html5QrCode.stop().catch(() => {});
                }
              },
              () => {}
            )
            .catch((err) => {
              console.warn('Camera access note:', err);
            });
        } catch (e) {
          console.warn('Scanner init note:', e);
        }
      }, 400);
      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              html5QrCode.stop().catch(() => {});
            }
          } catch {}
        }
      };
    }
  }, [isOpen, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-400" />
            สแกนบาร์โค้ดใบงาน (Barcode Scanner)
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative h-56 bg-slate-950 rounded-xl overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-blue-500/50">
            <div id="reader" className="absolute inset-0 w-full h-full"></div>
            <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-lg shadow-red-500 animate-bounce pointer-events-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              หรือเลือกงานจากรายการ (Quick Select):
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-slate-50">
              {assignedTasks.length > 0 ? (
                assignedTasks.map((t) => {
                  const job = jobs.find((j) => j.JobID === t.JobID);
                  return (
                    <div
                      key={t.TaskID}
                      onClick={() => onScanSuccess(t.JobID)}
                      className="pt-1.5 pb-1.5 px-2 rounded-lg hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 font-mono">
                          JOB: {t.JobID} {job?.LicensePlate ? `(${job.LicensePlate})` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500">{t.TaskName}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        เลือกงานนี้
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  ไม่มีงานที่ได้รับมอบหมาย
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
