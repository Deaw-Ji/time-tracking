import { SheetJobTask, SheetTimeLog } from '../types/shopFloor';

export interface ScheduleAdherence {
  actualStartDate: string | null;
  actualStartTime: string | null;
  actualCompleteDate: string | null;
  hasStarted: boolean;
  isCompleted: boolean;
  startAdherence: {
    status:
      | 'pending-scheduled'
      | 'pending-today'
      | 'pending-overdue'
      | 'started-ontime'
      | 'started-early'
      | 'started-late'
      | 'not-set';
    label: string;
    shortLabel: string;
    badgeClass: string;
    diffDays?: number;
  };
  dueAdherence: {
    status:
      | 'completed-ontime'
      | 'completed-late'
      | 'in-progress-ok'
      | 'in-progress-due-today'
      | 'in-progress-overdue'
      | 'not-set';
    label: string;
    shortLabel: string;
    badgeClass: string;
    diffDays?: number;
  };
}

/**
 * Calculates day difference: (actual - target) in days.
 * Positive = actual is after target (late/overdue)
 * Negative = actual is before target (early)
 * 0 = same day
 */
export function getDaysDiff(targetDateStr: string, actualDateStr: string): number {
  if (!targetDateStr || !actualDateStr) return 0;
  const [y1, m1, d1] = targetDateStr.split('-').map(Number);
  const [y2, m2, d2] = actualDateStr.split('-').map(Number);
  if (!y1 || !y2) return 0;
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Formats YYYY-MM-DD to friendly Thai date string e.g. "14 ต.ค." or "14 ต.ค. 69"
 */
export function formatThaiDate(dateStr?: string, showYear = false): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '-';
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = months[parseInt(parts[1], 10) - 1] || parts[1];
  const year = parseInt(parts[0], 10) + 543;
  const shortYear = year % 100;
  return showYear ? `${day} ${month} ${shortYear}` : `${day} ${month}`;
}

