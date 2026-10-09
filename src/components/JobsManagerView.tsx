import React, { useState, useEffect } from 'react';
import {
  SheetJob,
  SheetJobTask,
  SheetUser,
  ActiveTechSession,
  JobStatus,
  MasterSopStage,
  MasterDepartment,
} from '../types/shopFloor';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  X,
  Layers,
  Wrench,
  CheckSquare,
  Square,
  AlertCircle,
} from 'lucide-react';
import { formatClockFromSeconds } from './DashboardView';

export interface NewSubtaskFormItem {
  TaskName: string;
  AssignedTechs: string[];
  StartDate: string;
  DueDate: string;
  StandardMinutes: number;
  includedParts: string[]; // List of car parts checked for this specific subtask
}

interface JobsManagerViewProps {
  jobs: SheetJob[];
  jobTasks: SheetJobTask[];
  users: SheetUser[];
  activeSessions: ActiveTechSession[];
  nowMs: number;
  carParts: string[];
  masterSopStages: MasterSopStage[];
  departments: MasterDepartment[];
  isCreateModalOpen: boolean;
  onOpenCreateModal: () => void;
  onCloseCreateModal: () => void;
  onCreateJobWithTasks: (
    jobData: Omit<SheetJob, 'Status'>,
    subtasks: {
      TaskName: string;
      AssignedTechs: string[];
      StartDate: string;
      DueDate: string;
      StandardMinutes: number;
      PartsChecklist: string;
    }[]
  ) => void;
  onAddSubtaskToExistingJob: (
    jobId: string,
    subtask: {
      TaskName: string;
      AssignedTechs: string[];
      StartDate: string;
      DueDate: string;
      StandardMinutes: number;
      PartsChecklist: string;
    }
  ) => void;
  onDeleteJob: (jobId: string) => void;
  onEditJob: (job: SheetJob) => void;
  onClearAllJobs?: () => void;
}

