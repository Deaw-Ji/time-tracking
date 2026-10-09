export type UserRole = 'Admin' | 'Controller' | 'Technician';

export interface SheetUser {
  UserID: string; // EmployeeID e.g. "EMP-001"
  Username?: string; // Custom username e.g. "somchai" or "tech01"
  Email: string; // Used as Username or Email for Login
  Password?: string; // Stored securely
  Name: string; // Full Name
  Nickname?: string; // Nickname for friendly layout
  Role: UserRole;
  Department: string;
  Skills: string;
  Status: 'Active' | 'Inactive';
}

export type JobStatus = 'Open' | 'In Progress' | 'Paused' | 'Completed';

export interface SheetJob {
  JobID: string;
  LicensePlate: string;
  VIN: string;
  CustomerName: string;
  JobType: string;
  JobDetails: string;
  DueDate: string; // YYYY-MM-DD (วันกำหนดรถเสร็จ)
  DeliveryDate?: string; // YYYY-MM-DD (วันกำหนดส่งมอบรถลูกค้า)
  Status: JobStatus;
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Paused' | 'Completed';

export interface SheetJobTask {
  TaskID: string;
  JobID: string;
  TaskName: string; // SOP Stage Name e.g. "ถอดประกอบ", "เคาะ", "เตรียมพื้น", "พ่นสี", "ขัดสี", "QC"
  AssignedTechs: string; // Comma-separated emails e.g. "tech1@auto.co.th, tech2@auto.co.th"
  StartDate: string; // YYYY-MM-DD
  DueDate: string; // YYYY-MM-DD
  Status: TaskStatus;
  TotalMinutes: number;
  StandardMinutes: number; // Standard time estimate for Task Efficiency %
  PartsChecklist?: string; // Comma-separated part states e.g. "กันชนหน้า:todo,ประตูซ้าย:done"
}

export type TimeLogAction = 'START' | 'PAUSE' | 'COMPLETE';

export interface SheetTimeLog {
  LogID: string;
  TaskID: string;
  TechEmail: string;
  Action: TimeLogAction;
  Timestamp: string; // ISO string
  DurationMinutes: number;
  Note: string; // Pause reason or completion note
}

export interface SheetWorkCalendar {
  Date: string; // YYYY-MM-DD
  IsWorkDay: boolean;
  StandardHours: number;
}

export interface TechLeave {
  LeaveID: string;
  TechEmail: string;
  Date: string; // YYYY-MM-DD
  Type: string; // 'ลากิจ' | 'ลาป่วย' | 'พักร้อน' | 'วันหยุดส่วนตัว'
  Notes?: string;
}

export interface SheetSetting {
  ConfigKey: string;
  ConfigValue: string;
  Description: string;
}

export interface ActiveTechSession {
  TaskID: string;
  TechEmail: string;
  StartTimestamp: string; // ISO string of the open START action
}

export interface TechnicianEfficiencyRow {
  user: SheetUser;
  actualWorkedMinutes: number;
  availableCalendarMinutes: number;
  workHourUtilizationPct: number; // Actual / Available Calendar Minutes
  standardTaskMinutes: number;
  actualTaskMinutes: number;
  taskEfficiencyPct: number; // Standard Task Minutes / Actual Task Minutes
  completedTasksCount: number;
  inProgressTasksCount: number;
  pauseBreakdown: Record<string, number>; // Reason -> count
}

export interface MasterSopStage {
  id: string;
  stepNumber: number;
  name: string;
  department?: string;
  defaultTechEmails: string[];
  standardMinutes: number;
}

export interface MasterDepartment {
  id: string;
  name: string;
  description?: string;
}
