import React, { useState, useEffect, useMemo } from 'react';
import {
  SheetUser,
  SheetJob,
  SheetJobTask,
  SheetTimeLog,
  SheetWorkCalendar,
  SheetSetting,
  UserRole,
  MasterSopStage,
  MasterDepartment,
  TechLeave,
} from '../types/shopFloor';
import {
  Download,
  Save,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Layers,
  Wrench,
  CheckCircle2,
  Building2,
  X,
  Key,
  Lock,
  AlertCircle,
  Flame,
  Cloud,
} from 'lucide-react';

export type SheetTabName =
  | 'Departments'
  | 'CarParts'
  | 'MasterTasks'
  | 'Users'
  | 'Settings'
  | 'WorkCalendar'
  | 'TimeLogs';

interface SheetsAndSettingsViewProps {
  users: SheetUser[];
  jobs: SheetJob[];
  jobTasks: SheetJobTask[];
  timeLogs: SheetTimeLog[];
  workCalendar: SheetWorkCalendar[];
  techLeaves: TechLeave[];
  settings: SheetSetting[];
  carParts: string[];
  masterSopStages: MasterSopStage[];
  departments: MasterDepartment[];
  initialSubTab?: SheetTabName;
  currentUserRole?: UserRole;
  onUpdateSettings: (newSettings: SheetSetting[]) => void;
  onUpdateWorkCalendar: (newCalendar: SheetWorkCalendar[]) => void;
  onUpdateTechLeaves: (newLeaves: TechLeave[]) => void;
  onUpdateDepartments: (newDepartments: MasterDepartment[]) => void;
  onAddUser: (user: SheetUser) => void;
  onDeleteUser: (userId: string) => void;
  onEditUser: (user: SheetUser) => void;
  onAddCarPart: (partName: string) => void;
  onEditCarPart: (oldName: string, newName: string) => void;
  onDeleteCarPart: (partName: string) => void;
  onUpdateMasterSopStages: (stages: MasterSopStage[]) => void;
  onClearAllTimeLogs?: () => void;
  showToast?: (msg: string) => void;
}

