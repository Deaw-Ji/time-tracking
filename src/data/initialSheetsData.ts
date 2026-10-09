import {
  SheetUser,
  SheetJob,
  SheetJobTask,
  SheetTimeLog,
  SheetWorkCalendar,
  SheetSetting,
  MasterSopStage,
  MasterDepartment,
} from '../types/shopFloor';

export const INITIAL_USERS: SheetUser[] = [
  {
    UserID: 'EMP-001',
    Email: 'jira.a@premium-auto.co.th',
    Password: 'admin123',
    Name: 'จิระ อัศวเมธี',
    Nickname: 'จิระ (Admin)',
    Role: 'Admin',
    Department: 'ผู้บริหารระบบสี',
    Skills: 'QC, Audit, Shop Scheduling',
    Status: 'Active',
  },
  {
    UserID: 'EMP-002',
    Email: 'somchai.c@premium-auto.co.th',
    Password: '123',
    Name: 'สมชาย วงศ์สุวรรณ',
    Nickname: 'สมชาย (Controller)',
    Role: 'Controller',
    Department: 'ควบคุมงานซ่อมและรับรถ (SA)',
    Skills: 'SOP Dispatching, Planning, Costing',
    Status: 'Active',
  },
  {
    UserID: 'EMP-003',
    Email: 'anuchit.t@premium-auto.co.th',
    Password: '123',
    Name: 'ช่างอนุชิต พรมมา',
    Nickname: 'ช่างนุ',
    Role: 'Technician',
    Department: 'แผนกรื้อถอดประกอบ & เคาะเหล็ก',
    Skills: 'ถอดดึงตัวถัง, อลูมิเนียม, ซ่อมพลาสติก',
    Status: 'Active',
  },
  {
    UserID: 'EMP-004',
    Email: 'kittisak.t@premium-auto.co.th',
    Password: '123',
    Name: 'ช่างกิตติศักดิ์ เจริญสุข',
    Nickname: 'ช่างกิต',
    Role: 'Technician',
    Department: 'แผนกขัดแห้ง & โป๊วเตรียมพื้นผิว',
    Skills: 'โป๊วสีเรียบสูง, ขัดแห้งเก็บเหลี่ยมมุม',
    Status: 'Active',
  },
  {
    UserID: 'EMP-005',
    Email: 'narong.t@premium-auto.co.th',
    Password: '123',
    Name: 'ช่างณรงค์ ทองดี',
    Nickname: 'ช่างรงค์',
    Role: 'Technician',
    Department: 'แผนกแต่งสี & พ่นห้องอบสี 2K',
    Skills: 'พ่นสีระบบน้ำ, พ่นแลคเกอร์ผิวส้มเนียน',
    Status: 'Active',
  },
  {
    UserID: 'EMP-006',
    Email: 'weerapong.t@premium-auto.co.th',
    Password: '123',
    Name: 'ช่างวีรพงษ์ สายชล',
    Nickname: 'ช่างวี',
    Role: 'Technician',
    Department: 'แผนกประกอบขัดเงา & ตรวจสอบคุณภาพ',
    Skills: 'ขัดยาเงา, เก็บละอองสี, ปรับช่องไฟประตู',
    Status: 'Active',
  },
];

export const INITIAL_JOBS: SheetJob[] = [];

export const INITIAL_JOB_TASKS: SheetJobTask[] = [];

export const INITIAL_TIME_LOGS: SheetTimeLog[] = [];

export const INITIAL_WORK_CALENDAR: SheetWorkCalendar[] = [
  { Date: '2026-10-01', IsWorkDay: true, StandardHours: 8 },
  { Date: '2026-10-02', IsWorkDay: true, StandardHours: 8 },
  { Date: '2026-10-03', IsWorkDay: true, StandardHours: 8 },
  { Date: '2026-10-04', IsWorkDay: false, StandardHours: 0 }, // Sunday off
  { Date: '2026-10-05', IsWorkDay: true, StandardHours: 8 },
  { Date: '2026-10-06', IsWorkDay: true, StandardHours: 8 },
];

export const INITIAL_TECH_LEAVES = [
  {
    LeaveID: 'LV-001',
    TechEmail: 'anuchit.t@premium-auto.co.th',
    Date: '2026-10-05',
    Type: 'ลากิจ',
    Notes: 'ติดต่อราชการทำธุระครอบครัว',
  },
  {
    LeaveID: 'LV-002',
    TechEmail: 'kittisak.t@premium-auto.co.th',
    Date: '2026-10-06',
    Type: 'ลาป่วย',
    Notes: 'มีไข้สูง ไปพบแพทย์',
  },
];