export function getTaskScheduleAdherence(
  task: SheetJobTask,
  timeLogs: SheetTimeLog[] = [],
  now = new Date()
): ScheduleAdherence {
  const todayStr = now.toISOString().split('T')[0];

  // Find start logs for this task
  const startLogs = timeLogs
    .filter((l) => l.TaskID === task.TaskID && l.Action === 'START')
    .sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());

  const earliestStartLog = startLogs[0];
  let actualStartDate = earliestStartLog ? earliestStartLog.Timestamp.split('T')[0] : null;
  const actualStartTime = earliestStartLog
    ? new Date(earliestStartLog.Timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Fallback: If status is In Progress, Paused, or Completed, but no start log found, consider task as started
  const isStartedByStatus = task.Status === 'In Progress' || task.Status === 'Paused' || task.Status === 'Completed';
  if (!actualStartDate && isStartedByStatus) {
    // If no log exists (e.g. initialized in progress), fallback to task.StartDate or today
    actualStartDate = task.StartDate || todayStr;
  }

  const hasStarted = !!actualStartDate || isStartedByStatus;

  // Find completion logs
  const completeLogs = timeLogs
    .filter((l) => l.TaskID === task.TaskID && l.Action === 'COMPLETE')
    .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
  const latestCompleteLog = completeLogs[0];
  let actualCompleteDate = latestCompleteLog ? latestCompleteLog.Timestamp.split('T')[0] : null;
  const isCompleted = task.Status === 'Completed';
  if (!actualCompleteDate && isCompleted) {
    actualCompleteDate = task.DueDate || todayStr;
  }

  // --- 1. Evaluate Start Adherence ---
  let startAdherence: ScheduleAdherence['startAdherence'];

  if (!task.StartDate) {
    startAdherence = {
      status: 'not-set',
      label: 'ไม่ได้ระบุวันเริ่ม',
      shortLabel: 'ไม่ระบุ',
      badgeClass: 'bg-slate-100 text-slate-500',
    };
  } else if (hasStarted && actualStartDate) {
    const diff = getDaysDiff(task.StartDate, actualStartDate);
    if (diff === 0) {
      startAdherence = {
        status: 'started-ontime',
        label: `เริ่มตรงกำหนด (${formatThaiDate(actualStartDate)})`,
        shortLabel: 'เริ่มตรงกำหนด',
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        diffDays: 0,
      };
    } else if (diff < 0) {
      const earlyDays = Math.abs(diff);
      startAdherence = {
        status: 'started-early',
        label: `เริ่มก่อนกำหนด ${earlyDays} วัน (${formatThaiDate(actualStartDate)})`,
        shortLabel: `ก่อนกำหนด ${earlyDays}ว.`,
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        diffDays: diff,
      };
    } else {
      startAdherence = {
        status: 'started-late',
        label: `เริ่มช้ากว่ากำหนด ${diff} วัน (${formatThaiDate(actualStartDate)})`,
        shortLabel: `เริ่มช้า ${diff}ว.`,
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
        diffDays: diff,
      };
    }
  } else {
    // Has NOT started yet
    const diff = getDaysDiff(task.StartDate, todayStr);
    if (diff > 0) {
      startAdherence = {
        status: 'pending-overdue',
        label: `เลยกำหนดเริ่มแล้ว ${diff} วัน (ควรเริ่ม ${formatThaiDate(task.StartDate)})`,
        shortLabel: `เลยเริ่ม ${diff}ว.`,
        badgeClass: 'bg-rose-50 text-rose-700 border border-rose-300 font-bold animate-pulse',
        diffDays: diff,
      };
    } else if (diff === 0) {
      startAdherence = {
        status: 'pending-today',
        label: 'ครบกำหนดเริ่มวันนี้',
        shortLabel: 'เริ่มวันนี้',
        badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold',
        diffDays: 0,
      };
    } else {
      const remainingDays = Math.abs(diff);
      startAdherence = {
        status: 'pending-scheduled',
        label: `ตามแผนงาน (อีก ${remainingDays} วัน)`,
        shortLabel: `อีก ${remainingDays}ว.`,
        badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
        diffDays: diff,
      };
    }
  }

  // --- 2. Evaluate Due Adherence ---
  let dueAdherence: ScheduleAdherence['dueAdherence'];

  if (!task.DueDate) {
    dueAdherence = {
      status: 'not-set',
      label: 'ไม่ได้ระบุวันเสร็จ',
      shortLabel: 'ไม่ระบุ',
      badgeClass: 'bg-slate-100 text-slate-500',
    };
  } else if (isCompleted && actualCompleteDate) {
    const diff = getDaysDiff(task.DueDate, actualCompleteDate);
    if (diff <= 0) {
      dueAdherence = {
        status: 'completed-ontime',
        label: `เสร็จตามแผน (${formatThaiDate(actualCompleteDate)})`,
        shortLabel: 'เสร็จตามแผน',
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        diffDays: diff,
      };
    } else {
      dueAdherence = {
        status: 'completed-late',
        label: `เสร็จช้ากว่ากำหนด ${diff} วัน`,
        shortLabel: `ช้า ${diff}ว.`,
        badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
        diffDays: diff,
      };
    }
  } else {
    // In Progress or Pending
    const diff = getDaysDiff(task.DueDate, todayStr);
    if (diff > 0) {
      dueAdherence = {
        status: 'in-progress-overdue',
        label: `เกินกำหนดเสร็จ ${diff} วัน! (ครบกำหนด ${formatThaiDate(task.DueDate)})`,
        shortLabel: `เกินกำหนด ${diff}ว.`,
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
        diffDays: diff,
      };
    } else if (diff === 0) {
      dueAdherence = {
        status: 'in-progress-due-today',
        label: 'ครบกำหนดเสร็จวันนี้',
        shortLabel: 'ส่งมอบวันนี้',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
        diffDays: 0,
      };
    } else {
      const remaining = Math.abs(diff);
      dueAdherence = {
        status: 'in-progress-ok',
        label: `เหลือเวลาอีก ${remaining} วัน`,
        shortLabel: `เหลือ ${remaining}ว.`,
        badgeClass: 'bg-slate-50 text-slate-600 border border-slate-200',
        diffDays: diff,
      };
    }
  }

  return {
    actualStartDate,
    actualStartTime,
    actualCompleteDate,
    hasStarted,
    isCompleted,
    startAdherence,
    dueAdherence,
  };
}
