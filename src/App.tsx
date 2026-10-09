import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SheetUser,
  SheetJob,
  SheetJobTask,
  SheetTimeLog,
  SheetWorkCalendar,
  SheetSetting,
  ActiveTechSession,
  TimeLogAction,
  TaskStatus,
  JobStatus,
  MasterSopStage,
  MasterDepartment,
  TechLeave,
} from './types/shopFloor';
import {
  INITIAL_USERS,
  INITIAL_JOBS,
  INITIAL_JOB_TASKS,
  INITIAL_TIME_LOGS,
  INITIAL_WORK_CALENDAR,
  INITIAL_SETTINGS,
  CAR_PARTS_LIST,
  INITIAL_MASTER_SOP_STAGES,
  INITIAL_TECH_LEAVES,
  INITIAL_DEPARTMENTS,
} from './data/initialSheetsData';
import { testConnection } from './services/firebase';
import {
  subscribeToWorkshopData,
  seedInitialDataIfEmpty,
  saveUserToFirestore,
  deleteUserFromFirestore,
  saveJobToFirestore,
  deleteJobFromFirestore,
  saveJobTaskToFirestore,
  deleteJobTaskFromFirestore,
  saveTimeLogToFirestore,
  clearAllTimeLogsFromFirestore,
  saveWorkCalendarToFirestore,
  saveTechLeavesToFirestore,
  deleteTechLeaveFromFirestore,
  saveSettingsToFirestore,
  saveCarPartsToFirestore,
  saveMasterSopStagesToFirestore,
  saveDepartmentsToFirestore,
} from './services/firestoreService';
import { DashboardView } from './components/DashboardView';
import { JobsManagerView } from './components/JobsManagerView';
import { TechnicianFloorView } from './components/TechnicianFloorView';
import {
  EfficiencyReportView,
  calculateDualEfficiency,
} from './components/EfficiencyReportView';
import { SheetsAndSettingsView, SheetTabName } from './components/SheetsAndSettingsView';
import {
  LogOut,
  Key,
  User,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  Cloud,
  Flame,
} from 'lucide-react';

type AppNavTab = 'dashboard' | 'jobs' | 'tech' | 'efficiency' | 'sheets';

export function computeActiveSessions(timeLogs: SheetTimeLog[]): ActiveTechSession[] {
  const map: Record<string, ActiveTechSession> = {};
  timeLogs.forEach((log) => {
    const key = `${log.TaskID.trim()}__${log.TechEmail.trim().toLowerCase()}`;
    if (log.Action === 'START') {
      map[key] = {
        TaskID: log.TaskID.trim(),
        TechEmail: log.TechEmail.trim().toLowerCase(),
        StartTimestamp: log.Timestamp,
      };
    } else if (log.Action === 'PAUSE' || log.Action === 'COMPLETE') {
      delete map[key];
    }
  });
  return Object.values(map);
}

// Strict sanitizer to prevent Users data from leaking into Tasks
export function sanitizeJobTasks(tasks: any[]): SheetJobTask[] {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter((t) => {
    if (!t || typeof t !== 'object') return false;
    const taskId = String(t.TaskID || '').trim();
    const jobId = String(t.JobID || '').trim();
    const taskName = String(t.TaskName || '').trim();

    if (!taskId || taskId.toUpperCase().startsWith('EMP-') || taskId.includes('@')) return false;
    if (jobId.includes('@')) return false;
    if (taskName === '123' || taskName === 'admin123') return false;
    if (['JOB-2610-001', 'JOB-2610-002', 'JOB-2610-003'].includes(jobId)) return false;
    return true;
  });
}