export const JobsManagerView: React.FC<JobsManagerViewProps> = ({
  jobs,
  jobTasks,
  users,
  activeSessions,
  nowMs,
  carParts,
  masterSopStages,
  departments: _departments,
  isCreateModalOpen,
  onOpenCreateModal,
  onCloseCreateModal,
  onCreateJobWithTasks,
  onAddSubtaskToExistingJob: _onAddSubtaskToExistingJob,
  onDeleteJob,
  onEditJob,
  onClearAllJobs,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | JobStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Modal Popup state
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<SheetJob | null>(null);

  // Edit Job State
  const [editingJob, setEditingJob] = useState<SheetJob | null>(null);
  const [editFormError, setEditFormError] = useState('');

  // Confirm Delete Job modal state
  const [jobToDelete, setJobToDelete] = useState<SheetJob | null>(null);

  // Confirm Clear All Jobs modal state
  const [showClearAllJobsModal, setShowClearAllJobsModal] = useState(false);

  // Lock body scroll when any modal in JobsManagerView is active to prevent background scroll jumps
  useEffect(() => {
    const isAnyModalOpen =
      isCreateModalOpen ||
      !!selectedJobForDetail ||
      !!editingJob ||
      !!jobToDelete ||
      showClearAllJobsModal;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCreateModalOpen, selectedJobForDetail, editingJob, jobToDelete, showClearAllJobsModal]);

  const technicians = users.filter((u) => u.Role === 'Technician' && u.Status === 'Active');

  // Form state for Create Job Modal
  const [jobId, setJobId] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vin, setVin] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [jobType, setJobType] = useState('ทำสีเฉพาะจุด (Panel Paint)');
  const [jobDetails, setJobDetails] = useState('');
  
  // Default due date: 2 days from today
  const defaultDueDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [deliveryDate, setDeliveryDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');
  const [showAllTechsForSubtask, setShowAllTechsForSubtask] = useState<Record<number, boolean>>({});

  // Selected car parts for the entire job
  const [selectedParts, setSelectedParts] = useState<string[]>(['กันชนหน้า', 'ฝากระโปรงหน้า']);

  // Auto-generated subtasks based on Master SOP Stages from Settings
  const [subtasks, setSubtasks] = useState<NewSubtaskFormItem[]>([]);

  // Helper to build default subtasks from Master SOP Stages
  const buildInitialSubtasks = (parts: string[], targetDueDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (masterSopStages && masterSopStages.length > 0) {
      return masterSopStages.map((stage) => {
        // Find matching valid technicians
        const matchedTechs = stage.defaultTechEmails.filter((email) =>
          users.some((u) => u.Email.toLowerCase() === email.toLowerCase() && u.Status === 'Active')
        );

        let assigned: string[] = [];
        if (matchedTechs.length > 0) {
          assigned = matchedTechs;
        } else if (stage.department) {
          const deptTechs = technicians.filter((u) => u.Department === stage.department);
          if (deptTechs.length > 0) {
            assigned = [deptTechs[0].Email];
          }
        }
        if (assigned.length === 0 && technicians.length > 0) {
          assigned = [technicians[0].Email];
        }

        return {
          TaskName: stage.name,
          AssignedTechs: assigned,
          StartDate: today,
          DueDate: targetDueDate || defaultDueDate,
          StandardMinutes: stage.standardMinutes || 60,
          includedParts: [...parts], // All selected parts initially included
        };
      });
    }

    // Fallback default stages if master list is empty
    return [
      {
        TaskName: '1. รื้อถอดประกอบชิ้นส่วนตัวถัง',
        AssignedTechs: technicians.length > 0 ? [technicians[0].Email] : [],
        StartDate: today,
        DueDate: targetDueDate || defaultDueDate,
        StandardMinutes: 60,
        includedParts: [...parts],
      },
      {
        TaskName: '2. โป๊วสี / ขัดแห้งเตรียมพื้นผิว',
        AssignedTechs:
          technicians.length > 1
            ? [technicians[1].Email]
            : technicians.length > 0
            ? [technicians[0].Email]
            : [],
        StartDate: today,
        DueDate: targetDueDate || defaultDueDate,
        StandardMinutes: 90,
        includedParts: [...parts],
      },
      {
        TaskName: '3. พ่นสีจริง / พ่นเคลือบเงาแลคเกอร์ 2K',
        AssignedTechs:
          technicians.length > 2
            ? [technicians[2].Email]
            : technicians.length > 0
            ? [technicians[0].Email]
            : [],
        StartDate: today,
        DueDate: targetDueDate || defaultDueDate,
        StandardMinutes: 120,
        includedParts: [...parts],
      },
      {
        TaskName: '4. ขัดสี / ประกอบชิ้นส่วนตัวถังและ QC',
        AssignedTechs:
          technicians.length > 3
            ? [technicians[3].Email]
            : technicians.length > 0
            ? [technicians[0].Email]
            : [],
        StartDate: today,
        DueDate: targetDueDate || defaultDueDate,
        StandardMinutes: 60,
        includedParts: [...parts],
      },
    ];
  };

  // Re-initialize subtasks when the create modal is opened
  useEffect(() => {
    if (isCreateModalOpen) {
      const initialParts = carParts.length > 0 ? [carParts[0], carParts[1] || carParts[0]] : ['กันชนหน้า', 'ฝากระโปรงหน้า'];
      setSelectedParts(initialParts);
      const initialDueDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
      setDueDate(initialDueDate);
      setDeliveryDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
      setSubtasks(buildInitialSubtasks(initialParts, initialDueDate));
      setFormError('');
    }
  }, [isCreateModalOpen, masterSopStages]);

  // When dueDate changes in header, sync it to subtasks due dates
  const handleDueDateChange = (newDue: string) => {
    setDueDate(newDue);
    setSubtasks((prev) => prev.map((st) => ({ ...st, DueDate: newDue })));
  };

  // Toggle a car part for the whole job
  const handleToggleJobCarPart = (part: string) => {
    if (selectedParts.includes(part)) {
      // Removing part from job: also remove it from every subtask's includedParts
      const nextParts = selectedParts.filter((p) => p !== part);
      setSelectedParts(nextParts);
      setSubtasks((prev) =>
        prev.map((st) => ({
          ...st,
          includedParts: st.includedParts.filter((p) => p !== part),
        }))
      );
    } else {
      // Adding part to job: include it in all subtasks by default
      const nextParts = [...selectedParts, part];
      setSelectedParts(nextParts);
      setSubtasks((prev) =>
        prev.map((st) => ({
          ...st,
          includedParts: st.includedParts.includes(part) ? st.includedParts : [...st.includedParts, part],
        }))
      );
    }
  };

  // Toggle a specific part on or off inside an individual subtask
  const handleToggleSubtaskPart = (subtaskIndex: number, part: string) => {
    setSubtasks((prev) =>
      prev.map((st, idx) => {
        if (idx !== subtaskIndex) return st;
        const isIncluded = st.includedParts.includes(part);
        const nextIncluded = isIncluded
          ? st.includedParts.filter((p) => p !== part)
          : [...st.includedParts, part];
        return {
          ...st,
          includedParts: nextIncluded,
        };
      })
    );
  };

  // Toggle a technician's assignment on a subtask
  const handleToggleSubtaskTech = (subtaskIndex: number, techEmail: string) => {
    setSubtasks((prev) =>
      prev.map((st, idx) => {
        if (idx !== subtaskIndex) return st;
        const exists = st.AssignedTechs.includes(techEmail);
        const next = exists
          ? st.AssignedTechs.filter((e) => e !== techEmail)
          : [...st.AssignedTechs, techEmail];
        return { ...st, AssignedTechs: next };
      })
    );
  };

  // Add a new empty subtask row
  const handleAddSubtaskRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setSubtasks((prev) => [
      ...prev,
      {
        TaskName: `${prev.length + 1}. ขั้นตอนงานซ่อมเพิ่มเติม`,
        AssignedTechs: technicians.length > 0 ? [technicians[0].Email] : [],
        StartDate: today,
        DueDate: dueDate || defaultDueDate,
        StandardMinutes: 60,
        includedParts: [...selectedParts],
      },
    ]);
  };

  // Remove a subtask row
  const handleRemoveSubtaskRow = (index: number) => {
    setSubtasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Handle form submission
  const handleSubmitJobForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // 1. Validate Job ID (Controller keys in from core ERP)
    if (!jobId.trim()) {
      setFormError('กรุณากรอกเลขที่ JOB (จากระบบหลัก)');
      return;
    }

    const isDuplicate = jobs.some(
      (j) => j.JobID.trim().toLowerCase() === jobId.trim().toLowerCase()
    );
    if (isDuplicate) {
      setFormError(`เลขที่ JOB "${jobId.trim()}" มีอยู่ในระบบแล้ว กรุณาตรวจสอบอีกครั้ง`);
      return;
    }

    // 2. Lock: Must provide LicensePlate OR VIN
    if (!licensePlate.trim() && !vin.trim()) {
      setFormError("กรุณาระบุ 'ทะเบียนรถ' หรือ 'เลขตัวถัง (VIN)' อย่างใดอย่างหนึ่ง (จำเป็นต้องมีข้อมูลระบุตัวรถอย่างน้อย 1 อย่าง)");
      return;
    }

    // 3. Due Date & Delivery Date are required
    if (!dueDate) {
      setFormError('กรุณาระบุวันกำหนดรถเสร็จ (Target Finish Date)');
      return;
    }
    if (!deliveryDate) {
      setFormError('กรุณาระบุวันกำหนดส่งมอบรถลูกค้า (Delivery Date)');
      return;
    }

    // 4. Must select at least 1 car part
    if (selectedParts.length === 0) {
      setFormError('กรุณาเลือกชิ้นส่วนตัวถังที่จะซ่อมทำสีอย่างน้อย 1 ชิ้น');
      return;
    }

    // 5. Must have at least 1 subtask
    const validSubtasks = subtasks.filter((t) => t.TaskName.trim() !== '');
    if (validSubtasks.length === 0) {
      setFormError('กรุณาระบุขั้นตอนย่อยอย่างน้อย 1 ขั้นตอน');
      return;
    }

    // 6. Each subtask must have at least 1 assigned technician
    const missingTech = validSubtasks.some((t) => t.AssignedTechs.length === 0);
    if (missingTech) {
      setFormError('กรุณาเลือกช่างผู้รับผิดชอบอย่างน้อย 1 คนในทุกขั้นตอนย่อย');
      return;
    }

    // Build subtasks payload with formatted checklist based on includedParts
    const formattedSubtasks = validSubtasks.map((st) => {
      // Only include parts that Controller kept checked for this specific subtask!
      const checklistString = st.includedParts.map((part) => `${part}:todo`).join(',');
      return {
        TaskName: st.TaskName.trim(),
        AssignedTechs: st.AssignedTechs,
        StartDate: st.StartDate || new Date().toISOString().split('T')[0],
        DueDate: st.DueDate || dueDate,
        StandardMinutes: st.StandardMinutes > 0 ? st.StandardMinutes : 60,
        PartsChecklist: checklistString,
      };
    });

    onCreateJobWithTasks(
      {
        JobID: jobId.trim(),
        LicensePlate: licensePlate.trim() || '-',
        VIN: vin.trim() || '-',
        CustomerName: customerName.trim() || '-', // Customer name is optional!
        JobType: jobType.trim() || 'ทำสีตัวถัง SOP',
        JobDetails:
          jobDetails.trim() ||
          `ทำสีชิ้นส่วน: ${selectedParts.join(', ')} (${selectedParts.length} ชิ้น)`,
        DueDate: dueDate,
        DeliveryDate: deliveryDate,
      },
      formattedSubtasks
    );

    // Reset fields & close
    setJobId('');
    setLicensePlate('');
    setVin('');
    setCustomerName('');
    setJobDetails('');
    onCloseCreateModal();
  };

  // Handle Edit Job modal submit
  const handleUpdateJobDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');
    if (editingJob) {
      if (!editingJob.LicensePlate.trim() && !editingJob.VIN.trim()) {
        setEditFormError("กรุณาระบุ 'ทะเบียนรถ' หรือ 'เลขตัวถัง (VIN)' อย่างใดอย่างหนึ่ง");
        return;
      }
      onEditJob(editingJob);
      setEditingJob(null);
    }
  };

  // Filter jobs by status & search
  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== 'ALL' && job.Status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.JobID.toLowerCase().includes(q) ||
      job.LicensePlate.toLowerCase().includes(q) ||
      job.VIN.toLowerCase().includes(q) ||
      job.CustomerName.toLowerCase().includes(q) ||
      job.JobType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-blue-600 tracking-wider">
            Controller Board
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            สรุปใบงาน (Jobs Board)
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {jobs.length > 0 && onClearAllJobs && (
            <button
              onClick={() => setShowClearAllJobsModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="ล้างใบงานทั้งหมดเพื่อเริ่มใช้งานจริง"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ล้างใบงานทั้งหมด ({jobs.length})
            </button>
          )}
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            เปิดใบงาน
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          {(['ALL', 'Open', 'In Progress', 'Paused', 'Completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'ALL' ? `ใบงานทั้งหมด (${jobs.length})` : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาทะเบียน, VIN, ลูกค้า, รหัส Job..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-medium"
          />
        </div>
      </div>

      {/* HIGH-DENSITY SPREADSHEET TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 font-semibold border-b border-slate-800">
                <th className="py-3 px-3.5 whitespace-nowrap">เลขที่ JOB</th>
                <th className="py-3 px-3.5 whitespace-nowrap">ทะเบียนรถ</th>
                <th className="py-3 px-3.5 whitespace-nowrap">เลขตัวถัง (VIN)</th>
                <th className="py-3 px-3.5 whitespace-nowrap">ลูกค้า</th>
                <th className="py-3 px-3.5 whitespace-nowrap">ประเภทงานซ่อม</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-center">กำหนดเสร็จ (อู่)</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-center">กำหนดส่งมอบ (SA)</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-center">สถานะ</th>
                <th className="py-3 px-3.5 whitespace-nowrap">ความคืบหน้า</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลใบงานตรงกับเงื่อนไขค้นหา
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const tasksForJob = jobTasks.filter((t) => t.JobID === job.JobID);
                  const totalTasks = tasksForJob.length;
                  const completedTasks = tasksForJob.filter((t) => t.Status === 'Completed').length;
                  const inProgressTasks = tasksForJob.filter((t) => t.Status === 'In Progress').length;
                  const pausedTasks = tasksForJob.filter((t) => t.Status === 'Paused').length;

                  const isJobActive = tasksForJob.some((t) =>
                    activeSessions.some((s) => s.TaskID === t.TaskID)
                  );

                  return (
                    <tr
                      key={job.JobID}
                      onClick={() => setSelectedJobForDetail(job)}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                        isJobActive ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-blue-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isJobActive && (
                            <span
                              className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                              title="กำลังมีช่างจับเวลาทำสีอยู่ในขณะนี้"
                            ></span>
                          )}
                          <span>{job.JobID}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                        {job.LicensePlate || '-'}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                        {job.VIN || '-'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-800 whitespace-nowrap max-w-[140px] truncate">
                        {job.CustomerName || '-'}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{job.JobType}</span>
                        {job.JobDetails && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-[200px]">
                            {job.JobDetails}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap text-amber-900 font-semibold">
                        <span className="bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                          {job.DueDate || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono whitespace-nowrap text-blue-900 font-semibold">
                        <span className="bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                          {job.DeliveryDate || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            job.Status === 'Completed'
                              ? 'bg-blue-100 text-blue-800'
                              : job.Status === 'In Progress'
                              ? 'bg-emerald-100 text-emerald-800'
                              : job.Status === 'Paused'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {job.Status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                completedTasks === totalTasks && totalTasks > 0
                                  ? 'bg-blue-600'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-[11px] font-mono text-slate-600">
                            {completedTasks}/{totalTasks}
                          </span>
                          {inProgressTasks > 0 && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                              ทำอยู่ {inProgressTasks}
                            </span>
                          )}
                          {pausedTasks > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">
                              พัก {pausedTasks}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-3 px-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingJob(job)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="แก้ไขข้อมูลใบงาน"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setJobToDelete(job)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="ลบใบงานนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP: JOB DETAIL MODAL */}
      {selectedJobForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="shrink-0 flex items-start justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-sm">
                  รายละเอียดใบงานซ่อมสี (Job Sheet Detail)
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {selectedJobForDetail.JobID} — {selectedJobForDetail.LicensePlate}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  VIN: {selectedJobForDetail.VIN} · ลูกค้า: {selectedJobForDetail.CustomerName} · กำหนดเสร็จ (อู่): {selectedJobForDetail.DueDate} · กำหนดส่งมอบ (SA): {selectedJobForDetail.DeliveryDate || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobForDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
                <span className="font-bold text-slate-900 block">รายละเอียดความเสียหาย / จุดซ่อม:</span>
                <p className="text-slate-600">{selectedJobForDetail.JobDetails || '-'}</p>
              </div>

              {/* List of subtasks for this job */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  ขั้นตอนงานย่อยและชิ้นงานที่ต้องทำ ({jobTasks.filter((t) => t.JobID === selectedJobForDetail.JobID).length} ขั้นตอน):
                </h3>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-2.5 px-3">ขั้นตอน (TaskName)</th>
                        <th className="py-2.5 px-3">ช่างผู้รับผิดชอบ</th>
                        <th className="py-2.5 px-3">ชิ้นส่วน (Checklist)</th>
                        <th className="py-2.5 px-3 text-center">สถานะ</th>
                        <th className="py-2.5 px-3 text-right">เวลาจริง / SLA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {jobTasks
                        .filter((t) => t.JobID === selectedJobForDetail.JobID)
                        .map((task) => {
                          const isRunning = activeSessions.some((s) => s.TaskID === task.TaskID);
                          const parts = task.PartsChecklist
                            ? task.PartsChecklist.split(',').map((p) => {
                                const [name, state] = p.split(':');
                                return { name, done: state === 'done' };
                              })
                            : [];

                          return (
                            <tr
                              key={task.TaskID}
                              className={isRunning ? 'bg-emerald-50/50 font-semibold' : ''}
                            >
                              <td className="py-3 px-3">
                                <span className="font-bold text-slate-900 block">{task.TaskName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {task.TaskID}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-slate-700 text-[11px] block max-w-[130px] truncate">
                                  {task.AssignedTechs || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                {parts.length === 0 ? (
                                  <span className="text-[10px] text-slate-400">ทุกชิ้นส่วนตามใบงาน</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {parts.map((p, idx) => (
                                      <span
                                        key={idx}
                                        className={`text-[9px] px-1.5 py-0.5 rounded ${
                                          p.done
                                            ? 'bg-blue-100 text-blue-800 font-bold'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {p.name} {p.done ? '✓' : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    task.Status === 'Completed'
                                      ? 'bg-blue-100 text-blue-800'
                                      : task.Status === 'In Progress'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : task.Status === 'Paused'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {task.Status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                {task.TotalMinutes} / {task.StandardMinutes} น.
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 flex justify-end gap-2 border-t border-slate-200 px-6 py-3.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedJobForDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT JOB DIALOG */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-fadeIn">
          <form
            onSubmit={handleUpdateJobDetails}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
          >
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-900">แก้ไขข้อมูลใบงานหลัก {editingJob.JobID}</h3>
              {editFormError && (
                <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{editFormError}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ทะเบียนรถ (ระบุทะเบียน หรือ VIN อย่างใดอย่างหนึ่ง)
                </label>
                <input
                  type="text"
                  value={editingJob.LicensePlate}
                  onChange={(e) => setEditingJob({ ...editingJob, LicensePlate: e.target.value })}
                  placeholder="เช่น 3กข 8842 กทม."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  เลขตัวถัง VIN (ระบุทะเบียน หรือ VIN อย่างใดอย่างหนึ่ง)
                </label>
                <input
                  type="text"
                  value={editingJob.VIN}
                  onChange={(e) => setEditingJob({ ...editingJob, VIN: e.target.value })}
                  placeholder="เช่น MR053BK4007128941"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อลูกค้า (ไม่บังคับระบุ)
                </label>
                <input
                  type="text"
                  value={editingJob.CustomerName}
                  onChange={(e) => setEditingJob({ ...editingJob, CustomerName: e.target.value })}
                  placeholder="ระบุชื่อลูกค้าหรือประกันภัย (ถ้ามี)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ประเภทงานซ่อมสี</label>
                <input
                  type="text"
                  value={editingJob.JobType}
                  onChange={(e) => setEditingJob({ ...editingJob, JobType: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  วันกำหนดรถเสร็จ (เป้าหมายอู่สี) *
                </label>
                <input
                  type="date"
                  required
                  value={editingJob.DueDate}
                  onChange={(e) => setEditingJob({ ...editingJob, DueDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  กำหนดส่งมอบรถ (SA นัดลูกค้า) *
                </label>
                <input
                  type="date"
                  required
                  value={editingJob.DeliveryDate || ''}
                  onChange={(e) => setEditingJob({ ...editingJob, DeliveryDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">รายละเอียดอาการ/จุดซ่อม</label>
                <input
                  type="text"
                  value={editingJob.JobDetails}
                  onChange={(e) => setEditingJob({ ...editingJob, JobDetails: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t border-slate-200 px-6 py-3.5 bg-slate-50/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE JOB & SPLIT SUBTASKS MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fadeIn">
          <form
            onSubmit={handleSubmitJobForm}
            className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-blue-600" />
                  เปิดใบงาน (Create Paint Job & Tasks)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ระบบจะสร้างขั้นตอนย่อยและเชื่อมโยงช่างตามที่ตั้งค่าไว้ให้อัตโนมัติ โดย Controller สามารถติ๊กเลือกชิ้นส่วนของแต่ละขั้นตอนออกได้ทันที
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseCreateModal}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {/* Vehicle & Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                {/* 1. เลขที่ JOB (จากระบบหลัก) - Controller คีย์เอง */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    เลขที่ JOB (จากระบบหลัก) *
                  </label>
                  <input
                    type="text"
                    required
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    placeholder="เช่น JOB-2610-004 หรือเลข ERP"
                    className="w-full border border-blue-400 bg-white rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-700 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Controller คีย์เลขที่ใบสั่งซ่อมจากระบบหลัก
                  </span>
                </div>

                {/* 2. ทะเบียนรถ (หรือ VIN) */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    ทะเบียนรถ (หรือใส่ VIN)
                  </label>
                  <input
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="เช่น 3กข 8842 กทม."
                    className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 font-semibold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    ต้องระบุทะเบียนหรือ VIN อย่างใดอย่างหนึ่ง
                  </span>
                </div>

                {/* 3. เลขตัวถัง VIN */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    เลขตัวถัง (VIN)
                  </label>
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value)}
                    placeholder="ระบุเลขแชสซี 17 หลัก (ถ้ามี)"
                    className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    กรณีไม่มีป้ายทะเบียน ให้ใส่ VIN
                  </span>
                </div>

                {/* 4. วันกำหนดรถเสร็จ (Controller กำหนด) */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    วันกำหนดรถเสร็จ (เป้าหมายอู่สี) *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    className="w-full border border-amber-300 bg-amber-50/40 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-900 focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-[10px] text-amber-700 font-medium mt-0.5 block">
                    วันที่รถต้องซ่อมและ QC เสร็จสมบูรณ์
                  </span>
                </div>

                {/* 5. กำหนดส่งมอบรถ (SA นัดลูกค้า) */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    กำหนดส่งมอบรถ (SA นัดลูกค้า) *
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full border border-blue-300 bg-blue-50/40 rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-900 focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-[10px] text-blue-700 font-medium mt-0.5 block">
                    วันที่ SA นัดหมายแจ้งลูกค้าให้มารับรถ
                  </span>
                </div>


                {/* 6. ประเภทงานซ่อมสี */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ประเภทงานซ่อมสี (JobType)
                  </label>
                  <input
                    type="text"
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รายละเอียดเพิ่มเติม / สีรถ / อาการ
                  </label>
                  <input
                    type="text"
                    value={jobDetails}
                    onChange={(e) => setJobDetails(e.target.value)}
                    placeholder="ระบุรหัสเบอร์สี หรือรายละเอียดเพิ่มเติมของรถคันนี้..."
                    className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* 1. SELECT CAR PARTS */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      1. ติ๊กเลือกชิ้นส่วนตัวถังรถยนต์ที่จะซ่อมทำสี
                    </h3>
                    <p className="text-xs text-slate-500">
                      รายการชิ้นส่วนตัวถังนี้ถูกซิงค์มาจากหน้าการตั้งค่า คุณสามารถเลือกชิ้นส่วนที่ต้องทำสีสำหรับรถคันนี้
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 self-start sm:self-center">
                    เลือกแล้ว {selectedParts.length} ชิ้น
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {carParts.map((part) => {
                    const isSelected = selectedParts.includes(part);
                    return (
                      <button
                        key={part}
                        type="button"
                        onClick={() => handleToggleJobCarPart(part)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {part} {isSelected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
                {selectedParts.length === 0 && (
                  <p className="text-xs text-red-600 font-semibold">
                    * กรุณาคลิกเลือกชิ้นส่วนตัวถังอย่างน้อย 1 ชิ้น
                  </p>
                )}
              </div>

              {/* 2. AUTOMATIC SUBTASKS WITH PART-EXCLUSION TOGGLE FOR CONTROLLER */}
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-emerald-600" />
                      2. รายการขั้นตอนย่อย (Tasks) และชิ้นงานที่ต้องทำในแต่ละขั้นตอน
                    </h3>
                    <p className="text-xs text-slate-500">
                      ระบบดึงขั้นตอนและเชื่อมโยงช่างตามที่ Set ไว้ใน "การตั้งค่า" ให้อัตโนมัติ — Controller สามารถ <span className="font-semibold text-slate-900">"คลิกติ๊กออก"</span> เพื่อข้ามชิ้นงานที่ไม่ต้องทำในขั้นตอนนี้ได้
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSubtaskRow}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors whitespace-nowrap self-start sm:self-center cursor-pointer shadow-xs"
                  >
                    + เพิ่มขั้นตอนเอง
                  </button>
                </div>

                {/* Subtask list */}
                <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                  {subtasks.map((st, sIdx) => {
                    const matchedStage = masterSopStages.find((s) => s.name === st.TaskName);
                    const stageDept = matchedStage?.department;
                    const deptTechs = stageDept ? technicians.filter((t) => t.Department === stageDept) : [];
                    const showAll = showAllTechsForSubtask[sIdx];
                    const shouldFilterByDept = stageDept && deptTechs.length > 0 && !showAll;
                    const availableTechs = shouldFilterByDept ? deptTechs : technicians;

                    return (
                      <div
                        key={sIdx}
                        className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3 transition-colors hover:border-slate-300"
                      >
                        {/* Subtask Header Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          <div className="sm:col-span-5">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              ขั้นตอนที่ {sIdx + 1} (ชื่อขั้นตอนงานซ่อม) *
                            </label>
                            
                            {/* Task Selection Dropdown */}
                            <select
                              value={matchedStage ? matchedStage.name : 'OTHER'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'OTHER') {
                                  setSubtasks((prev) =>
                                    prev.map((item, i) =>
                                      i === sIdx ? { ...item, TaskName: 'งานซ่อมเพิ่มเติม (อื่นๆ)' } : item
                                    )
                                  );
                                } else {
                                  const selectedStage = masterSopStages.find((s) => s.name === val);
                                  if (selectedStage) {
                                    const matchedTechs = selectedStage.defaultTechEmails.filter((email) =>
                                      users.some((u) => u.Email.toLowerCase() === email.toLowerCase() && u.Status === 'Active')
                                    );
                                    let assignedTechs: string[] = [];
                                    if (matchedTechs.length > 0) {
                                      assignedTechs = matchedTechs;
                                    } else if (selectedStage.department) {
                                      const dTechs = technicians.filter((t) => t.Department === selectedStage.department);
                                      if (dTechs.length > 0) assignedTechs = [dTechs[0].Email];
                                    }
                                    if (assignedTechs.length === 0 && technicians.length > 0) {
                                      assignedTechs = [technicians[0].Email];
                                    }

                                    setSubtasks((prev) =>
                                      prev.map((item, i) =>
                                        i === sIdx
                                          ? {
                                              ...item,
                                              TaskName: selectedStage.name,
                                              StandardMinutes: selectedStage.standardMinutes || 60,
                                              AssignedTechs: assignedTechs,
                                            }
                                          : item
                                      )
                                    );
                                  }
                                }
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-950 focus:outline-none focus:border-blue-600 cursor-pointer"
                            >
                              {masterSopStages.map((stage) => (
                                <option key={stage.id} value={stage.name}>
                                  {stage.name} {stage.department ? `(${stage.department.replace('แผนก', '').trim()})` : ''}
                                </option>
                              ))}
                              <option value="OTHER">➕ อื่นๆ (พิมพ์กำหนดขั้นตอนเอง...)</option>
                            </select>

                            {/* Free text input if OTHER or unmatched stage */}
                            {(!matchedStage || st.TaskName.includes('อื่นๆ')) && (
                              <input
                                type="text"
                                value={st.TaskName}
                                onChange={(e) =>
                                  setSubtasks((prev) =>
                                    prev.map((item, i) =>
                                      i === sIdx ? { ...item, TaskName: e.target.value } : item
                                    )
                                  )
                                }
                                placeholder="พิมพ์ระบุชื่อขั้นตอนงานซ่อมเพิ่มเติม..."
                                className="w-full mt-1.5 bg-amber-50/60 border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                              />
                            )}
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              วันเริ่ม
                            </label>
                            <input
                              type="date"
                              value={st.StartDate}
                              onChange={(e) =>
                                setSubtasks((prev) =>
                                  prev.map((item, i) =>
                                    i === sIdx ? { ...item, StartDate: e.target.value } : item
                                  )
                                )
                              }
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              กำหนดเสร็จ (Task)
                            </label>
                            <input
                              type="date"
                              value={st.DueDate}
                              onChange={(e) =>
                                setSubtasks((prev) =>
                                  prev.map((item, i) =>
                                    i === sIdx ? { ...item, DueDate: e.target.value } : item
                                  )
                                )
                              }
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-900 bg-amber-50/30 border-amber-200"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              เวลามาตรฐาน (SLA นาที)
                            </label>
                            <input
                              type="number"
                              min={5}
                              value={st.StandardMinutes}
                              onChange={(e) =>
                                setSubtasks((prev) =>
                                  prev.map((item, i) =>
                                    i === sIdx
                                      ? { ...item, StandardMinutes: Number(e.target.value) }
                                      : item
                                  )
                                )
                              }
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                            />
                          </div>
                          <div className="sm:col-span-1 flex justify-end pt-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveSubtaskRow(sIdx)}
                              disabled={subtasks.length <= 1}
                              className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                              title="ลบขั้นตอนย่อยนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* PART EXCLUSION CHIPS (Controller can uncheck parts for this task!) */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200/90 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span>ชิ้นงานที่ต้องทำในขั้นตอนนี้:</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                (ติ๊กออกสำหรับชิ้นที่ไม่ต้องทำในขั้นตอนนี้)
                              </span>
                            </span>
                            <span className="text-[10px] font-mono font-semibold text-slate-500">
                              ทำ {st.includedParts.length}/{selectedParts.length} ชิ้น
                            </span>
                          </div>

                          {selectedParts.length === 0 ? (
                            <div className="text-[11px] text-slate-400">ยังไม่ได้เลือกชิ้นส่วนในหัวข้อที่ 1</div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {selectedParts.map((part) => {
                                const isIncluded = st.includedParts.includes(part);
                                return (
                                  <button
                                    key={part}
                                    type="button"
                                    onClick={() => handleToggleSubtaskPart(sIdx, part)}
                                    title={
                                      isIncluded
                                        ? `คลิกเพื่อติ๊กออก (ไม่ต้องทำชิ้น ${part} ในขั้นตอนนี้)`
                                        : `คลิกเพื่อเลือกทำชิ้น ${part} ในขั้นตอนนี้`
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                      isIncluded
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 line-through hover:bg-slate-200 hover:text-slate-600'
                                    }`}
                                  >
                                    {isIncluded ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    )}
                                    <span>{part}</span>
                                    {!isIncluded && (
                                      <span className="text-[9px] text-slate-400 no-underline font-normal">
                                        (ข้าม)
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {st.includedParts.length === 0 && (
                            <p className="text-[10px] text-amber-600 font-semibold pt-0.5">
                              ⚠️ ขั้นตอนนี้ไม่มีชิ้นส่วนที่เลือกทำเลย (จะถือว่าข้ามขั้นตอนนี้หรือทำภาพรวม)
                            </p>
                          )}
                        </div>

                        {/* Multi-Select Technicians for this task */}
                        <div className="space-y-1 pt-0.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                              <span>ช่างที่เชื่อมโยงในขั้นตอนนี้:</span>
                              {stageDept && (
                                <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px]">
                                  📍 ประจำ{stageDept}
                                </span>
                              )}
                            </div>
                            {stageDept && deptTechs.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllTechsForSubtask((prev) => ({
                                    ...prev,
                                    [sIdx]: !prev[sIdx],
                                  }))
                                }
                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer"
                              >
                                {shouldFilterByDept ? 'แสดงช่างทุกแผนก' : 'กรองเฉพาะช่างในแผนกนี้'}
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {availableTechs.map((tech) => {
                              const checked = st.AssignedTechs.includes(tech.Email);
                              const deptLabel = (tech.Department || '').replace('แผนก', '').split(' & ')[0] || 'ช่าง';
                              return (
                                <button
                                  key={tech.UserID}
                                  type="button"
                                  onClick={() => handleToggleSubtaskTech(sIdx, tech.Email)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] cursor-pointer transition-colors ${
                                    checked
                                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {checked ? (
                                    <CheckSquare className="w-3 h-3 text-white shrink-0" />
                                  ) : (
                                    <Square className="w-3 h-3 text-slate-400 shrink-0" />
                                  )}
                                  <span>{tech.Nickname || tech.Name}</span>
                                  <span className={`text-[9px] font-normal ${checked ? 'text-blue-100' : 'text-slate-500'}`}>
                                    ({deptLabel})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50/50">
              <button
                type="button"
                onClick={onCloseCreateModal}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={selectedParts.length === 0}
                className={`px-5 py-2.5 text-xs font-bold rounded-lg transition-colors text-white cursor-pointer ${
                  selectedParts.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-xs'
                }`}
              >
                บันทึกเปิดใบงานซ่อมสี & ส่งต่องานย่อย
              </button>
            </div>
          </form>
        </div>
      )}
      {/* CONFIRM DELETE JOB MODAL */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบใบงานซ่อมสี</h3>
                <p className="text-xs text-slate-500 font-medium">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900">
                ใบงาน: <span className="font-mono text-blue-600">{jobToDelete.JobID}</span>
              </div>
              <div>ทะเบียน: <span className="font-bold text-slate-900">{jobToDelete.LicensePlate}</span> (VIN: {jobToDelete.VIN})</div>
              <div className="text-red-600 font-medium pt-1">
                ⚠️ การลบใบงานนี้ จะทำการถอนรายการขั้นตอนย่อย (Tasks) และบันทึกเวลาทั้งหมดของใบงานนี้ออกจากฐานข้อมูลโดยสมบูรณ์
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteJob(jobToDelete.JobID);
                  setJobToDelete(null);
                }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบใบงาน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR ALL JOBS MODAL */}
      {showClearAllJobsModal && onClearAllJobs && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  ยืนยันล้างใบงานทั้งหมด ({jobs.length} ใบงาน)
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  คุณต้องการล้างใบงานซ่อมสีและขั้นตอนงานย่อยทั้งหมดออกใช่หรือไม่? ข้อมูลใบงานและขั้นตอนงานตัวอย่างทั้งหมดจะถูกลบออกเพื่อเตรียมระบบให้คลีนพร้อมเริ่มบันทึกงานจริง
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowClearAllJobsModal(false)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllJobs();
                  setShowClearAllJobsModal(false);
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันล้างใบงานทั้งหมด</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