export const SheetsAndSettingsView: React.FC<SheetsAndSettingsViewProps> = ({
  users,
  jobs,
  jobTasks,
  timeLogs,
  workCalendar,
  techLeaves,
  settings,
  carParts,
  masterSopStages,
  departments,
  initialSubTab = 'Departments',
  currentUserRole,
  onUpdateSettings,
  onUpdateWorkCalendar,
  onUpdateTechLeaves,
  onUpdateDepartments,
  onAddUser,
  onDeleteUser,
  onEditUser,
  onAddCarPart,
  onEditCarPart,
  onDeleteCarPart,
  onUpdateMasterSopStages,
  onClearAllTimeLogs = () => {},
  showToast = () => {},
}) => {
  const [activeSheet, setActiveSheet] = useState<SheetTabName>(() => {
    if (currentUserRole === 'Controller') {
      return initialSubTab === 'WorkCalendar' ? 'WorkCalendar' : 'CarParts';
    }
    return initialSubTab;
  });
  const [draftSettings, setDraftSettings] = useState<SheetSetting[]>(settings);

  useEffect(() => {
    if (initialSubTab) {
      if (currentUserRole === 'Controller' && initialSubTab !== 'CarParts' && initialSubTab !== 'WorkCalendar') {
        setActiveSheet('CarParts');
      } else {
        setActiveSheet(initialSubTab);
      }
    }
  }, [initialSubTab, currentUserRole]);

  useEffect(() => {
    if (currentUserRole === 'Controller' && activeSheet !== 'CarParts' && activeSheet !== 'WorkCalendar') {
      setActiveSheet('CarParts');
    }
  }, [currentUserRole, activeSheet]);

  // Helper to generate clean sequential department ID with standard 2-digit padding e.g. DEPT-06
  const getNextDeptId = (depts: MasterDepartment[]) => {
    let maxNum = 0;
    depts.forEach((d) => {
      const match = d.id.match(/^DEPT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return `DEPT-${String(nextNum).padStart(2, '0')}`;
  };

  // Department Master add/edit state
  const [newDeptId, setNewDeptId] = useState(() => getNextDeptId(departments));
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [editingDept, setEditingDept] = useState<MasterDepartment | null>(null);
  const [editingDeptOriginalId, setEditingDeptOriginalId] = useState<string | null>(null);
  const [editingDeptOriginalName, setEditingDeptOriginalName] = useState<string | null>(null);

  // Sync newDeptId when departments list changes
  useEffect(() => {
    setNewDeptId(getNextDeptId(departments));
  }, [departments]);

  // Shop Holidays list (Rule-based Shop Calendar)
  const DEFAULT_SHOP_HOLIDAYS = [
    { date: '2026-01-01', name: 'วันขึ้นปีใหม่' },
    { date: '2026-04-13', name: 'วันสงกรานต์' },
    { date: '2026-04-14', name: 'วันสงกรานต์' },
    { date: '2026-04-15', name: 'วันสงกรานต์' },
    { date: '2026-05-01', name: 'วันแรงงานแห่งชาติ' },
    { date: '2026-07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10' },
    { date: '2026-08-12', name: 'วันแม่แห่งชาติ' },
    { date: '2026-10-13', name: 'วันนวมินทรมหาราช' },
    { date: '2026-10-23', name: 'วันปิยมหาราช' },
    { date: '2026-12-05', name: 'วันพ่อแห่งชาติ / วันชาติ' },
    { date: '2026-12-10', name: 'วันรัฐธรรมนูญ' },
    { date: '2026-12-31', name: 'วันสิ้นปี' },
  ];

  const [shopHolidays, setShopHolidays] = useState<{ date: string; name: string }[]>(() => {
    const saved = localStorage.getItem('autofloor_shop_holidays');
    return saved ? JSON.parse(saved) : DEFAULT_SHOP_HOLIDAYS;
  });

  useEffect(() => {
    localStorage.setItem('autofloor_shop_holidays', JSON.stringify(shopHolidays));
  }, [shopHolidays]);

  const [newHolidayDate, setNewHolidayDate] = useState('2026-10-23');
  const [newHolidayName, setNewHolidayName] = useState('วันปิยมหาราช');
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);

  // Car part add/edit state
  const [newPartInput, setNewPartInput] = useState('');
  const [editingPartOldName, setEditingPartOldName] = useState<string | null>(null);
  const [editingPartNewName, setEditingPartNewName] = useState('');

  // Master SOP Stage add/edit state
  const [newStageName, setNewStageName] = useState('');
  const [newStageDept, setNewStageDept] = useState(departments[0]?.name || 'แผนกรื้อถอดประกอบ & เคาะเหล็ก');
  const [newStageMinutes, setNewStageMinutes] = useState(60);
  const [editingStage, setEditingStage] = useState<MasterSopStage | null>(null);

  // New user form state
  const [newEmpId, setNewEmpId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPassword] = useState('123');
  const [newUserName, setNewUserName] = useState('');
  const [newUserNickname, setNewUserNickname] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Technician');
  const [newUserDept, setNewUserDept] = useState(departments[0]?.name || 'แผนกขัดแห้ง & โป๊วเตรียมพื้นผิว');
  const [newUserSkills, setNewUserSkills] = useState('โป๊วสีเรียบสูง, ขัดแห้งเก็บเหลี่ยมมุม');

  // Edit user state
  const [editingUser, setEditingJobUser] = useState<SheetUser | null>(null);

  // Admin Reset Password modal state
  const [resettingUserForAdmin, setResettingUserForAdmin] = useState<SheetUser | null>(null);
  const [adminResetNewPass, setAdminResetNewPass] = useState('123456');

  // Confirm delete modal states
  const [deptToDelete, setDeptToDelete] = useState<MasterDepartment | null>(null);
  const [partToDelete, setPartToDelete] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<MasterSopStage | null>(null);
  const [userToDelete, setUserToDelete] = useState<SheetUser | null>(null);
  const [leaveToDelete, setLeaveToDelete] = useState<TechLeave | null>(null);

  // Lock body scroll when any modal in SheetsAndSettingsView is active
  useEffect(() => {
    const isAnyModalOpen =
      !!resettingUserForAdmin ||
      !!editingUser ||
      !!editingDept ||
      !!deptToDelete ||
      !!partToDelete ||
      !!stageToDelete ||
      !!userToDelete ||
      !!leaveToDelete ||
      showClearLogsModal;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [
    resettingUserForAdmin,
    editingUser,
    editingDept,
    deptToDelete,
    partToDelete,
    stageToDelete,
    userToDelete,
    leaveToDelete,
    showClearLogsModal,
  ]);

  // New calendar date form
  const [newCalDate, setNewCalDate] = useState('2026-10-07');
  const [newCalHours, setNewCalHours] = useState(8);

  // New work calendar and tech leaves states
  const [calendarSubTab, setCalendarSubTab] = useState<'garage' | 'leaves'>('garage');
  const [bulkYear, setBulkYear] = useState('2026');
  const [bulkMonth, setBulkMonth] = useState('10');
  const [calendarViewYear, setCalendarViewYear] = useState('2026');
  const [calendarViewMonth, setCalendarViewMonth] = useState('10');
  const [weeklyWorkDays, setWeeklyWorkDays] = useState<Record<number, boolean>>(() => {
    const saved = localStorage.getItem('autofloor_weekly_workdays');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      0: false, // Sunday off by default
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true, // Saturday is a working day
    };
  });

  useEffect(() => {
    localStorage.setItem('autofloor_weekly_workdays', JSON.stringify(weeklyWorkDays));
  }, [weeklyWorkDays]);

  // Individual leave form state
  const [leaveTechEmail, setLeaveTechEmail] = useState('');
  const [leaveDate, setLeaveDate] = useState('2026-10-07');
  const [leaveType, setLeaveType] = useState('ลากิจ');
  const [leaveNotes, setLeaveNotes] = useState('');
  const [leaveSearch, setLeaveSearch] = useState('');

  const technicians = users.filter((u) => u.Role === 'Technician' && u.Status === 'Active');

  const getTechDisplayName = (email: string) => {
    const u = users.find((item) => item.Email.toLowerCase() === email.toLowerCase());
    return u ? `${u.Nickname || u.Name} (${u.Department})` : email;
  };

  const THAI_DAY_NAMES = [
    'วันอาทิตย์ (อา.)',
    'วันจันทร์ (จ.)',
    'วันอังคาร (อ.)',
    'วันพุธ (พ.)',
    'วันพฤหัสฯ (พฤ.)',
    'วันศุกร์ (ศ.)',
    'วันเสาร์ (ส.)',
  ];

  const THAI_MONTHS = [
    { val: '01', name: 'มกราคม (Jan)' },
    { val: '02', name: 'กุมภาพันธ์ (Feb)' },
    { val: '03', name: 'มีนาคม (Mar)' },
    { val: '04', name: 'เมษายน (Apr)' },
    { val: '05', name: 'พฤษภาคม (May)' },
    { val: '06', name: 'มิถุนายน (Jun)' },
    { val: '07', name: 'กรกฎาคม (Jul)' },
    { val: '08', name: 'สิงหาคม (Aug)' },
    { val: '09', name: 'กันยายน (Sep)' },
    { val: '10', name: 'ตุลาคม (Oct)' },
    { val: '11', name: 'พฤศจิกายน (Nov)' },
    { val: '12', name: 'ธันวาคม (Dec)' },
  ];

  // Auto-calculated statistics for the selected month/year view based on rules
  const currentViewStats = useMemo(() => {
    const yNum = Number(calendarViewYear) || 2026;
    const holidayMap = new Map<string, string>();
    shopHolidays.forEach((h) => holidayMap.set(h.date, h.name));

    let totalDays = 0;
    let workDays = 0;
    let weeklyOffs = 0;
    let shopHols = 0;
    let totalHours = 0;

    const monthsToScan =
      calendarViewMonth === 'all'
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [Number(calendarViewMonth) || 10];

    monthsToScan.forEach((m) => {
      const daysInM = new Date(yNum, m, 0).getDate();
      totalDays += daysInM;

      for (let d = 1; d <= daysInM; d++) {
        const dateStr = `${yNum}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dObj = new Date(yNum, m - 1, d);
        const dayOfWeek = dObj.getDay();

        const recorded = workCalendar.find((c) => c.Date === dateStr);
        if (recorded) {
          if (recorded.IsWorkDay) {
            workDays++;
            totalHours += Number(recorded.StandardHours) || 8;
          } else {
            if (holidayMap.has(dateStr)) shopHols++;
            else weeklyOffs++;
          }
        } else {
          if (holidayMap.has(dateStr)) {
            shopHols++;
          } else if (weeklyWorkDays[dayOfWeek]) {
            workDays++;
            totalHours += 8;
          } else {
            weeklyOffs++;
          }
        }
      }
    });

    return { totalDays, workDays, weeklyOffs, shopHols, totalHours };
  }, [calendarViewYear, calendarViewMonth, shopHolidays, workCalendar, weeklyWorkDays]);

  // List of days dynamically computed for the calendar view
  const displayedCalendarDays = useMemo(() => {
    const yNum = Number(calendarViewYear) || 2026;
    const holidayMap = new Map<string, string>();
    shopHolidays.forEach((h) => holidayMap.set(h.date, h.name));

    const recordedMap = new Map<string, SheetWorkCalendar>();
    workCalendar.forEach((c) => recordedMap.set(c.Date, c));

    const monthsToScan =
      calendarViewMonth === 'all'
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [Number(calendarViewMonth) || 10];

    const list: {
      date: string;
      dayOfWeek: number;
      dayName: string;
      isWorkDay: boolean;
      standardHours: number;
      holidayName?: string;
      isOverridden: boolean;
    }[] = [];

    monthsToScan.forEach((m) => {
      const daysInM = new Date(yNum, m, 0).getDate();
      for (let d = 1; d <= daysInM; d++) {
        const dateStr = `${yNum}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dObj = new Date(yNum, m - 1, d);
        const dayOfWeek = dObj.getDay();
        const hName = holidayMap.get(dateStr);
        const recorded = recordedMap.get(dateStr);

        let isWork = false;
        let hours = 0;
        let isOverridden = false;

        if (recorded) {
          isWork = recorded.IsWorkDay;
          hours = Number(recorded.StandardHours) || (isWork ? 8 : 0);
          const baseRuleWork = !hName && !!weeklyWorkDays[dayOfWeek];
          if (isWork !== baseRuleWork) isOverridden = true;
        } else {
          if (hName) {
            isWork = false;
            hours = 0;
          } else if (weeklyWorkDays[dayOfWeek]) {
            isWork = true;
            hours = 8;
          } else {
            isWork = false;
            hours = 0;
          }
        }

        list.push({
          date: dateStr,
          dayOfWeek,
          dayName: THAI_DAY_NAMES[dayOfWeek],
          isWorkDay: isWork,
          standardHours: hours,
          holidayName: hName,
          isOverridden,
        });
      }
    });

    return list;
  }, [calendarViewYear, calendarViewMonth, shopHolidays, workCalendar, weeklyWorkDays]);

  // Department Master handlers
  const handleAddDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newDeptName.trim();
    if (!cleanName) return;
    if (departments.some((d) => d.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      showToast(`แผนก "${cleanName}" มีอยู่ในระบบแล้ว`);
      return;
    }
    const finalId = (newDeptId.trim() || getNextDeptId(departments)).toUpperCase();
    if (departments.some((d) => d.id.toUpperCase() === finalId)) {
      showToast(`รหัสแผนก "${finalId}" ซ้ำกับแผนกที่มีอยู่แล้ว กรุณาระบุรหัสอื่น`);
      return;
    }
    const newDept: MasterDepartment = {
      id: finalId,
      name: cleanName,
      description: newDeptDesc.trim(),
    };
    const updated = [...departments, newDept];
    onUpdateDepartments(updated);
    setNewDeptName('');
    setNewDeptDesc('');
    setNewDeptId(getNextDeptId(updated));
    showToast(`เพิ่มแผนก "${cleanName}" (รหัส: ${finalId}) สำเร็จ`);
  };

  const handleEditDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editingDept.name.trim()) return;

    const targetOriginalId = editingDeptOriginalId || editingDept.id;
    const cleanId = (editingDept.id.trim() || targetOriginalId).toUpperCase();
    const cleanName = editingDept.name.trim();

    // Check if new ID collides with another department
    if (
      cleanId !== targetOriginalId &&
      departments.some((d) => d.id.toUpperCase() === cleanId)
    ) {
      showToast(`รหัสแผนก "${cleanId}" ซ้ำกับแผนกอื่นในระบบ กรุณาระบุรหัสอื่น`);
      return;
    }

    // Check if new Name collides with another department
    if (
      cleanName.toLowerCase() !== (editingDeptOriginalName || '').toLowerCase() &&
      departments.some(
        (d) =>
          d.id !== targetOriginalId &&
          d.name.trim().toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      showToast(`ชื่อแผนก "${cleanName}" ซ้ำกับแผนกอื่นในระบบ กรุณาระบุชื่ออื่น`);
      return;
    }

    const cleanDept: MasterDepartment = {
      ...editingDept,
      id: cleanId,
      name: cleanName,
      description: editingDept.description?.trim() || '',
    };

    // Update departments array matching by original ID
    const updated = departments.map((d) => (d.id === targetOriginalId ? cleanDept : d));
    onUpdateDepartments(updated);

    // Cascade update users and SOP stages if department name was changed
    if (editingDeptOriginalName && cleanName !== editingDeptOriginalName) {
      users.forEach((u) => {
        if (u.Department.trim().toLowerCase() === editingDeptOriginalName.trim().toLowerCase()) {
          onEditUser({ ...u, Department: cleanName });
        }
      });

      const updatedStages = masterSopStages.map((s) =>
        s.department?.trim().toLowerCase() === editingDeptOriginalName.trim().toLowerCase()
          ? { ...s, department: cleanName }
          : s
      );
      onUpdateMasterSopStages(updatedStages);
    }

    setEditingDept(null);
    setEditingDeptOriginalId(null);
    setEditingDeptOriginalName(null);
    showToast(`แก้ไขข้อมูลแผนก "${cleanDept.name}" (รหัส: ${cleanId}) สำเร็จ`);
  };

  const handleDeleteDept = (deptId: string) => {
    if (departments.length <= 1) {
      showToast('ต้องมีแผนกอย่างน้อย 1 แผนกในระบบ');
      return;
    }
    const dept = departments.find((d) => d.id === deptId);
    if (dept) setDeptToDelete(dept);
  };

  // Car part handlers
  const handleAddPartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPartInput.trim();
    if (!clean) return;
    if (carParts.includes(clean)) {
      showToast(`ชิ้นส่วน "${clean}" มีอยู่ในระบบแล้ว`);
      return;
    }
    onAddCarPart(clean);
    setNewPartInput('');
  };

  const handleEditPartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartOldName || !editingPartNewName.trim()) return;
    onEditCarPart(editingPartOldName, editingPartNewName.trim());
    setEditingPartOldName(null);
    setEditingPartNewName('');
  };

  // Master Stage handlers
  const handleAddStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;

    const newStage: MasterSopStage = {
      id: `STAGE-${Date.now()}`,
      stepNumber: masterSopStages.length + 1,
      name: newStageName.trim(),
      department: newStageDept,
      defaultTechEmails: [],
      standardMinutes: Number(newStageMinutes) || 60,
    };

    onUpdateMasterSopStages([...masterSopStages, newStage]);
    setNewStageName('');
    setNewStageMinutes(60);
  };

  const handleEditStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage) return;

    const updated = masterSopStages.map((s) =>
      s.id === editingStage.id ? editingStage : s
    );
    onUpdateMasterSopStages(updated);
    setEditingStage(null);
  };

  const handleDeleteStage = (stageId: string) => {
    if (masterSopStages.length <= 1) {
      showToast('ต้องมีขั้นตอนมาตรฐานอย่างน้อย 1 ขั้นตอน');
      return;
    }
    const stage = masterSopStages.find((s) => s.id === stageId);
    if (stage) setStageToDelete(stage);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draftSettings);
  };

  const handleToggleWorkDay = (dateStr: string) => {
    const existing = workCalendar.find((d) => d.Date === dateStr);
    let next: SheetWorkCalendar[];
    if (existing) {
      next = workCalendar.map((d) =>
        d.Date === dateStr
          ? { ...d, IsWorkDay: !d.IsWorkDay, StandardHours: !d.IsWorkDay ? 8 : 0 }
          : d
      );
    } else {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dObj = new Date(y, m - 1, d);
      const isSun = dObj.getDay() === 0;
      const isHol = shopHolidays.some((h) => h.date === dateStr);
      const wasWork = !isSun && !isHol;
      next = [
        ...workCalendar,
        {
          Date: dateStr,
          IsWorkDay: !wasWork,
          StandardHours: !wasWork ? 8 : 0,
        },
      ];
    }
    onUpdateWorkCalendar(next);
    showToast(`ปรับสถานะวัน ${dateStr} เรียบร้อยแล้ว`);
  };

  const handleAddShopHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) return;
    if (shopHolidays.some((h) => h.date === newHolidayDate)) {
      showToast(`วันที่ ${newHolidayDate} มีอยู่ในรายการวันหยุดแล้ว`);
      return;
    }
    const updated = [...shopHolidays, { date: newHolidayDate, name: newHolidayName.trim() }];
    updated.sort((a, b) => a.date.localeCompare(b.date));
    setShopHolidays(updated);
    showToast(`เพิ่มวันหยุดพิเศษ "${newHolidayName.trim()}" (${newHolidayDate}) สำเร็จ`);
  };

  const handleDeleteShopHoliday = (dateStr: string) => {
    const updated = shopHolidays.filter((h) => h.date !== dateStr);
    setShopHolidays(updated);
    showToast(`ลบวันหยุดพิเศษ ${dateStr} แล้ว`);
  };

  const handleSyncMonthToCalendar = (yearNum: number, monthNum: number) => {
    const totalDays = new Date(yearNum, monthNum, 0).getDate();
    const holidayMap = new Map<string, string>();
    shopHolidays.forEach((h) => holidayMap.set(h.date, h.name));

    const nextCalendar = [...workCalendar];
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(yearNum, monthNum - 1, d);
      const dayOfWeek = dObj.getDay();
      const isHoliday = holidayMap.has(dateStr);
      const isWork = !isHoliday && !!weeklyWorkDays[dayOfWeek];

      const existingIdx = nextCalendar.findIndex((row) => row.Date === dateStr);
      const rowData: SheetWorkCalendar = {
        Date: dateStr,
        IsWorkDay: isWork,
        StandardHours: isWork ? 8 : 0,
      };
      if (existingIdx > -1) {
        nextCalendar[existingIdx] = rowData;
      } else {
        nextCalendar.push(rowData);
      }
    }
    nextCalendar.sort((a, b) => a.Date.localeCompare(b.Date));
    onUpdateWorkCalendar(nextCalendar);
    showToast(`บันทึกซิงค์วันทำงานเดือน ${monthNum}/${yearNum} ลงชีตเรียบร้อยแล้ว (${totalDays} วัน)`);
  };

  const handleSyncEntireYearCalendar = (targetYear: number) => {
    const holidayMap = new Map<string, string>();
    shopHolidays.forEach((h) => holidayMap.set(h.date, h.name));

    const nextCalendar = [...workCalendar];
    let totalGenerated = 0;

    for (let m = 1; m <= 12; m++) {
      const totalDays = new Date(targetYear, m, 0).getDate();
      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${targetYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dObj = new Date(targetYear, m - 1, d);
        const dayOfWeek = dObj.getDay();
        const isHoliday = holidayMap.has(dateStr);
        const isWork = !isHoliday && !!weeklyWorkDays[dayOfWeek];

        const existingIdx = nextCalendar.findIndex((row) => row.Date === dateStr);
        const rowData: SheetWorkCalendar = {
          Date: dateStr,
          IsWorkDay: isWork,
          StandardHours: isWork ? 8 : 0,
        };
        if (existingIdx > -1) {
          nextCalendar[existingIdx] = rowData;
        } else {
          nextCalendar.push(rowData);
        }
        totalGenerated++;
      }
    }
    nextCalendar.sort((a, b) => a.Date.localeCompare(b.Date));
    onUpdateWorkCalendar(nextCalendar);
    showToast(`สร้างและซิงค์ปฏิทินวันทำงานปี ${targetYear} สำเร็จสมบูรณ์! (รวม ${totalGenerated} วัน)`);
  };

  const handleToggleWeeklyWorkDay = (dayIndex: number) => {
    setWeeklyWorkDays((prev) => ({
      ...prev,
      [dayIndex]: !prev[dayIndex],
    }));
  };

  const handleBulkGenerateCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    handleSyncMonthToCalendar(Number(bulkYear), Number(bulkMonth));
  };

  const handleAddCalendarDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalDate) return;
    const existingIdx = workCalendar.findIndex((c) => c.Date === newCalDate);
    const row: SheetWorkCalendar = {
      Date: newCalDate,
      IsWorkDay: newCalHours > 0,
      StandardHours: newCalHours,
    };
    let updated: SheetWorkCalendar[];
    if (existingIdx > -1) {
      updated = [...workCalendar];
      updated[existingIdx] = row;
    } else {
      updated = [...workCalendar, row].sort((a, b) => a.Date.localeCompare(b.Date));
    }
    onUpdateWorkCalendar(updated);
    showToast(`บันทึกสถานะวันทำงาน ${newCalDate} (${newCalHours} ชม.) สำเร็จ`);
  };

  const handleAddTechLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTechEmail = leaveTechEmail || (technicians.length > 0 ? technicians[0].Email : '');
    if (!cleanTechEmail) {
      showToast('กรุณาเลือกช่างก่อนบันทึกวันลา');
      return;
    }
    if (!leaveDate) {
      showToast('กรุณาเลือกวันที่ต้องการบันทึกวันลา');
      return;
    }

    // Check for duplicate leave
    const isDuplicate = techLeaves.some(
      (l) => l.TechEmail.trim().toLowerCase() === cleanTechEmail.trim().toLowerCase() && l.Date === leaveDate
    );
    if (isDuplicate) {
      showToast(`ช่าง ${getTechDisplayName(cleanTechEmail)} ได้ลงทะเบียนวันหยุด/วันลาในวันที่ ${leaveDate} ไว้แล้ว`);
      return;
    }

    const newLeave: TechLeave = {
      LeaveID: `LV-${Date.now()}`,
      TechEmail: cleanTechEmail,
      Date: leaveDate,
      Type: leaveType,
      Notes: leaveNotes.trim(),
    };

    onUpdateTechLeaves([...techLeaves, newLeave]);
    setLeaveNotes('');
    showToast('บันทึกข้อมูลวันหยุด/วันลาเรียบร้อยแล้ว');
  };

  const handleDeleteTechLeave = (leaveId: string) => {
    const leave = techLeaves.find((l) => l.LeaveID === leaveId);
    if (leave) setLeaveToDelete(leave);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim() || !newEmpId.trim()) return;
    onAddUser({
      UserID: newEmpId.trim(),
      Email: newUserEmail.trim(),
      Password: newUserPass,
      Name: newUserName.trim(),
      Nickname: newUserNickname.trim() || newUserName.trim().split(' ')[0],
      Role: newUserRole,
      Department: newUserDept.trim(),
      Skills: newUserSkills.trim(),
      Status: 'Active',
    });
    setNewEmpId('');
    setNewUserEmail('');
    setNewUserName('');
    setNewUserNickname('');
    setNewUserPassword('123');
  };

  const handleUpdateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onEditUser(editingUser);
      setEditingJobUser(null);
    }
  };

  const handleAdminResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUserForAdmin || !adminResetNewPass.trim()) return;

    const updatedUser: SheetUser = {
      ...resettingUserForAdmin,
      Password: adminResetNewPass.trim(),
    };

    onEditUser(updatedUser);
    showToast(`รีเซ็ตรหัสผ่านของ ${updatedUser.Name} (${updatedUser.UserID}) เป็น "${adminResetNewPass.trim()}" สำเร็จเรียบร้อยแล้ว`);
    setResettingUserForAdmin(null);
  };

  const exportSheetToCsv = (sheetName: SheetTabName) => {
    let headers: string[] = [];
    let rows: (string | number | boolean)[][] = [];

    if (sheetName === 'Departments') {
      headers = ['DepartmentID', 'DepartmentName', 'Description'];
      rows = departments.map((d) => [d.id, d.name, d.description || '']);
    } else if (sheetName === 'CarParts') {
      headers = ['PartName'];
      rows = carParts.map((p) => [p]);
    } else if (sheetName === 'MasterTasks') {
      headers = ['StepNumber', 'TaskName', 'Department', 'DefaultTechnicians', 'StandardMinutes'];
      rows = masterSopStages.map((s) => [
        s.stepNumber,
        s.name,
        s.department || '',
        s.defaultTechEmails.join('; '),
        s.standardMinutes,
      ]);
    } else if (sheetName === 'Users') {
      headers = [
        'UserID',
        'Email',
        'Password',
        'Name',
        'Nickname',
        'Role',
        'Department',
        'Skills',
        'Status',
      ];
      rows = users.map((u) => [
        u.UserID,
        u.Email,
        u.Password || '',
        u.Name,
        u.Nickname || '',
        u.Role,
        u.Department,
        u.Skills,
        u.Status,
      ]);
    } else if (sheetName === 'TimeLogs') {
      headers = [
        'LogID',
        'TaskID',
        'TechEmail',
        'Action',
        'Timestamp',
        'DurationMinutes',
        'Note',
      ];
      rows = timeLogs.map((l) => [
        l.LogID,
        l.TaskID,
        l.TechEmail,
        l.Action,
        l.Timestamp,
        l.DurationMinutes,
        l.Note,
      ]);
    } else if (sheetName === 'WorkCalendar') {
      headers = ['Date', 'IsWorkDay', 'StandardHours'];
      rows = workCalendar.map((w) => [w.Date, w.IsWorkDay, w.StandardHours]);
    } else if (sheetName === 'Settings') {
      headers = ['ConfigKey', 'ConfigValue', 'Description'];
      rows = settings.map((s) => [s.ConfigKey, s.ConfigValue, s.Description]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sheetName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const allSheetTabs: { id: SheetTabName; label: string; count?: number | string }[] = [
    { id: 'Departments', label: '0. จัดการแผนก (Departments)', count: departments.length },
    { id: 'CarParts', label: '1. ชิ้นส่วนตัวถังที่จะซ่อมทำสี', count: carParts.length },
    { id: 'MasterTasks', label: '2. ขั้นตอนงานซ่อมหลัก & ผูกแผนก (Master SOP)', count: masterSopStages.length },
    { id: 'Users', label: '3. ผู้ใช้งาน/ช่าง (Users)', count: users.length },
    { id: 'Settings', label: '4. ตั้งค่าระบบ (Settings)', count: settings.length },
    { id: 'WorkCalendar', label: '5. ปฏิทินวันทำงาน & วันลาช่าง', count: workCalendar.length + techLeaves.length },
    { id: 'TimeLogs', label: '6. บันทึกเวลา (TimeLogs)', count: timeLogs.length },
  ];

  const sheetTabs = useMemo(() => {
    if (currentUserRole === 'Controller') {
      return allSheetTabs.filter((tab) => tab.id === 'CarParts' || tab.id === 'WorkCalendar');
    }
    return allSheetTabs;
  }, [
    currentUserRole,
    departments.length,
    carParts.length,
    masterSopStages.length,
    users.length,
    settings.length,
    workCalendar.length,
    techLeaves.length,
    timeLogs.length,
  ]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-blue-600 tracking-wider uppercase">
            {currentUserRole === 'Controller'
              ? 'WORKSHOP CONFIGURATION (CONTROLLER)'
              : 'ADMINISTRATOR & WORKSHOP CONFIGURATION'}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            การตั้งค่า (Settings)
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportSheetToCsv(activeSheet)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-blue-600" />
            ดาวน์โหลดข้อมูล {activeSheet}.csv
          </button>
        </div>
      </div>

      {/* Firebase Cloud Real-time Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-4 shadow-sm border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg shrink-0">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Firebase Firestore Real-time Cloud
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ออนไลน์สด Real-time
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">
              ระบบฐานข้อมูลเชื่อมต่อ Firebase คลาวด์สมบูรณ์ • ข้อมูลใบงาน เวลาทำงาน และรายชื่อพนักงานซิงค์อัตโนมัติสดทุกหน้าจอ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-300 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30 shrink-0">
          <Cloud className="w-4 h-4 text-emerald-400" />
          <span>Cloud Database Active</span>
        </div>
      </div>

      {/* Sheet Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-xl overflow-x-auto">
        {sheetTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSheet(tab.id)}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSheet === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label} {tab.count !== undefined && `(${tab.count})`}
          </button>
        ))}
      </div>

      {/* TAB 0: DEPARTMENT MASTER MANAGEMENT */}
      {activeSheet === 'Departments' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddDeptSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
          >
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              เพิ่มแผนกงานใหม่ลงระบบ (Master Departments)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs font-medium">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  รหัสแผนก (Auto / กำหนดเอง) *
                </label>
                <input
                  type="text"
                  required
                  value={newDeptId}
                  onChange={(e) => setNewDeptId(e.target.value.toUpperCase())}
                  placeholder="เช่น DEPT-6"
                  className="w-full border border-blue-400 bg-blue-50/40 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-800 uppercase focus:outline-none focus:border-blue-600"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  รันเลขอัตโนมัติ (แก้ไขได้)
                </span>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ชื่อแผนกงาน *
                </label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="เช่น แผนกเคาะซ่อมตัวถัง, แผนกเตรียมพ่น..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-[11px] text-slate-600 mb-1">
                  รายละเอียดหน้าที่และคำอธิบายแผนก
                </label>
                <input
                  type="text"
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  placeholder="เช่น ซ่อมเคาะดึงโครงสร้างตัวถังเหล็กและอลูมิเนียม..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                เพิ่มแผนกงานใหม่
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              * แผนกที่ตั้งค่าที่นี่ จะเป็นฐานข้อมูลกลางที่ถูกนำไปใช้เลือกใน "การเพิ่มช่าง/ผู้ใช้", "กำหนดขั้นตอนงานซ่อมหลัก (SOP)", และ "กรองเลือกช่างในหน้าเปิดใบงาน"
            </p>
          </form>

          {/* Departments Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  รายการแผนกงานทั้งหมดในระบบ ({departments.length} แผนก):
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold">
                    <th className="py-3 px-4">รหัสแผนก</th>
                    <th className="py-3 px-4">ชื่อแผนกงาน</th>
                    <th className="py-3 px-4">รายละเอียดหน้าที่</th>
                    <th className="py-3 px-4 text-center">จำนวนช่างในแผนก</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {departments.map((d) => {
                    const techCount = users.filter((u) => u.Department.trim().toLowerCase() === d.name.trim().toLowerCase()).length;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDept({ ...d });
                              setEditingDeptOriginalId(d.id);
                              setEditingDeptOriginalName(d.name);
                            }}
                            className="inline-flex items-center gap-1.5 hover:text-blue-800 hover:underline cursor-pointer font-mono font-bold text-blue-600 bg-blue-50/70 hover:bg-blue-100/70 px-2.5 py-1 rounded-md transition-colors"
                            title="คลิกเพื่อแก้ไขรหัสแผนก"
                          >
                            <span>{d.id}</span>
                            <Edit2 className="w-3 h-3 text-blue-500 opacity-70" />
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{d.name}</td>
                        <td className="py-3 px-4 text-slate-600">{d.description || '-'}</td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px]">
                            {techCount} คน
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDept({ ...d });
                                setEditingDeptOriginalId(d.id);
                                setEditingDeptOriginalName(d.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                              title="แก้ไขแผนก"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDept(d.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                              title="ลบแผนก"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DEPARTMENT MODAL */}
      {editingDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <form
            onSubmit={handleEditDeptSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  แก้ไขข้อมูลแผนกงาน {editingDeptOriginalId ? `(${editingDeptOriginalId})` : ''}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingDept(null);
                  setEditingDeptOriginalId(null);
                  setEditingDeptOriginalName(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  รหัสแผนก (Department ID) *
                </label>
                <input
                  type="text"
                  required
                  value={editingDept.id}
                  onChange={(e) => setEditingDept({ ...editingDept, id: e.target.value.toUpperCase() })}
                  placeholder="เช่น DEPT-01, BODY-01, PAINT-01"
                  className="w-full border border-blue-400 bg-blue-50/50 rounded-lg px-3 py-2.5 font-mono font-bold text-blue-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  คุณสามารถแก้ไขรหัสแผนกเป็นรหัสใหม่ได้ตามต้องการ (เช่น DEPT-01, BODY-01, PAINT-01)
                </span>
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-bold">ชื่อแผนกงาน *</label>
                <input
                  type="text"
                  required
                  value={editingDept.name}
                  onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                  placeholder="เช่น แผนกขัดแห้ง & โป๊วเตรียมพื้นผิว"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">รายละเอียดหน้าที่และความรับผิดชอบ</label>
                <input
                  type="text"
                  value={editingDept.description || ''}
                  onChange={(e) => setEditingDept({ ...editingDept, description: e.target.value })}
                  placeholder="เช่น งานขัดสี โป๊ว พ่นสีรองพื้น..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setEditingDept(null);
                  setEditingDeptOriginalId(null);
                  setEditingDeptOriginalName(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer font-bold shadow-xs"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 1: CAR PARTS MASTER MANAGEMENT */}
      {activeSheet === 'CarParts' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddPartSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
          >
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              เพิ่มชิ้นส่วนตัวถังรถยนต์ที่จะซ่อมทำสีใหม่ (Master Car Parts)
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                type="text"
                required
                value={newPartInput}
                onChange={(e) => setNewPartInput(e.target.value)}
                placeholder="ระบุชื่อชิ้นส่วน เช่น ฝากระโปรงหน้า, ซุ้มล้อหน้าซ้าย..."
                className="flex-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900"
              />
              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                เพิ่มชิ้นส่วนลงระบบ
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              * ชิ้นส่วนที่อยู่ในรายการนี้ จะถูกนำไปแสดงเป็นตัวเลือกในการเปิดใบงานให้ Controller ติ๊กเลือกทันที
            </p>
          </form>

          {/* Parts List Grid */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              รายการชิ้นส่วนตัวถังทั้งหมด ({carParts.length} ชิ้น):
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {carParts.map((part, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <span className="font-bold text-slate-900">{part}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPartOldName(part);
                        setEditingPartNewName(part);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="แก้ไขชื่อชิ้นส่วน"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartToDelete(part)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      title="ลบชิ้นส่วนนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EDIT PART MODAL */}
      {editingPartOldName && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditPartSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl"
          >
            <h3 className="text-sm font-bold text-slate-900">แก้ไขชื่อชิ้นส่วน</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                ชื่อเดิม: {editingPartOldName}
              </label>
              <input
                type="text"
                required
                value={editingPartNewName}
                onChange={(e) => setEditingPartNewName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setEditingPartOldName(null)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg"
              >
                บันทึกชื่อใหม่
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MASTER SOP TASKS MANAGEMENT */}
      {activeSheet === 'MasterTasks' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddStageSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
          >
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              เพิ่มขั้นตอนงานซ่อมหลักมาตรฐาน (Master SOP Tasks)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs font-medium">
              <div className="sm:col-span-6">
                <label className="block text-[11px] text-slate-600 mb-1">
                  ชื่อขั้นตอนมาตรฐาน *
                </label>
                <input
                  type="text"
                  required
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="เช่น 7. ขัดลบรอยคราบละอองสี..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] text-slate-600 mb-1 font-semibold">
                  แผนกงานที่รับผิดชอบ *
                </label>
                <select
                  value={newStageDept}
                  onChange={(e) => setNewStageDept(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-600 mb-1">
                  เวลามาตรฐาน (นาที)
                </label>
                <input
                  type="number"
                  min={5}
                  value={newStageMinutes}
                  onChange={(e) => setNewStageMinutes(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                เพิ่มขั้นตอนลงระบบ
              </button>
            </div>
          </form>

          {/* Master Tasks Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ขั้นตอนงานหลักมาตรฐานที่ระบบจะโหลดออโต้เมื่อเปิด Job ใหม่ ({masterSopStages.length} ขั้นตอน):
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  เมื่อ Controller เปิดสร้างใบงานซ่อมสีใหม่ ระบบจะดึงขั้นตอนและกรองช่างตามแผนกให้อัตโนมัติ
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold">
                    <th className="py-3 px-4 text-center">ลำดับ</th>
                    <th className="py-3 px-4">ชื่อขั้นตอนหลัก</th>
                    <th className="py-3 px-4">แผนกที่สังกัด</th>
                    <th className="py-3 px-4 text-center">เวลามาตรฐาน SLA</th>
                    <th className="py-3 px-4 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {masterSopStages.map((stage) => (
                    <tr key={stage.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">
                        {stage.stepNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{stage.name}</td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-50 text-blue-800 border border-blue-200 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {stage.department || 'ไม่ได้ผูกแผนก'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {stage.standardMinutes} นาที
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingStage(stage)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                            title="แก้ไขขั้นตอน"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStage(stage.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                            title="ลบขั้นตอนนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STAGE MODAL */}
      {editingStage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditStageSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <h3 className="text-sm font-bold text-slate-900">
              แก้ไขขั้นตอนมาตรฐานลำดับที่ {editingStage.stepNumber}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">
                  ชื่อขั้นตอน
                </label>
                <input
                  type="text"
                  required
                  value={editingStage.name}
                  onChange={(e) =>
                    setEditingStage({ ...editingStage, name: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">
                  แผนกงานที่สังกัด
                </label>
                <select
                  value={editingStage.department || ''}
                  onChange={(e) =>
                    setEditingStage({ ...editingStage, department: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 bg-white"
                >
                  <option value="">-- ไม่ระบุแผนก --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">
                  เวลามาตรฐาน (นาที)
                </label>
                <input
                  type="number"
                  min={5}
                  value={editingStage.standardMinutes}
                  onChange={(e) =>
                    setEditingStage({
                      ...editingStage,
                      standardMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setEditingStage(null)}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: USERS (FULL CRUD) */}
      {activeSheet === 'Users' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateUser}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
          >
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              เพิ่มรายชื่อผู้ใช้/พนักงานซ่อมทำสีใหม่ลงในชีต Users
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-medium">
              <input
                type="text"
                required
                value={newEmpId}
                onChange={(e) => setNewEmpId(e.target.value)}
                placeholder="รหัสพนักงาน (UserID / EmpID) เช่น EMP-007 *"
                className="border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
              />
              <input
                type="text"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Username / อีเมลล็อกอิน (เช่น tech01, john, somchai) *"
                className="border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
              />
              <input
                type="text"
                required
                value={newUserPass}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="รหัสผ่านเข้าเครื่อง (Password) *"
                className="border border-slate-300 rounded-lg px-3 py-2 font-mono"
              />
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="ชื่อ-นามสกุลพนักงานจริง *"
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
              <input
                type="text"
                value={newUserNickname}
                onChange={(e) => setNewUserNickname(e.target.value)}
                placeholder="ชื่อเล่นช่าง (แสดงบนบอร์ด)"
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
              >
                <option value="Technician">Technician (ช่างซ่อมตัวถัง/สี)</option>
                <option value="Controller">Controller (ผู้ควบคุมจัดงาน SA)</option>
                <option value="Admin">Admin (ผู้ดูแลระบบหลัก)</option>
              </select>
              <select
                value={newUserDept}
                onChange={(e) => setNewUserDept(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900 bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newUserSkills}
                onChange={(e) => setNewUserSkills(e.target.value)}
                placeholder="ทักษะความชำนาญการทำสี"
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                เพิ่มรายชื่อพนักงานลงระบบชีต
              </button>
            </div>
          </form>

          {/* Users Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold">
                    <th className="py-3 px-4">รหัสพนักงาน</th>
                    <th className="py-3 px-4">Username / อีเมล</th>
                    <th className="py-3 px-4">ชื่อพนักงานจริง</th>
                    <th className="py-3 px-4">ชื่อเล่น</th>
                    <th className="py-3 px-4">รหัสผ่าน</th>
                    <th className="py-3 px-4">สิทธิ์การใช้</th>
                    <th className="py-3 px-4">แผนกประจำ</th>
                    <th className="py-3 px-4">ทักษะ</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {users.map((u) => (
                    <tr key={u.UserID} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{u.UserID}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{u.Email}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{u.Name}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-700">
                          {u.Nickname || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {u.Password ? '*'.repeat(u.Password.length) : 'ไม่มี'}
                      </td>
                      <td className="py-3 px-4 font-semibold">{u.Role}</td>
                      <td className="py-3 px-4 text-slate-600">{u.Department}</td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs">{u.Skills}</td>
                      <td className="py-3 px-4 font-bold">
                        <span
                          className={u.Status === 'Active' ? 'text-emerald-700' : 'text-slate-400'}
                        >
                          {u.Status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setResettingUserForAdmin(u);
                              setAdminResetNewPass('123456');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                            title="Admin รีเซ็ตรหัสผ่านให้พนักงาน"
                          >
                            <Key className="w-3 h-3 text-amber-600" />
                            <span>รีเซ็ตรหัส</span>
                          </button>
                          <button
                            onClick={() => setEditingJobUser(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 transition-colors"
                            title="แก้ไขข้อมูลพนักงาน"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                            title="ลบพนักงาน"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER OVERLAY DIALOG */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateUserSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl animate-fadeIn"
          >
            <h3 className="text-base font-bold text-slate-900">
              แก้ไขข้อมูลพนักงาน {editingUser.UserID}
            </h3>

            <div className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 mb-1">Username / อีเมลล็อกอิน *</label>
                <input
                  type="text"
                  required
                  value={editingUser.Email}
                  onChange={(e) => setEditingJobUser({ ...editingUser, Email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">ชื่อ-สกุลจริง *</label>
                <input
                  type="text"
                  required
                  value={editingUser.Name}
                  onChange={(e) => setEditingJobUser({ ...editingUser, Name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">ชื่อเล่น</label>
                <input
                  type="text"
                  value={editingUser.Nickname || ''}
                  onChange={(e) => setEditingJobUser({ ...editingUser, Nickname: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">รหัสผ่านล็อกอิน (Admin สามารถตั้ง/รีเซ็ตได้ที่นี่)</label>
                <input
                  type="text"
                  required
                  value={editingUser.Password || ''}
                  onChange={(e) => setEditingJobUser({ ...editingUser, Password: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">สิทธิ์การเข้าใช้งานระบบ</label>
                <select
                  value={editingUser.Role}
                  onChange={(e) =>
                    setEditingJobUser({ ...editingUser, Role: e.target.value as UserRole })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-950"
                >
                  <option value="Technician">Technician (ช่างซ่อมตัวถัง/สี)</option>
                  <option value="Controller">Controller (ผู้ควบคุม SA)</option>
                  <option value="Admin">Admin (ผู้ดูแลระบบ)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">แผนกงานประจำช่องซ่อม *</label>
                <select
                  value={editingUser.Department}
                  onChange={(e) =>
                    setEditingJobUser({ ...editingUser, Department: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">ทักษะความชำนาญ</label>
                <input
                  type="text"
                  value={editingUser.Skills}
                  onChange={(e) =>
                    setEditingJobUser({ ...editingUser, Skills: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 text-xs">
              <button
                type="button"
                onClick={() => setEditingJobUser(null)}
                className="px-3 py-1.5 text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN RESET PASSWORD MODAL */}
      {resettingUserForAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <form
            onSubmit={handleAdminResetPasswordSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Admin รีเซ็ตรหัสผ่านพนักงาน</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {resettingUserForAdmin.Name} ({resettingUserForAdmin.UserID} • {resettingUserForAdmin.Email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResettingUserForAdmin(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ตั้งรหัสผ่านใหม่ให้พนักงาน *
                </label>
                <input
                  type="text"
                  required
                  value={adminResetNewPass}
                  onChange={(e) => setAdminResetNewPass(e.target.value)}
                  placeholder="เช่น 123456 หรือ 888888"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500 font-semibold">ปุ่มลัดสุ่มรหัส:</span>
                <button
                  type="button"
                  onClick={() => setAdminResetNewPass('123456')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono font-bold"
                >
                  123456
                </button>
                <button
                  type="button"
                  onClick={() => setAdminResetNewPass('888888')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono font-bold"
                >
                  888888
                </button>
                <button
                  type="button"
                  onClick={() => setAdminResetNewPass(Math.floor(100000 + Math.random() * 900000).toString())}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono font-bold"
                >
                  ⚡ สุ่ม 6 หลัก
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setResettingUserForAdmin(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors"
              >
                บันทึกรหัสผ่านใหม่
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: GENERAL SETTINGS */}
      {activeSheet === 'Settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
        >
          <div className="text-sm font-bold text-slate-900">การตั้งค่าตัวแปรระบบอู่สี</div>
          <div className="space-y-3">
            {draftSettings.map((item, index) => (
              <div
                key={item.ConfigKey}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600">{item.ConfigKey}</span>
                  <span className="text-[11px] text-slate-500">{item.Description}</span>
                </div>
                <input
                  type="text"
                  value={item.ConfigValue}
                  onChange={(e) => {
                    const next = [...draftSettings];
                    next[index].ConfigValue = e.target.value;
                    setDraftSettings(next);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-900"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <Save className="w-4 h-4" />
              บันทึกการตั้งค่าทั้งหมด
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: WORK CALENDAR & TECHNICIAN HOLIDAYS */}
      {activeSheet === 'WorkCalendar' && (
        <div className="space-y-6">
          {/* Sub-tabs Selection inside Calendar */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setCalendarSubTab('garage')}
              className={`pb-3 px-5 text-sm font-bold border-b-2 transition-colors ${
                calendarSubTab === 'garage'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              🗓️ 1. ปฏิทินวันทำงานอู่ & เครื่องมือสร้างอัตโนมัติ (Garage Calendar)
            </button>
            <button
              type="button"
              onClick={() => {
                setCalendarSubTab('leaves');
                if (technicians.length > 0 && !leaveTechEmail) {
                  setLeaveTechEmail(technicians[0].Email);
                }
              }}
              className={`pb-3 px-5 text-sm font-bold border-b-2 transition-colors ${
                calendarSubTab === 'leaves'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              🌴 2. บันทึกวันลา / วันหยุดส่วนตัวช่างรายบุคคล (Tech Leaves)
            </button>
          </div>

          {/* SUB-TAB 1: GARAGE CALENDAR */}
          {calendarSubTab === 'garage' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Rules & Garage Holidays Management */}
              <div className="lg:col-span-5 space-y-5">
                {/* 1. Weekly Shift Rules */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="text-blue-600">⚙️</span>
                        1. กำหนดวันทำการ & วันหยุดประจำสัปดาห์
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ตั้งค่าวันเปิดทำการปกติของอู่ (ระบบจะใช้เป็นเกณฑ์นับวันทำงานของทุกเดือนอัตโนมัติ)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-xs">
                    {[
                      { idx: 1, label: 'วันจันทร์ (Monday)' },
                      { idx: 2, label: 'วันอังคาร (Tuesday)' },
                      { idx: 3, label: 'วันพุธ (Wednesday)' },
                      { idx: 4, label: 'วันพฤหัสฯ (Thursday)' },
                      { idx: 5, label: 'วันศุกร์ (Friday)' },
                      { idx: 6, label: 'วันเสาร์ (Saturday)' },
                      { idx: 0, label: 'วันอาทิตย์ (Sunday)' },
                    ].map((day) => (
                      <label
                        key={day.idx}
                        className={`flex items-center gap-2 p-2.5 border rounded-lg transition-colors cursor-pointer select-none font-semibold text-xs ${
                          weeklyWorkDays[day.idx]
                            ? 'bg-blue-50/60 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!weeklyWorkDays[day.idx]}
                          onChange={() => handleToggleWeeklyWorkDay(day.idx)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>{day.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    💡 <strong>ชั่วโมงทำงานมาตรฐาน:</strong> 8 ชั่วโมง/วันเปิดทำการ (วันหยุดประจำสัปดาห์ = 0 ชม.)
                  </div>
                </div>

                {/* 2. Garage & Public Holidays */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="text-amber-500">🎌</span>
                        2. วันหยุดของอู่ & วันหยุดนักขัตฤกษ์ ({shopHolidays.length} วัน)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        กำหนดวันหยุดพิเศษของอู่หรือวันหยุดตามประเพณี ระบบจะนับเป็นวันหยุดอู่อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  {/* Add New Shop Holiday Form */}
                  <form onSubmit={handleAddShopHoliday} className="bg-amber-50/40 border border-amber-200/80 rounded-lg p-3 space-y-2.5">
                    <div className="text-xs font-bold text-amber-950 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      เพิ่มวันหยุดพิเศษของอู่
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">วันที่หยุด *</label>
                        <input
                          type="date"
                          required
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">ชื่อวันหยุด *</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น วันหยุดอู่ประจำปี"
                          value={newHolidayName}
                          onChange={(e) => setNewHolidayName(e.target.value)}
                          className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs bg-white font-medium"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
                      >
                        + เพิ่มวันหยุดนี้
                      </button>
                    </div>
                  </form>

                  {/* Holidays List */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {shopHolidays.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">ยังไม่มีวันหยุดพิเศษที่ระบุไว้</div>
                    ) : (
                      shopHolidays.map((h) => (
                        <div key={h.date} className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {h.date}
                            </span>
                            <span className="font-bold text-slate-900">{h.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteShopHoliday(h.date)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="ลบวันหยุดนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. Automatic Full-Year & Month Sync Engine */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-xs space-y-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                      <span className="text-blue-600">⚡</span>
                      3. ระบบคำนวณและซิงค์ปฏิทินอัตโนมัติ (Automated Sync)
                    </h3>
                    <p className="text-[11px] text-blue-900/80 mt-1">
                      ระบบจะคำนวณและสร้างปฏิทินของทุกเดือนให้อัตโนมัติจากกฎข้อ 1 และ 2 ด้านบน โดยที่คุณไม่ต้องมานั่งสร้างทีละเดือนอีกต่อไป
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSyncEntireYearCalendar(Number(calendarViewYear))}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                    >
                      <span>⚡ คำนวณและซิงค์ปฏิทินปี {calendarViewYear} อัตโนมัติ (ครบ 365 วัน)</span>
                    </button>
                    {calendarViewYear === '2026' && (
                      <button
                        type="button"
                        onClick={() => handleSyncEntireYearCalendar(2027)}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                      >
                        <span>📅 คำนวณและซิงค์ปฏิทินปี 2027 ล่วงหน้า</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-blue-800/70 pt-1">
                    * เมื่อกดซิงค์ ข้อมูลวันทำงานทั้งหมดจะถูกนำไปใช้วิเคราะห์ % Utilization ของช่าง และบันทึกส่งไปยัง Google Sheets อัตโนมัติ
                  </p>
                </div>
              </div>

              {/* Right Column: Auto-Counted Monthly KPI & Interactive Daily Table */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  {/* Filter Toolbar: Year & Month */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>🗓️</span>
                        รายการสถานะวันทำงานอู่ (Auto-Calculated Calendar)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ระบบนับวันทำงานให้อัตโนมัติ คุณสามารถเลือกดูเฉพาะเดือนและคลิกสลับสถานะรายวันได้
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={calendarViewYear}
                        onChange={(e) => setCalendarViewYear(e.target.value)}
                        className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold bg-white text-slate-900"
                      >
                        <option value="2026">ปี 2026</option>
                        <option value="2027">ปี 2027</option>
                      </select>

                      <select
                        value={calendarViewMonth}
                        onChange={(e) => setCalendarViewMonth(e.target.value)}
                        className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white text-slate-900"
                      >
                        <option value="all">ทั้งปี (ทุกเดือน)</option>
                        {THAI_MONTHS.map((m) => (
                          <option key={m.val} value={m.val}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Live Auto-Count KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">วันทั้งหมด</div>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {currentViewStats.totalDays} <span className="text-[10px] font-normal text-slate-500">วัน</span>
                      </div>
                    </div>
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 text-center">
                      <div className="text-[10px] text-emerald-800 font-bold uppercase">วันเปิดทำงานอู่</div>
                      <div className="text-lg font-black text-emerald-700 mt-0.5">
                        {currentViewStats.workDays} <span className="text-[10px] font-normal text-emerald-600">วัน ({currentViewStats.totalHours} ชม.)</span>
                      </div>
                    </div>
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-center">
                      <div className="text-[10px] text-slate-600 font-bold uppercase">วันหยุดประจำสัปดาห์</div>
                      <div className="text-lg font-black text-slate-700 mt-0.5">
                        {currentViewStats.weeklyOffs} <span className="text-[10px] font-normal text-slate-500">วัน</span>
                      </div>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 text-center">
                      <div className="text-[10px] text-amber-800 font-bold uppercase">วันหยุดพิเศษอู่</div>
                      <div className="text-lg font-black text-amber-700 mt-0.5">
                        {currentViewStats.shopHols} <span className="text-[10px] font-normal text-amber-600">วัน</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Table with auto calculated days */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[520px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-950 text-white font-bold">
                          <th className="py-2.5 px-3">วันที่ (Date)</th>
                          <th className="py-2.5 px-3">วันในสัปดาห์</th>
                          <th className="py-2.5 px-3">สถานะการทำงานอู่</th>
                          <th className="py-2.5 px-3 text-center">ชั่วโมงมาตรฐาน</th>
                          <th className="py-2.5 px-3 text-right">ดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                        {displayedCalendarDays.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-slate-400 font-bold">
                              ไม่มีข้อมูลวันในช่วงเวลาที่เลือก
                            </td>
                          </tr>
                        ) : (
                          displayedCalendarDays.map((d) => (
                            <tr key={d.date} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {d.date}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {d.dayName}
                              </td>
                              <td className="py-2.5 px-3">
                                {d.holidayName ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <span>🟠</span>
                                    <span>วันหยุดอู่: {d.holidayName}</span>
                                  </span>
                                ) : d.isWorkDay ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                    <span>เปิดทำงานปกติ</span>
                                    {d.isOverridden && <span className="text-[9px] text-purple-600 font-normal">(Override)</span>}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                    <span>วันหยุดประจำสัปดาห์</span>
                                    {d.isOverridden && <span className="text-[9px] text-purple-600 font-normal">(Override)</span>}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                {d.standardHours} ชม.
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleWorkDay(d.date)}
                                  className="px-2 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-100 whitespace-nowrap"
                                  title="คลิกเพื่อสลับวันทำงาน/วันหยุดเฉพาะวันนี้"
                                >
                                  สลับสถานะ
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>* ข้อมูลในตารางจะถูกคำนวณและแสดงผลอัตโนมัติแบบเรียลไทม์ตามกฎของอู่</span>
                    <button
                      type="button"
                      onClick={() => handleSyncMonthToCalendar(Number(calendarViewYear), Number(calendarViewMonth === 'all' ? 10 : calendarViewMonth))}
                      className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                    >
                      บันทึกซิงค์เฉพาะเดือนนี้ลงชีต
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: INDIVIDUAL TECHNICIAN LEAVES */}
          {calendarSubTab === 'leaves' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
              
              {/* Left Form: Add Leave Record */}
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleAddTechLeave}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="text-blue-600">📝</span>
                      บันทึกวันลาหยุดของพนักงานรายบุคคล
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      เมื่อช่างลากิจ ลาป่วย หรือพักร้อน ระบบจะหักลบเวลามาตรฐานของช่างรายคนนั้นออกให้ในการวิเคราะห์ % Utilization ทันทีโดยไม่ต้องแก้ปฏิทินส่วนกลาง
                    </p>
                  </div>

                  <div className="space-y-3 text-xs font-semibold">
                    <div>
                      <label className="block text-slate-700 mb-1">เลือกช่างพ่นสี / ช่างซ่อมรถยนต์ *</label>
                      <select
                        required
                        value={leaveTechEmail}
                        onChange={(e) => setLeaveTechEmail(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 bg-white"
                      >
                        {technicians.length === 0 ? (
                          <option value="">-- ยังไม่มีรายชื่อช่างในระบบ --</option>
                        ) : (
                          technicians.map((t) => (
                            <option key={t.UserID} value={t.Email}>
                              {t.Nickname || t.Name} ({t.Department})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 mb-1">ระบุวันที่หยุด *</label>
                        <input
                          type="date"
                          required
                          value={leaveDate}
                          onChange={(e) => setLeaveDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 mb-1">ประเภทการลา *</label>
                        <select
                          value={leaveType}
                          onChange={(e) => setLeaveType(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-950 font-bold"
                        >
                          <option value="ลากิจ">ลากิจ (Personal Leave)</option>
                          <option value="ลาป่วย">ลาป่วย (Sick Leave)</option>
                          <option value="พักร้อน">พักร้อน (Annual Leave)</option>
                          <option value="วันหยุดส่วนตัว">วันหยุดชดเชยส่วนตัว</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">หมายเหตุเพิ่มเติม / เหตุผล (ไม่บังคับ)</label>
                      <input
                        type="text"
                        value={leaveNotes}
                        onChange={(e) => setLeaveNotes(e.target.value)}
                        placeholder="เช่น พบแพทย์ตามนัด, ต่อใบขับขี่..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>บันทึกส่งวันลาลงชีต WorkCalendar</span>
                  </button>
                </form>
              </div>

              {/* Right Column: Registered Leaves list */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        รายการส่งใบลา / วันหยุดช่างพ่นสีทั้งหมด ({techLeaves.length} รายการ)
                      </h3>
                    </div>
                    <div className="w-full sm:w-48">
                      <input
                        type="text"
                        value={leaveSearch}
                        onChange={(e) => setLeaveSearch(e.target.value)}
                        placeholder="🔍 ค้นหาชื่อช่าง..."
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950 text-white font-bold">
                          <th className="py-2.5 px-4">วันที่ลา</th>
                          <th className="py-2.5 px-4">ชื่อช่าง</th>
                          <th className="py-2.5 px-4">ประเภทการลา</th>
                          <th className="py-2.5 px-4">เหตุผลย่อ</th>
                          <th className="py-2.5 px-4 text-right">การกระทำ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700">
                        {techLeaves.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-slate-400 font-bold">
                              ยังไม่มีรายการวันลาของช่างลงทะเบียนไว้
                            </td>
                          </tr>
                        ) : (
                          techLeaves
                            .filter((l) => {
                              if (!leaveSearch.trim()) return true;
                              const displayName = getTechDisplayName(l.TechEmail).toLowerCase();
                              return displayName.includes(leaveSearch.trim().toLowerCase());
                            })
                            .map((l) => (
                              <tr key={l.LeaveID} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-slate-900">{l.Date}</td>
                                <td className="py-3 px-4 font-bold text-slate-950">
                                  {getTechDisplayName(l.TechEmail).split(' (')[0]}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                      l.Type === 'ลาป่วย'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : l.Type === 'ลากิจ'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}
                                  >
                                    {l.Type}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500 font-medium truncate max-w-[120px]" title={l.Notes}>
                                  {l.Notes || '-'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTechLeave(l.LeaveID)}
                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                    title="ลบใบลาหยุดนี้"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 6: TIMELOGS SPREADSHEET VIEW */}
      {activeSheet === 'TimeLogs' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>⏱️</span>
                ประวัติการจับเวลาหน้างาน (TimeLogs)
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                    timeLogs.length === 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {timeLogs.length === 0 ? '0 รายการ (ระบบคลีนพร้อมเริ่มงาน)' : `${timeLogs.length} รายการ`}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ประวัติเวลาการกด START, PAUSE และ COMPLETE ของช่างทำสีแต่ละคันเพื่อนำไปวิเคราะห์ประสิทธิภาพ
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportSheetToCsv('TimeLogs')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                ส่งออก CSV
              </button>
              {timeLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearLogsModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  ล้าง TimeLogs ทั้งหมด
                </button>
              )}
            </div>
          </div>

          {timeLogs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                ระบบคลีนเรียบร้อย — พร้อมสำหรับการเริ่มใช้งานจริง!
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                ประวัติ TimeLogs ตัวอย่างถูกล้างออกหมดแล้ว เมื่อช่างกดปุ่ม <strong>START</strong> บน Technician Board หรือ Controller สั่งเปิดงาน ระบบจะบันทึก Log ลงตารางนี้และซิงค์กับ Google Sheets ทันที
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold">
                      <th className="py-3 px-4">LogID</th>
                      <th className="py-3 px-4">TaskID</th>
                      <th className="py-3 px-4">ช่างพ่นสี / ซ่อม</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">ระยะเวลาจริง</th>
                      <th className="py-3 px-4">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {timeLogs.map((l) => (
                      <tr key={l.LogID} className="hover:bg-slate-50 font-mono text-[11px]">
                        <td className="py-3 px-4 font-bold text-blue-600">{l.LogID}</td>
                        <td className="py-3 px-4 text-slate-500">{l.TaskID}</td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                          {getTechDisplayName(l.TechEmail).split(' (')[0]}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.Action === 'START'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : l.Action === 'PAUSE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {l.Action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{l.Timestamp}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-sans">
                          {l.DurationMinutes} นาที
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-600">{l.Note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRM DELETE DEPARTMENT MODAL */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบแผนกงาน</h3>
                <p className="text-xs text-slate-500 font-medium">ข้อมูลแผนกจะถูกถอนออกจากระบบ Master</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700">
              คุณแน่ใจว่าต้องการลบแผนก <span className="font-bold text-slate-900">"{deptToDelete.name}"</span> ({deptToDelete.id}) ใช่หรือไม่?
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateDepartments(departments.filter((d) => d.id !== deptToDelete.id));
                  showToast(`ลบแผนก "${deptToDelete.name}" เรียบร้อยแล้ว`);
                  setDeptToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
              >
                ยืนยันลบแผนก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CAR PART MODAL */}
      {partToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบชิ้นส่วนอะไหล่</h3>
                <p className="text-xs text-slate-500 font-medium">รายการชิ้นส่วนจะถูกนำออกจาก Master</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700">
              คุณแน่ใจว่าต้องการลบชิ้นส่วน <span className="font-bold text-slate-900">"{partToDelete}"</span> ใช่หรือไม่?
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPartToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCarPart(partToDelete);
                  setPartToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
              >
                ยืนยันลบชิ้นส่วน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE STAGE MODAL */}
      {stageToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบขั้นตอนมาตรฐาน SOP</h3>
                <p className="text-xs text-slate-500 font-medium">ลำดับขั้นตอนถัดไปจะถูกรันเลขใหม่ให้อัตโนมัติ</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700">
              คุณแน่ใจว่าต้องการลบขั้นตอน <span className="font-bold text-slate-900">"{stageToDelete.name}"</span> (ลำดับที่ {stageToDelete.stepNumber}) ใช่หรือไม่?
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setStageToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const remaining = masterSopStages
                    .filter((s) => s.id !== stageToDelete.id)
                    .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
                  onUpdateMasterSopStages(remaining);
                  showToast(`ลบขั้นตอน "${stageToDelete.name}" สำเร็จ`);
                  setStageToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
              >
                ยืนยันลบขั้นตอน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการถอดรายชื่อพนักงาน</h3>
                <p className="text-xs text-slate-500 font-medium">พนักงานจะไม่สามารถล็อกอินเข้าสู่ระบบได้อีกต่อไป</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700">
              คุณแน่ใจว่าต้องการลบรายชื่อพนักงาน <span className="font-bold text-slate-900">{userToDelete.Name}</span> ({userToDelete.UserID} • {userToDelete.Email}) ออกจากระบบใช่หรือไม่?
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteUser(userToDelete.UserID);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
              >
                ยืนยันถอดพนักงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE LEAVE MODAL */}
      {leaveToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบข้อมูลวันหยุด/วันลา</h3>
                <p className="text-xs text-slate-500 font-medium">รายการลางานจะถูกถอนออกจากระบบปฏิทิน</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700">
              คุณแน่ใจว่าต้องการลบประวัติการลา {leaveToDelete.Type} ในวันที่ <span className="font-bold text-slate-900">{leaveToDelete.Date}</span> ({getTechDisplayName(leaveToDelete.TechEmail)}) ใช่หรือไม่?
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLeaveToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateTechLeaves(techLeaves.filter((l) => l.LeaveID !== leaveToDelete.LeaveID));
                  showToast('ลบประวัติวันลาเรียบร้อยแล้ว');
                  setLeaveToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
              >
                ยืนยันลบข้อมูลลา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR ALL TIMELOGS MODAL */}
      {showClearLogsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการล้างประวัติ TimeLogs</h3>
                <p className="text-xs text-slate-500 font-medium">ลบประวัติการจับเวลาทั้งหมดเพื่อเริ่มงานจริง</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700">
              คุณต้องการลบประวัติ TimeLogs ทั้งหมด ({timeLogs.length} รายการ) ใช่หรือไม่? หลังจากล้างแล้ว ระบบจะคลีนพร้อมสำหรับการบันทึกเวลาจริงจากหน้างาน
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowClearLogsModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllTimeLogs();
                  setShowClearLogsModal(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
              >
                ยืนยันล้าง TimeLogs ทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