// Strict sanitizer to prevent Users data from leaking into Jobs
export function sanitizeJobs(jobList: any[]): SheetJob[] {
  if (!Array.isArray(jobList)) return [];
  return jobList.filter((j) => {
    if (!j || typeof j !== 'object') return false;
    const jobId = String(j.JobID || '').trim();
    if (!jobId || jobId.toUpperCase().startsWith('EMP-') || jobId.includes('@')) return false;
    if (['JOB-2610-001', 'JOB-2610-002', 'JOB-2610-003'].includes(jobId)) return false;
    return true;
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppNavTab>('dashboard');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Load initial database state from localStorage or fallback
  const [users, setUsers] = useState<SheetUser[]>(() => {
    const saved = localStorage.getItem('autofloor_users');
    if (saved) {
      try {
        const parsed: SheetUser[] = JSON.parse(saved);
        return parsed.map((u) => {
          const init = INITIAL_USERS.find((iu) => iu.Email.toLowerCase() === u.Email.toLowerCase());
          return {
            ...u,
            Nickname: u.Nickname || init?.Nickname || '',
          };
        });
      } catch {
        return INITIAL_USERS;
      }
    }
    return INITIAL_USERS;
  });

  const [jobs, setJobs] = useState<SheetJob[]>(() => {
    const saved = localStorage.getItem('autofloor_jobs');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return sanitizeJobs(parsed);
    } catch {
      return [];
    }
  });

  const [jobTasks, setJobTasks] = useState<SheetJobTask[]>(() => {
    const saved = localStorage.getItem('autofloor_jobtasks');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return sanitizeJobTasks(parsed);
    } catch {
      return [];
    }
  });

  const [timeLogs, setTimeLogs] = useState<SheetTimeLog[]>(() => {
    const saved = localStorage.getItem('autofloor_timelogs');
    return saved ? JSON.parse(saved) : [];
  });

  const [workCalendar, setWorkCalendar] = useState<SheetWorkCalendar[]>(() => {
    const saved = localStorage.getItem('autofloor_calendar');
    return saved ? JSON.parse(saved) : INITIAL_WORK_CALENDAR;
  });

  const [settings, setSettings] = useState<SheetSetting[]>(() => {
    const saved = localStorage.getItem('autofloor_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [carParts, setCarParts] = useState<string[]>(() => {
    const saved = localStorage.getItem('autofloor_carparts');
    return saved ? JSON.parse(saved) : CAR_PARTS_LIST;
  });

  const [masterSopStages, setMasterSopStages] = useState<MasterSopStage[]>(() => {
    const saved = localStorage.getItem('autofloor_master_sop_stages');
    return saved ? JSON.parse(saved) : INITIAL_MASTER_SOP_STAGES;
  });

  const [techLeaves, setTechLeaves] = useState<TechLeave[]>(() => {
    const saved = localStorage.getItem('autofloor_techleaves');
    return saved ? JSON.parse(saved) : INITIAL_TECH_LEAVES;
  });

  const [departments, setDepartments] = useState<MasterDepartment[]>(() => {
    const saved = localStorage.getItem('autofloor_departments');
    const raw: MasterDepartment[] = saved ? JSON.parse(saved) : INITIAL_DEPARTMENTS;
    return raw.map((d) => {
      const match = d.id.match(/^DEPT-(\d+)$/i);
      if (match && match[1].length === 1) {
        return { ...d, id: `DEPT-${match[1].padStart(2, '0')}` };
      }
      return d;
    });
  });

  // Authentication State
  const [currentUser, setCurrentUser] = useState<SheetUser | null>(() => {
    const saved = localStorage.getItem('autofloor_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Self-Service Change Password state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');

  // Selected tech email for Admin/Controller terminal switcher
  const [selectedTechEmail, setSelectedTechEmail] = useState<string>('');
  const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<SheetTabName>('Departments');
  const [showResetDbModal, setShowResetDbModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lock body scroll when any modal in App.tsx is active
  useEffect(() => {
    const isAnyModalOpen = isChangePasswordOpen || showResetDbModal || isCreateJobModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isChangePasswordOpen, showResetDbModal, isCreateJobModalOpen]);

  // Firebase Real-time Synchronization on Mount
  useEffect(() => {
    testConnection().then((connected) => {
      setIsFirebaseConnected(connected);
    });

    seedInitialDataIfEmpty().catch((err) => {
      console.warn('Initial seeding note:', err);
    });

    const unsubscribe = subscribeToWorkshopData({
      onUsersChange: (newUsers) => {
        setUsers(newUsers);
        setCurrentUser((prev) => {
          if (!prev) return null;
          const fresh = newUsers.find((u) => u.UserID === prev.UserID);
          if (fresh) {
            localStorage.setItem('autofloor_session', JSON.stringify(fresh));
            return fresh;
          }
          return prev;
        });
      },
      onJobsChange: (newJobs) => {
        setJobs(sanitizeJobs(newJobs));
      },
      onTasksChange: (newTasks) => {
        setJobTasks(sanitizeJobTasks(newTasks));
      },
      onTimeLogsChange: (newLogs) => {
        setTimeLogs(newLogs);
      },
      onCalendarChange: (newCalendar) => {
        setWorkCalendar(newCalendar);
      },
      onSettingsChange: (newSettings) => {
        const existingKeys = new Set(newSettings.map((s) => s.ConfigKey));
        const missing = INITIAL_SETTINGS.filter((s) => !existingKeys.has(s.ConfigKey));
        if (missing.length > 0) {
          const merged = [...newSettings, ...missing];
          setSettings(merged);
          saveSettingsToFirestore(missing).catch((e) => console.error("Auto-seed missing settings error:", e));
        } else {
          setSettings(newSettings);
        }
      },
      onCarPartsChange: (newParts) => {
        setCarParts(newParts);
      },
      onStagesChange: (newStages) => {
        setMasterSopStages(newStages);
      },
      onLeavesChange: (newLeaves) => {
        setTechLeaves(newLeaves);
      },
      onDepartmentsChange: (newDepartments) => {
        setDepartments(newDepartments);
      },
      onConnectionStatus: (connected) => {
        setIsFirebaseConnected(connected);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Live 1-second clock for active stopwatch updates
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // LocalStorage backups for instantaneous offline caching
  useEffect(() => {
    localStorage.setItem('autofloor_users', JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    localStorage.setItem('autofloor_jobs', JSON.stringify(jobs));
  }, [jobs]);
  useEffect(() => {
    localStorage.setItem('autofloor_jobtasks', JSON.stringify(jobTasks));
  }, [jobTasks]);
  useEffect(() => {
    localStorage.setItem('autofloor_timelogs', JSON.stringify(timeLogs));
  }, [timeLogs]);
  useEffect(() => {
    localStorage.setItem('autofloor_calendar', JSON.stringify(workCalendar));
  }, [workCalendar]);
  useEffect(() => {
    localStorage.setItem('autofloor_settings', JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem('autofloor_carparts', JSON.stringify(carParts));
  }, [carParts]);
  useEffect(() => {
    localStorage.setItem('autofloor_master_sop_stages', JSON.stringify(masterSopStages));
  }, [masterSopStages]);
  useEffect(() => {
    localStorage.setItem('autofloor_techleaves', JSON.stringify(techLeaves));
  }, [techLeaves]);
  useEffect(() => {
    localStorage.setItem('autofloor_departments', JSON.stringify(departments));
  }, [departments]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const activeSessions = useMemo(() => computeActiveSessions(timeLogs), [timeLogs]);

  const targetEfficiencyPct = useMemo(() => {
    const cfg = settings.find((s) => s.ConfigKey === 'TARGET_EFFICIENCY_PCT');
    return cfg ? Number(cfg.ConfigValue) || 85 : 85;
  }, [settings]);

  const pauseReasons = useMemo(() => {
    const cfg = settings.find((s) => s.ConfigKey === 'PAUSE_REASONS');
    if (!cfg || !cfg.ConfigValue.trim()) {
      return ['รออะไหล่/รอชิ้นงาน', 'รอลูกค้าอนุมัติ', 'พักเที่ยง/พักเบรก', 'งานแทรกเร่งด่วน', 'อื่นๆ'];
    }
    return cfg.ConfigValue.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [settings]);

  const efficiencySummary = useMemo(() => {
    return calculateDualEfficiency(
      users,
      jobTasks,
      timeLogs,
      workCalendar,
      '2026-09-30',
      '2026-10-06',
      techLeaves
    );
  }, [users, jobTasks, timeLogs, workCalendar, techLeaves]);

  // Handle direct navigation routing and role-based page enforcement
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.Role === 'Technician') {
      if (activeTab !== 'tech') {
        setActiveTab('tech');
      }
    } else if (currentUser.Role === 'Controller') {
      if (!['dashboard', 'jobs', 'sheets'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, activeTab]);

  // Setup default technician to display when switching to Tech Tab as Admin
  useEffect(() => {
    if (!selectedTechEmail && users.length > 0) {
      const firstTech = users.find((u) => u.Role === 'Technician' && u.Status === 'Active');
      if (firstTech) {
        setSelectedTechEmail(firstTech.Email);
      }
    }
  }, [users, selectedTechEmail]);

  // Handle Login authentication (supports Username, Employee UserID, or Email)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('กรุณากรอก Username หรือรหัสพนักงาน และรหัสผ่านให้ครบถ้วน');
      return;
    }

    const inputClean = loginEmail.trim().toLowerCase();
    const matched = users.find(
      (u) =>
        ((u.Username && u.Username.toLowerCase() === inputClean) ||
          u.Email.toLowerCase() === inputClean ||
          u.UserID.toLowerCase() === inputClean ||
          (u.Nickname && u.Nickname.toLowerCase() === inputClean)) &&
        u.Password === loginPassword
    );

    if (matched) {
      if (matched.Status !== 'Active') {
        setLoginError('สถานะบัญชีนี้ถูกปิดใช้งานชั่วคราว (Inactive)');
        return;
      }
      setCurrentUser(matched);
      localStorage.setItem('autofloor_session', JSON.stringify(matched));
      showToast(`สวัสดีครับคุณ ${matched.Name} เข้าสู่ระบบเรียบร้อย`);
    } else {
      setLoginError('Username / รหัสพนักงาน หรือรหัสผ่านไม่ถูกต้อง (กรุณาตรวจสอบและพิมพ์ใหม่อีกครั้ง)');
    }
  };

  // Handle Employee Self-Service Change Password
  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    if (!currentUser) return;

    if (!oldPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setChangePasswordError('กรุณากรอกข้อมูลรหัสผ่านให้ครบทุกช่อง');
      return;
    }

    if (oldPasswordInput !== (currentUser.Password || '')) {
      setChangePasswordError('รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    if (newPasswordInput.trim().length < 3) {
      setChangePasswordError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError('รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    const updatedUser: SheetUser = {
      ...currentUser,
      Password: newPasswordInput.trim(),
    };

    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.UserID === updatedUser.UserID ? updatedUser : u)));
    saveUserToFirestore(updatedUser).catch((err) => {
      console.error('Failed to sync updated password to Firestore:', err);
    });

    localStorage.setItem('autofloor_session', JSON.stringify(updatedUser));
    setIsChangePasswordOpen(false);
    setOldPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    showToast('เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว');
  };

  // Logout routine
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('autofloor_session');
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  };

  const handleSelectTechFromDashboard = (techEmail: string) => {
    if (currentUser?.Role === 'Admin') {
      setSelectedTechEmail(techEmail);
      setActiveTab('tech');
    }
  };

  // Handler: Create Job & Split Subtasks (Saves to state + Firebase)
  const handleCreateJobWithTasks = (
    jobData: Omit<SheetJob, 'Status'>,
    subtasks: {
      TaskName: string;
      AssignedTechs: string[];
      StartDate: string;
      DueDate: string;
      StandardMinutes: number;
      PartsChecklist: string;
    }[]
  ) => {
    const newJobId = jobData.JobID.trim();
    const newJob: SheetJob = {
      ...jobData,
      JobID: newJobId,
      Status: 'Open',
    };

    const baseTaskNum = 1001 + jobTasks.length;
    const newTasks: SheetJobTask[] = subtasks.map((st, idx) => ({
      TaskID: `TSK-${baseTaskNum + idx}`,
      JobID: newJobId,
      TaskName: st.TaskName,
      AssignedTechs: st.AssignedTechs.join(', '),
      StartDate: st.StartDate,
      DueDate: st.DueDate,
      Status: 'Pending',
      TotalMinutes: 0,
      StandardMinutes: st.StandardMinutes,
      PartsChecklist: st.PartsChecklist,
    }));

    setJobs((prev) => [newJob, ...prev]);
    setJobTasks((prev) => [...newTasks, ...prev]);

    saveJobToFirestore(newJob).catch((e) => console.error('Save job error:', e));
    newTasks.forEach((t) => {
      saveJobTaskToFirestore(t).catch((e) => console.error('Save task error:', e));
    });

    showToast(
      `บันทึกใบงาน ${newJobId} (${jobData.LicensePlate}) พร้อมแตกขั้นตอนย่อย ${newTasks.length} งานสำเร็จ`
    );
  };

  // Handler: Add Subtask to Existing Job
  const handleAddSubtaskToExistingJob = (
    jobId: string,
    subtask: {
      TaskName: string;
      AssignedTechs: string[];
      StartDate: string;
      DueDate: string;
      StandardMinutes: number;
      PartsChecklist: string;
    }
  ) => {
    const newTaskId = `TSK-${1001 + jobTasks.length}`;
    const created: SheetJobTask = {
      TaskID: newTaskId,
      JobID: jobId,
      TaskName: subtask.TaskName,
      AssignedTechs: subtask.AssignedTechs.join(', '),
      StartDate: subtask.StartDate,
      DueDate: subtask.DueDate,
      Status: 'Pending',
      TotalMinutes: 0,
      StandardMinutes: subtask.StandardMinutes,
      PartsChecklist: subtask.PartsChecklist,
    };
    setJobTasks((prev) => [...prev, created]);
    saveJobTaskToFirestore(created).catch((e) => console.error('Save subtask error:', e));
    showToast(`เพิ่มขั้นตอนย่อยสำเร็จ: ${newTaskId} ในใบงาน ${jobId}`);
  };

  // Handler: Delete Job
  const handleDeleteJob = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.JobID !== jobId));
    const tasksToDelete = jobTasks.filter((t) => t.JobID === jobId);
    setJobTasks((prev) => prev.filter((t) => t.JobID !== jobId));

    deleteJobFromFirestore(jobId).catch((e) => console.error('Delete job error:', e));
    tasksToDelete.forEach((t) => {
      deleteJobTaskFromFirestore(t.TaskID).catch((e) => console.error('Delete task error:', e));
    });

    showToast(`ถอนใบงาน ${jobId} และรายการซ่อมย่อยทั้งหมดออกจากระบบเรียบร้อยแล้ว`);
  };

  // Handler: Edit Job
  const handleEditJob = (updatedJob: SheetJob) => {
    setJobs((prev) => prev.map((j) => (j.JobID === updatedJob.JobID ? updatedJob : j)));
    saveJobToFirestore(updatedJob).catch((e) => console.error('Update job error:', e));
    showToast(`บันทึกแก้ไขข้อมูลใบงาน ${updatedJob.JobID} สำเร็จ`);
  };

  // Handler: Update Parts Checklist
  const handleUpdateTaskChecklist = (taskId: string, checklistString: string) => {
    let updatedTarget: SheetJobTask | null = null;
    setJobTasks((prev) =>
      prev.map((t) => {
        if (t.TaskID === taskId) {
          updatedTarget = { ...t, PartsChecklist: checklistString };
          return updatedTarget;
        }
        return t;
      })
    );
    if (updatedTarget) {
      saveJobTaskToFirestore(updatedTarget).catch((e) => console.error('Update checklist error:', e));
    }
    showToast(`อัปเดตเช็คลิสต์ชิ้นงาน ${taskId} แล้ว`);
  };

  // Handler: Admin Adding New User
  const handleAddUser = (userPayload: Omit<SheetUser, 'Status'>) => {
    const newUser: SheetUser = {
      ...userPayload,
      Status: 'Active',
    };
    setUsers((prev) => [...prev, newUser]);
    saveUserToFirestore(newUser).catch((e) => console.error('Save user error:', e));
    showToast(`เพิ่มรายชื่อพนักงาน ${newUser.Name} (${newUser.UserID}) เรียบร้อยแล้ว`);
  };

  // Handler: Admin Deleting User
  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.UserID !== userId));
    deleteUserFromFirestore(userId).catch((e) => console.error('Delete user error:', e));
    showToast(`ลบรายชื่อพนักงาน ${userId} เรียบร้อยแล้ว`);
  };

  // Handler: Admin Editing User
  const handleEditUser = (updatedUser: SheetUser) => {
    setUsers((prev) => prev.map((u) => (u.UserID === updatedUser.UserID ? updatedUser : u)));
    saveUserToFirestore(updatedUser).catch((e) => console.error('Update user error:', e));
    showToast(`อัปเดตข้อมูลและรหัสผ่านของ ${updatedUser.Name} เรียบร้อยแล้ว`);
  };

  // Handler: Car parts management
  const handleAddCarPart = (partName: string) => {
    const nextParts = [...carParts, partName];
    setCarParts(nextParts);
    saveCarPartsToFirestore(nextParts).catch((e) => console.error('Save car parts error:', e));
    showToast(`เพิ่มชิ้นส่วน "${partName}" สำเร็จ`);
  };

  const handleEditCarPart = (oldName: string, newName: string) => {
    const nextParts = carParts.map((p) => (p === oldName ? newName : p));
    setCarParts(nextParts);
    saveCarPartsToFirestore(nextParts).catch((e) => console.error('Save car parts error:', e));
    showToast(`แก้ไขชื่อชิ้นส่วนเป็น "${newName}" สำเร็จ`);
  };

  const handleDeleteCarPart = (partName: string) => {
    const nextParts = carParts.filter((p) => p !== partName);
    setCarParts(nextParts);
    saveCarPartsToFirestore(nextParts).catch((e) => console.error('Save car parts error:', e));
    showToast(`ลบชิ้นส่วน "${partName}" สำเร็จ`);
  };

  const handleUpdateMasterSopStages = (stages: MasterSopStage[]) => {
    setMasterSopStages(stages);
    saveMasterSopStagesToFirestore(stages).catch((e) => console.error('Save stages error:', e));
    showToast('บันทึกขั้นตอนงานซ่อมหลักมาตรฐาน (Master SOP) เรียบร้อยแล้ว');
  };

  const handleUpdateDepartments = (newDepts: MasterDepartment[]) => {
    setDepartments(newDepts);
    saveDepartmentsToFirestore(newDepts).catch((e) => console.error('Save departments error:', e));
    showToast('อัปเดตตารางแผนก Master Departments เรียบร้อยแล้ว');
  };

  const handleUpdateWorkCalendar = (newCalendar: SheetWorkCalendar[]) => {
    setWorkCalendar(newCalendar);
    saveWorkCalendarToFirestore(newCalendar).catch((e) => console.error('Save calendar error:', e));
    showToast('อัปเดตตารางวันทำงานในชีต WorkCalendar เรียบร้อยแล้ว');
  };

  const handleUpdateTechLeaves = (newLeaves: TechLeave[]) => {
    setTechLeaves(newLeaves);
    saveTechLeavesToFirestore(newLeaves).catch((e) => console.error('Save leaves error:', e));
    showToast('อัปเดตตารางวันลา/วันหยุดช่างรายบุคคลเรียบร้อยแล้ว');
  };

  const handleUpdateSettings = (newSettings: SheetSetting[]) => {
    setSettings(newSettings);
    saveSettingsToFirestore(newSettings).catch((e) => console.error('Save settings error:', e));
    showToast('บันทึกการตั้งค่าลงชีต Settings เรียบร้อยแล้ว');
  };

  // Handler to clear all TimeLogs for production use
  const handleClearAllTimeLogs = () => {
    setTimeLogs([]);
    clearAllTimeLogsFromFirestore().catch((e) => console.error('Clear logs error:', e));
    showToast('ล้างประวัติบันทึกเวลา TimeLogs ทั้งหมดเรียบร้อยแล้ว');
  };

  // Handler to clear all Jobs and Tasks for production use
  const handleClearAllJobs = () => {
    jobs.forEach((j) => deleteJobFromFirestore(j.JobID).catch((e) => console.error(e)));
    jobTasks.forEach((t) => deleteJobTaskFromFirestore(t.TaskID).catch((e) => console.error(e)));
    setJobs([]);
    setJobTasks([]);
    setTimeLogs([]);
    clearAllTimeLogsFromFirestore().catch((e) => console.error(e));
    showToast('ล้างใบงานและขั้นตอนงานตัวอย่างทั้งหมดเรียบร้อยแล้ว');
  };

  // Reset database to initial standard state
  const handleResetDatabase = () => {
    setShowResetDbModal(true);
  };

  const executeResetDatabase = () => {
    localStorage.removeItem('autofloor_users');
    localStorage.removeItem('autofloor_jobs');
    localStorage.removeItem('autofloor_jobtasks');
    localStorage.removeItem('autofloor_timelogs');
    localStorage.removeItem('autofloor_calendar');
    localStorage.removeItem('autofloor_settings');
    localStorage.removeItem('autofloor_carparts');
    localStorage.removeItem('autofloor_master_sop_stages');
    localStorage.removeItem('autofloor_departments');
    localStorage.removeItem('autofloor_session');

    setUsers(INITIAL_USERS);
    setJobs(INITIAL_JOBS);
    setJobTasks(INITIAL_JOB_TASKS);
    setTimeLogs(INITIAL_TIME_LOGS);
    setWorkCalendar(INITIAL_WORK_CALENDAR);
    setSettings(INITIAL_SETTINGS);
    setCarParts(CAR_PARTS_LIST);
    setMasterSopStages(INITIAL_MASTER_SOP_STAGES);
    setDepartments(INITIAL_DEPARTMENTS);
    setCurrentUser(null);
    setShowResetDbModal(false);

    // Save initial standard seed to Firestore
    INITIAL_USERS.forEach((u) => saveUserToFirestore(u).catch((e) => console.error(e)));
    INITIAL_WORK_CALENDAR.forEach((c) => saveWorkCalendarToFirestore([c]).catch((e) => console.error(e)));
    INITIAL_SETTINGS.forEach((s) => saveSettingsToFirestore([s]).catch((e) => console.error(e)));

    showToast('คืนค่าฐานข้อมูลสู่มาตรฐานโรงงานเสร็จสมบูรณ์');
  };

  // Automated Night Cutoff to Auto-Pause any active sessions running past the cutoff time (e.g. 23:00)
  const checkAndApplyNightAutoCutoff = useCallback(() => {
    const cutoffEnabledCfg = settings.find((s) => s.ConfigKey === 'NIGHT_AUTO_CUTOFF_ENABLED');
    const isEnabled = !cutoffEnabledCfg || cutoffEnabledCfg.ConfigValue.trim().toUpperCase() === 'TRUE';
    if (!isEnabled) return;

    const cutoffTimeCfg = settings.find((s) => s.ConfigKey === 'NIGHT_AUTO_CUTOFF_TIME');
    const cutoffTimeStr = cutoffTimeCfg?.ConfigValue?.trim() || '23:00';
    const [cutoffHourStr, cutoffMinuteStr] = cutoffTimeStr.split(':');
    const cutoffHour = parseInt(cutoffHourStr, 10) || 23;
    const cutoffMinute = parseInt(cutoffMinuteStr, 10) || 0;

    const cutoffReasonCfg = settings.find((s) => s.ConfigKey === 'NIGHT_AUTO_CUTOFF_REASON');
    const cutoffReasonBase = cutoffReasonCfg?.ConfigValue?.trim() || 'ลืมกดหยุด';

    const currentMs = Date.now();
    const currentActive = computeActiveSessions(timeLogs);
    if (currentActive.length === 0) return;

    const sessionsToCutoff: {
      session: ActiveTechSession;
      cutoffIso: string;
      durationMinutes: number;
      task: SheetJobTask;
    }[] = [];

    currentActive.forEach((sess) => {
      const startDate = new Date(sess.StartTimestamp);
      if (isNaN(startDate.getTime())) return;

      const sessionCutoff = new Date(startDate);
      sessionCutoff.setHours(cutoffHour, cutoffMinute, 0, 0);

      let targetCutoff = sessionCutoff;
      if (startDate.getTime() >= sessionCutoff.getTime()) {
        targetCutoff = new Date(sessionCutoff.getTime() + 24 * 60 * 60 * 1000);
      }

      if (currentMs >= targetCutoff.getTime()) {
        const durationMinutes = Math.max(
          1,
          Math.round((targetCutoff.getTime() - startDate.getTime()) / 60000)
        );
        const task = jobTasks.find((t) => t.TaskID === sess.TaskID);
        if (task) {
          sessionsToCutoff.push({
            session: sess,
            cutoffIso: targetCutoff.toISOString(),
            durationMinutes,
            task,
          });
        }
      }
    });

    if (sessionsToCutoff.length === 0) return;

    let updatedLogs = [...timeLogs];
    const affectedJobIds = new Set<string>();
    const pausedTechNames: string[] = [];

    sessionsToCutoff.forEach((item, idx) => {
      const newLogId = `LOG-${String(updatedLogs.length + idx + 1).padStart(4, '0')}`;
      const note = `ระบบหยุดให้อัตโนมัติเวลา ${cutoffTimeStr} น. (${cutoffReasonBase})`;
      const autoPauseLog: SheetTimeLog = {
        LogID: newLogId,
        TaskID: item.session.TaskID,
        TechEmail: item.session.TechEmail.toLowerCase(),
        Action: 'PAUSE',
        Timestamp: item.cutoffIso,
        DurationMinutes: item.durationMinutes,
        Note: note,
      };
      updatedLogs.push(autoPauseLog);
      saveTimeLogToFirestore(autoPauseLog).catch((e) => console.error('Save auto-cutoff log error:', e));

      const u = users.find((user) => user.Email.toLowerCase() === item.session.TechEmail.toLowerCase());
      pausedTechNames.push(u ? (u.Nickname || u.Name) : item.session.TechEmail.split('@')[0]);

      affectedJobIds.add(item.task.JobID);
    });

    const remainingSessions = computeActiveSessions(updatedLogs);

    const updatedTasks = jobTasks.map((t) => {
      const taskTotalMinutes = updatedLogs
        .filter((l) => l.TaskID === t.TaskID)
        .reduce((sum, l) => sum + (Number(l.DurationMinutes) || 0), 0);
      const isStillRunning = remainingSessions.some((s) => s.TaskID === t.TaskID);
      const wasRunning = currentActive.some((s) => s.TaskID === t.TaskID);
      let nextStatus = t.Status;
      if (wasRunning && !isStillRunning && t.Status === 'In Progress') {
        nextStatus = 'Paused';
      }
      const updatedT: SheetJobTask = {
        ...t,
        TotalMinutes: taskTotalMinutes,
        Status: nextStatus,
      };
      if (nextStatus !== t.Status || taskTotalMinutes !== t.TotalMinutes) {
        saveJobTaskToFirestore(updatedT).catch((e) => console.error('Auto-cutoff update task error:', e));
      }
      return updatedT;
    });

    const updatedJobs = jobs.map((j) => {
      if (!affectedJobIds.has(j.JobID)) return j;
      const siblingTasks = updatedTasks.filter((t) => t.JobID === j.JobID);
      const allCompleted = siblingTasks.length > 0 && siblingTasks.every((t) => t.Status === 'Completed');
      const anyInProgress = siblingTasks.some((t) => t.Status === 'In Progress');
      const anyPaused = siblingTasks.some((t) => t.Status === 'Paused');
      let jobStatus: JobStatus = 'Open';
      if (allCompleted) jobStatus = 'Completed';
      else if (anyInProgress) jobStatus = 'In Progress';
      else if (anyPaused) jobStatus = 'Paused';
      const updatedJ: SheetJob = { ...j, Status: jobStatus };
      if (jobStatus !== j.Status) {
        saveJobToFirestore(updatedJ).catch((e) => console.error('Auto-cutoff update job error:', e));
      }
      return updatedJ;
    });

    setTimeLogs(updatedLogs);
    setJobTasks(updatedTasks);
    setJobs(updatedJobs);

    showToast(
      `ระบบ Auto-Cutoff เวลา ${cutoffTimeStr} น. พักงานช่าง ${pausedTechNames.join(', ')} อัตโนมัติ (${cutoffReasonBase})`
    );
  }, [settings, timeLogs, jobTasks, jobs, users, showToast]);

  // Periodic automatic check for night cutoff
  useEffect(() => {
    checkAndApplyNightAutoCutoff();
  }, [nowMs, checkAndApplyNightAutoCutoff]);

  // Handler: Record Time Action (START, PAUSE, COMPLETE) with live Firebase persistence
  const handleRecordTimeAction = (
    taskId: string,
    techEmail: string,
    action: TimeLogAction,
    note: string
  ) => {
    const cleanTech = techEmail.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const currentMs = Date.now();

    const autoPauseCfg = settings.find((s) => s.ConfigKey === 'AUTO_PAUSE_PREVIOUS_TASK');
    const shouldAutoPause =
      !autoPauseCfg || autoPauseCfg.ConfigValue.trim().toUpperCase() === 'TRUE';

    let updatedLogs = [...timeLogs];
    const currentActive = computeActiveSessions(updatedLogs);

    // 1. If START and shouldAutoPause, pause any other running task of this technician
    if (action === 'START' && shouldAutoPause) {
      currentActive.forEach((sess) => {
        if (sess.TechEmail.toLowerCase() === cleanTech && sess.TaskID !== taskId) {
          const prevStartMs = new Date(sess.StartTimestamp).getTime();
          const prevDuration = Math.max(1, Math.round((currentMs - prevStartMs) / 60000));
          const autoLogId = `LOG-${String(updatedLogs.length + 1).padStart(4, '0')}`;
          const autoPauseLog: SheetTimeLog = {
            LogID: autoLogId,
            TaskID: sess.TaskID,
            TechEmail: cleanTech,
            Action: 'PAUSE',
            Timestamp: nowIso,
            DurationMinutes: prevDuration,
            Note: `พักงานอัตโนมัติเนื่องจากสลับไปเริ่มงานใหม่ ${taskId}`,
          };
          updatedLogs.push(autoPauseLog);
          saveTimeLogToFirestore(autoPauseLog).catch((e) => console.error('Save auto-pause log error:', e));
        }
      });
    }

    // 2. Calculate DurationMinutes if PAUSE or COMPLETE
    let durationMinutes = 0;
    if (action === 'PAUSE' || action === 'COMPLETE') {
      const matchingSession = currentActive.find(
        (s) => s.TaskID === taskId && s.TechEmail.toLowerCase() === cleanTech
      );
      if (matchingSession) {
        const startMs = new Date(matchingSession.StartTimestamp).getTime();
        durationMinutes = Math.max(1, Math.round((currentMs - startMs) / 60000));
      }
    }

    const newLogId = `LOG-${String(updatedLogs.length + 1).padStart(4, '0')}`;
    const newLogEntry: SheetTimeLog = {
      LogID: newLogId,
      TaskID: taskId,
      TechEmail: cleanTech,
      Action: action,
      Timestamp: nowIso,
      DurationMinutes: durationMinutes,
      Note: note,
    };
    updatedLogs.push(newLogEntry);
    saveTimeLogToFirestore(newLogEntry).catch((e) => console.error('Save time log error:', e));

    const remainingSessions = computeActiveSessions(updatedLogs);

    // 3. Recompute TotalMinutes and Task Status in JobTasks
    let affectedJobId = '';
    const updatedTasks = jobTasks.map((t) => {
      const taskTotalMinutes = updatedLogs
        .filter((l) => l.TaskID === t.TaskID)
        .reduce((sum, l) => sum + (Number(l.DurationMinutes) || 0), 0);

      if (t.TaskID !== taskId) {
        const stillRunning = remainingSessions.some((s) => s.TaskID === t.TaskID);
        const wasRunning = currentActive.some((s) => s.TaskID === t.TaskID);
        const nextStatus: TaskStatus =
          wasRunning && !stillRunning && t.Status === 'In Progress' ? 'Paused' : t.Status;

        const updatedT: SheetJobTask = {
          ...t,
          TotalMinutes: taskTotalMinutes,
          Status: nextStatus,
        };
        if (nextStatus !== t.Status || taskTotalMinutes !== t.TotalMinutes) {
          saveJobTaskToFirestore(updatedT).catch((e) => console.error('Update task status error:', e));
        }
        return updatedT;
      }

      affectedJobId = t.JobID;
      let nextStatus: TaskStatus = 'In Progress';
      if (action === 'COMPLETE') {
        nextStatus = 'Completed';
      } else if (action === 'PAUSE') {
        const otherTechRunning = remainingSessions.some((s) => s.TaskID === taskId);
        nextStatus = otherTechRunning ? 'In Progress' : 'Paused';
      }

      const updatedT: SheetJobTask = {
        ...t,
        TotalMinutes: taskTotalMinutes,
        Status: nextStatus,
      };
      saveJobTaskToFirestore(updatedT).catch((e) => console.error('Update active task error:', e));
      return updatedT;
    });

    // 4. Recompute parent Job status in Jobs
    const updatedJobs = jobs.map((j) => {
      if (j.JobID !== affectedJobId) return j;
      const siblingTasks = updatedTasks.filter((t) => t.JobID === j.JobID);
      const allCompleted =
        siblingTasks.length > 0 && siblingTasks.every((t) => t.Status === 'Completed');
      const anyInProgress = siblingTasks.some((t) => t.Status === 'In Progress');
      const anyPaused = siblingTasks.some((t) => t.Status === 'Paused');

      let jobStatus: JobStatus = 'Open';
      if (allCompleted) jobStatus = 'Completed';
      else if (anyInProgress) jobStatus = 'In Progress';
      else if (anyPaused) jobStatus = 'Paused';

      const updatedJ: SheetJob = {
        ...j,
        Status: jobStatus,
      };
      if (jobStatus !== j.Status) {
        saveJobToFirestore(updatedJ).catch((e) => console.error('Update job status error:', e));
      }
      return updatedJ;
    });

    setTimeLogs(updatedLogs);
    setJobTasks(updatedTasks);
    setJobs(updatedJobs);
    setNowMs(Date.now());

    if (action === 'START') {
      showToast(`เริ่มจับเวลาขั้นตอน ${taskId} เรียบร้อยแล้ว`);
    } else if (action === 'PAUSE') {
      showToast(
        `หยุดพักจับเวลาขั้นตอน ${taskId} (${note}) · สะสมเวลารอบนี้ +${durationMinutes} นาที`
      );
    } else {
      showToast(
        `ปิดงานขั้นตอน ${taskId} เสร็จสิ้นสมบูรณ์ · บันทึกเวลารอบนี้ +${durationMinutes} นาที`
      );
    }
  };

  // RENDER CLEAN LOGIN SCREEN IF NO SESSION (WITHOUT ANY SIMULATION CODE)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/20 ring-4 ring-blue-500/10">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          </div>
          <h2 className="mt-5 text-center text-2xl font-bold tracking-tight text-white">
            Technician Time Tracking
          </h2>
          <p className="mt-1 text-center text-xs text-blue-400 font-semibold tracking-wide">
            Time Tracking Control System
          </p>
          <p className="mt-1.5 text-center text-xs text-slate-400">
            ระบบบันทึกเวลาทำงานและควบคุมหน้างานอู่ซ่อมรถ
          </p>
        </div>

        <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8 space-y-6">
            {/* Cloud Real-Time Indicator */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-slate-300">ฐานข้อมูลคลาวด์</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Firebase Connected</span>
              </div>
            </div>

            {loginError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-400 rounded-xl flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="ป้อน Username"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="ป้อนรหัสผ่านที่ได้รับจากระบบ"
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  เข้าสู่ระบบ (Sign In)
                </button>
              </div>
            </form>

            <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-800">
              <p>ช่างและพนักงานใช้ Username และรหัสผ่านที่ตั้งค่าไว้ในระบบ</p>
              <p className="text-slate-400 mt-1">
                หากจำรหัสผ่านไม่ได้ สามารถแจ้งหัวหน้างาน (Admin) เพื่อตั้งรหัสผ่านใหม่
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED WORKSHOP LAYOUT
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar: 3 Clean Zones */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3">
            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault();
                if (currentUser.Role !== 'Technician') setActiveTab('dashboard');
              }}
              className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <span>Technician Time Tracking</span>
            </a>
            {isFirebaseConnected && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Firebase Real-time
              </span>
            )}
          </div>

          {/* Zone 2: Navigation Links (Strictly filtered by Role permissions) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            {currentUser.Role === 'Technician' ? (
              <button
                onClick={() => setActiveTab('tech')}
                className="py-1 border-b-2 border-blue-500 text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                Technician Board • งานของฉัน
              </button>
            ) : currentUser.Role === 'Controller' ? (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'jobs'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  Jobs
                </button>
                <button
                  onClick={() => {
                    setSettingsSubTab('CarParts');
                    setActiveTab('sheets');
                  }}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'sheets'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  การตั้งค่า
                </button>
              </>
            ) : (
              // Admin sees all navigation tabs
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'jobs'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  Jobs
                </button>
                <button
                  onClick={() => setActiveTab('tech')}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'tech'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  Technician Board
                </button>
                <button
                  onClick={() => setActiveTab('efficiency')}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'efficiency'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  Technician Efficiency
                </button>
                <button
                  onClick={() => {
                    setSettingsSubTab('Departments');
                    setActiveTab('sheets');
                  }}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'sheets'
                      ? 'border-blue-500 text-white font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  การตั้งค่า
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Profile Badge & Logout button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white">{currentUser.Name}</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">
                {currentUser.Role} • {currentUser.Username || currentUser.UserID}
              </div>
            </div>

            <button
              onClick={() => {
                setChangePasswordError('');
                setOldPasswordInput('');
                setNewPasswordInput('');
                setConfirmPasswordInput('');
                setIsChangePasswordOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-800 text-blue-300 hover:text-white hover:bg-slate-700 rounded-lg border border-slate-700 transition-all cursor-pointer"
              title="เปลี่ยนรหัสผ่านของฉัน"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden md:inline">เปลี่ยนรหัสผ่าน</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg border border-slate-700 transition-all cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Tab Links (Strictly Filtered by Role) */}
        <div className="flex lg:hidden overflow-x-auto border-t border-slate-800 bg-slate-900 px-4 py-2 gap-2 text-xs font-medium">
          {currentUser.Role === 'Technician' ? (
            <div className="px-3 py-1.5 text-[11px] text-blue-400 font-semibold whitespace-nowrap">
              🔒 Technician Board: {currentUser.Name} {currentUser.Nickname ? `(${currentUser.Nickname})` : ''}
            </div>
          ) : currentUser.Role === 'Controller' ? (
            (
              [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'jobs', label: 'Jobs' },
                { id: 'sheets', label: 'การตั้งค่า' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'sheets') setSettingsSubTab('CarParts');
                  setActiveTab(item.id);
                }}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))
          ) : (
            (
              [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'jobs', label: 'Jobs' },
                { id: 'tech', label: 'Technician Board' },
                { id: 'efficiency', label: 'Technician Efficiency' },
                { id: 'sheets', label: 'การตั้งค่า' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'sheets') setSettingsSubTab('Departments');
                  setActiveTab(item.id);
                }}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && currentUser.Role !== 'Technician' && (
          <DashboardView
            jobs={jobs}
            jobTasks={jobTasks}
            users={users}
            timeLogs={timeLogs}
            activeSessions={activeSessions}
            efficiencyRows={efficiencySummary.rows}
            nowMs={nowMs}
            targetEfficiencyPct={targetEfficiencyPct}
            currentUserRole={currentUser.Role}
            departments={departments}
            onOpenCreateJob={() => {
              setActiveTab('jobs');
              setIsCreateJobModalOpen(true);
            }}
            onSelectTechView={handleSelectTechFromDashboard}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'jobs' && currentUser.Role !== 'Technician' && (
          <JobsManagerView
            jobs={jobs}
            jobTasks={jobTasks}
            users={users}
            activeSessions={activeSessions}
            nowMs={nowMs}
            carParts={carParts}
            masterSopStages={masterSopStages}
            departments={departments}
            isCreateModalOpen={isCreateJobModalOpen}
            onOpenCreateModal={() => setIsCreateJobModalOpen(true)}
            onCloseCreateModal={() => setIsCreateJobModalOpen(false)}
            onCreateJobWithTasks={handleCreateJobWithTasks}
            onAddSubtaskToExistingJob={handleAddSubtaskToExistingJob}
            onDeleteJob={handleDeleteJob}
            onEditJob={handleEditJob}
            onClearAllJobs={handleClearAllJobs}
          />
        )}

        {activeTab === 'tech' && currentUser.Role !== 'Controller' && (
          <TechnicianFloorView
            currentUser={currentUser}
            users={users}
            jobs={jobs}
            jobTasks={jobTasks}
            timeLogs={timeLogs}
            activeSessions={activeSessions}
            pauseReasons={pauseReasons}
            nowMs={nowMs}
            selectedTechEmail={selectedTechEmail}
            onChangeSelectedTechEmail={setSelectedTechEmail}
            onRecordTimeAction={handleRecordTimeAction}
            onUpdateTaskChecklist={handleUpdateTaskChecklist}
          />
        )}

        {activeTab === 'efficiency' && currentUser.Role === 'Admin' && (
          <EfficiencyReportView
            users={users}
            jobTasks={jobTasks}
            timeLogs={timeLogs}
            workCalendar={workCalendar}
            techLeaves={techLeaves}
            targetEfficiencyPct={targetEfficiencyPct}
          />
        )}

        {activeTab === 'sheets' && currentUser.Role !== 'Technician' && (
          <SheetsAndSettingsView
            users={users}
            jobs={jobs}
            jobTasks={jobTasks}
            timeLogs={timeLogs}
            workCalendar={workCalendar}
            techLeaves={techLeaves}
            settings={settings}
            carParts={carParts}
            masterSopStages={masterSopStages}
            departments={departments}
            initialSubTab={settingsSubTab}
            currentUserRole={currentUser.Role}
            onUpdateSettings={handleUpdateSettings}
            onUpdateWorkCalendar={handleUpdateWorkCalendar}
            onUpdateTechLeaves={handleUpdateTechLeaves}
            onUpdateDepartments={handleUpdateDepartments}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onEditUser={handleEditUser}
            onAddCarPart={handleAddCarPart}
            onEditCarPart={handleEditCarPart}
            onDeleteCarPart={handleDeleteCarPart}
            onUpdateMasterSopStages={handleUpdateMasterSopStages}
            onClearAllTimeLogs={handleClearAllTimeLogs}
            showToast={showToast}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 mt-12">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            {settings.find((s) => s.ConfigKey === 'SHOP_NAME')?.ConfigValue ||
              'Premium Auto Body & Paint Center'}{' '}
            • Time Tracking Control System
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <Cloud className="w-3.5 h-3.5" />
              Firebase Cloud Live
            </span>
            {currentUser.Role === 'Admin' && (
              <button
                onClick={handleResetDatabase}
                className="text-red-600 hover:text-red-700 font-medium transition-colors cursor-pointer"
              >
                คืนค่าฐานข้อมูลมาตรฐาน
              </button>
            )}
            {currentUser.Role === 'Controller' && (
              <button
                onClick={() => {
                  setSettingsSubTab('CarParts');
                  setActiveTab('sheets');
                }}
                className="hover:text-slate-900 transition-colors cursor-pointer"
              >
                การตั้งค่า
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Change Password Modal for logged-in user */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <form
            onSubmit={handleChangePasswordSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">เปลี่ยนรหัสผ่านเข้าใช้งาน</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {currentUser.Name} ({currentUser.Username || currentUser.UserID})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                <span>{changePasswordError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  รหัสผ่านปัจจุบัน *
                </label>
                <input
                  type="password"
                  required
                  value={oldPasswordInput}
                  onChange={(e) => setOldPasswordInput(e.target.value)}
                  placeholder="ป้อนรหัสผ่านปัจจุบัน"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ตั้งรหัสผ่านใหม่ *
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="ป้อนรหัสผ่านใหม่"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ยืนยันรหัสผ่านใหม่ *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="ป้อนรหัสผ่านใหม่อีกครั้ง"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                ยืนยันเปลี่ยนรหัสผ่าน
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Database Confirmation Modal */}
      {showResetDbModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">รีเซ็ตคืนค่าฐานข้อมูลมาตรฐาน</h3>
                <p className="text-xs text-slate-500 font-medium">ล้างข้อมูลทั้งหมดเพื่อกลับสู่ค่าเริ่มต้นโรงงาน</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
              <p>คุณแน่ใจว่าต้องการล้างข้อมูลเพื่อเริ่มจากค่าเริ่มต้นของโรงงานใช่หรือไม่?</p>
              <p className="text-red-600 font-bold pt-1">
                ⚠️ ข้อมูลการเปิดใบงาน, บันทึกเวลา, และรายชื่อพนักงานที่เพิ่มใหม่จะถูกรีเซ็ต
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowResetDbModal(false)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeResetDatabase}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>ยืนยันล้างข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold max-w-md animate-slideIn">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