export const INITIAL_SETTINGS: SheetSetting[] = [
  {
    ConfigKey: 'SHOP_NAME',
    ConfigValue: 'Premium Auto Body & Paint Center',
    Description: 'ชื่อศูนย์บริการพ่นสีและซ่อมตัวถังรถยนต์',
  },
  {
    ConfigKey: 'DEFAULT_STANDARD_HOURS',
    ConfigValue: '8',
    Description: 'จำนวนชั่วโมงทำงานมาตรฐานต่อวันของพนักงานทำสี',
  },
  {
    ConfigKey: 'TARGET_EFFICIENCY_PCT',
    ConfigValue: '85',
    Description: 'เป้าหมายความเร็วประสิทธิภาพของช่างทำสีรายบุคคล (%)',
  },
  {
    ConfigKey: 'AUTO_REFRESH_SECONDS',
    ConfigValue: '15',
    Description: 'ความถี่ในการดึงข้อมูล Real-time อัตโนมัติจาก Google Sheets (วินาที)',
  },
  {
    ConfigKey: 'AUTO_PAUSE_PREVIOUS_TASK',
    ConfigValue: 'TRUE',
    Description: 'เมื่อช่างคนเดิมกด START งานหลักขั้นตอนใหม่ ให้ระบบพักจับเวลางานเดิมอัตโนมัติ',
  },
  {
    ConfigKey: 'PAUSE_REASONS',
    ConfigValue: 'รออะไหล่/รอชิ้นงาน, รอลูกค้าอนุมัติเพิ่ม, พักเที่ยง/พักเบรก, งานแทรกเร่งด่วน, ตู้อบสีไม่ว่าง, รอสีแห้งหมาด, อื่นๆ',
    Description: 'รายการสาเหตุการกดหยุดพักจับเวลาหน้างานซ่อมสีรถยนต์',
  },
];
export const CAR_PARTS_LIST = [
  'กันชนหน้า',
  'กันชนหลัง',
  'ฝากระโปรงหน้า',
  'ฝากระโปรงหลัง/ฝาท้าย',
  'ประตูหน้าซ้าย',
  'ประตูหน้าขวา',
  'ประตูหลังซ้าย',
  'ประตูหลังขวา',
  'แก้มหน้าซ้าย',
  'แก้มหน้าขวา',
  'แก้มหลังซ้าย',
  'แก้มหลังขวา',
  'หลังคา',
  'สเกิร์ตซ้าย',
  'สเกิร์ตขวา',
  'กระจกมองข้างซ้าย',
  'กระจกมองข้างขวา',
  'สปอยเลอร์หลัง'
];

export const INITIAL_MASTER_SOP_STAGES: MasterSopStage[] = [
  {
    id: 'STAGE-1',
    stepNumber: 1,
    name: '1. รื้อถอดประกอบชิ้นส่วนตัวถัง',
    department: 'แผนกรื้อถอดประกอบ & เคาะเหล็ก',
    defaultTechEmails: ['anuchit.t@premium-auto.co.th'],
    standardMinutes: 60,
  },
  {
    id: 'STAGE-2',
    stepNumber: 2,
    name: '2. เคาะผุ / ดึงซ่อมตัวถังเหล็ก',
    department: 'แผนกรื้อถอดประกอบ & เคาะเหล็ก',
    defaultTechEmails: ['anuchit.t@premium-auto.co.th'],
    standardMinutes: 90,
  },
  {
    id: 'STAGE-3',
    stepNumber: 3,
    name: '3. โป๊วสี / ขัดแห้งเตรียมพื้นผิว',
    department: 'แผนกขัดแห้ง & โป๊วเตรียมพื้นผิว',
    defaultTechEmails: ['kittisak.t@premium-auto.co.th'],
    standardMinutes: 90,
  },
  {
    id: 'STAGE-4',
    stepNumber: 4,
    name: '4. พ่นสีจริง / พ่นเคลือบเงาแลคเกอร์ 2K',
    department: 'แผนกแต่งสี & พ่นห้องอบสี 2K',
    defaultTechEmails: ['narong.t@premium-auto.co.th'],
    standardMinutes: 120,
  },
  {
    id: 'STAGE-5',
    stepNumber: 5,
    name: '5. ขัดสี / ประกอบชิ้นส่วนตัวถัง',
    department: 'แผนกประกอบขัดเงา & ตรวจสอบคุณภาพ',
    defaultTechEmails: ['weerapong.t@premium-auto.co.th'],
    standardMinutes: 90,
  },
  {
    id: 'STAGE-6',
    stepNumber: 6,
    name: '6. ตรวจสอบคุณภาพความสะอาด QC & ส่งมอบ',
    department: 'แผนกประกอบขัดเงา & ตรวจสอบคุณภาพ',
    defaultTechEmails: ['jira.a@premium-auto.co.th'],
    standardMinutes: 30,
  },
];

export const INITIAL_DEPARTMENTS: MasterDepartment[] = [
  { id: 'DEPT-01', name: 'แผนกรื้อถอดประกอบ & เคาะเหล็ก', description: 'ถอดดึงตัวถัง, เคาะดึงโครงสร้างเหล็ก/อลูมิเนียม' },
  { id: 'DEPT-02', name: 'แผนกขัดแห้ง & โป๊วเตรียมพื้นผิว', description: 'งานสีโป๊ว, ขัดแห้งเตรียมพื้นผิว, พ่นสีรองพื้นเกาะเหล็ก' },
  { id: 'DEPT-03', name: 'แผนกแต่งสี & พ่นห้องอบสี 2K', description: 'เทียบผสมสี, พ่นสีจริงสูตรน้ำ/2K, อบสีตู้อบลมร้อน' },
  { id: 'DEPT-04', name: 'แผนกประกอบขัดเงา & ตรวจสอบคุณภาพ', description: 'ประกอบชิ้นส่วนคืน, ขัดยาเงาลบละอองสี, ตรวจ QC' },
  { id: 'DEPT-05', name: 'ควบคุมงานซ่อมและรับรถ (SA / Controller)', description: 'ต้อนรับลูกค้า, ออกใบสั่งซ่อม, ควบคุมกระบวนการผลิต' },
];

