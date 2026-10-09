import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  SheetUser,
  SheetJob,
  SheetJobTask,
  SheetTimeLog,
  SheetWorkCalendar,
  SheetSetting,
  MasterSopStage,
  MasterDepartment,
  TechLeave,
} from '../types/shopFloor';
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
} from '../data/initialSheetsData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

// Seed initial workshop data if collections are empty
export async function seedInitialDataIfEmpty() {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('Seeding initial workshop database to Firestore...');
      const batch = writeBatch(db);

      INITIAL_USERS.forEach((user) => {
        batch.set(doc(db, 'users', user.UserID), user);
      });

      INITIAL_JOBS.forEach((job) => {
        batch.set(doc(db, 'jobs', job.JobID), job);
      });

      INITIAL_JOB_TASKS.forEach((task) => {
        batch.set(doc(db, 'jobTasks', task.TaskID), task);
      });

      INITIAL_WORK_CALENDAR.forEach((cal) => {
        batch.set(doc(db, 'workCalendar', cal.Date), cal);
      });

      INITIAL_SETTINGS.forEach((st) => {
        batch.set(doc(db, 'settings', st.ConfigKey), st);
      });

      CAR_PARTS_LIST.forEach((part, idx) => {
        batch.set(doc(db, 'carParts', `PART-${String(idx + 1).padStart(2, '0')}`), {
          id: `PART-${String(idx + 1).padStart(2, '0')}`,
          name: part,
        });
      });

      INITIAL_MASTER_SOP_STAGES.forEach((stage) => {
        batch.set(doc(db, 'masterSopStages', stage.id), stage);
      });

      INITIAL_TECH_LEAVES.forEach((leave) => {
        batch.set(doc(db, 'techLeaves', leave.LeaveID), leave);
      });

      INITIAL_DEPARTMENTS.forEach((dept) => {
        batch.set(doc(db, 'departments', dept.id), dept);
      });

      await batch.commit();
      console.log('Initial workshop database seeded successfully!');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'bootstrap_seeding');
  }
}

// Firestore Real-Time Subscribe Callbacks
export interface WorkshopFirestoreSubscribers {
  onUsersChange: (users: SheetUser[]) => void;
  onJobsChange: (jobs: SheetJob[]) => void;
  onTasksChange: (tasks: SheetJobTask[]) => void;
  onTimeLogsChange: (logs: SheetTimeLog[]) => void;
  onCalendarChange: (calendar: SheetWorkCalendar[]) => void;
  onSettingsChange: (settings: SheetSetting[]) => void;
  onCarPartsChange: (parts: string[]) => void;
  onStagesChange: (stages: MasterSopStage[]) => void;
  onLeavesChange: (leaves: TechLeave[]) => void;
  onDepartmentsChange: (departments: MasterDepartment[]) => void;
  onConnectionStatus?: (isConnected: boolean) => void;
}

export function subscribeToWorkshopData(callbacks: WorkshopFirestoreSubscribers) {
  const unsubscribers: (() => void)[] = [];

  // 1. Users
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users'),
      (snap) => {
        callbacks.onConnectionStatus?.(true);
        if (!snap.empty) {
          const list: SheetUser[] = [];
          snap.forEach((d) => list.push(d.data() as SheetUser));
          callbacks.onUsersChange(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'users')
    )
  );

  // 2. Jobs
  unsubscribers.push(
    onSnapshot(
      collection(db, 'jobs'),
      (snap) => {
        if (!snap.empty) {
          const list: SheetJob[] = [];
          snap.forEach((d) => list.push(d.data() as SheetJob));
          callbacks.onJobsChange(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'jobs')
    )
  );

  // 3. Job Tasks
  unsubscribers.push(
    onSnapshot(
      collection(db, 'jobTasks'),
      (snap) => {
        if (!snap.empty) {
          const list: SheetJobTask[] = [];
          snap.forEach((d) => list.push(d.data() as SheetJobTask));
          callbacks.onTasksChange(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'jobTasks')
    )
  );

  // 4. Time Logs
  unsubscribers.push(
    onSnapshot(
      collection(db, 'timeLogs'),
      (snap) => {
        const list: SheetTimeLog[] = [];
        snap.forEach((d) => list.push(d.data() as SheetTimeLog));
        callbacks.onTimeLogsChange(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'timeLogs')
    )
  );

  // 5. Work Calendar
  unsubscribers.push(
    onSnapshot(
      collection(db, 'workCalendar'),
      (snap) => {
        if (!snap.empty) {
          const list: SheetWorkCalendar[] = [];
          snap.forEach((d) => list.push(d.data() as SheetWorkCalendar));
          callbacks.onCalendarChange(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'workCalendar')
    )
  );

  // 6. Settings
  unsubscribers.push(
    onSnapshot(
      collection(db, 'settings'),
      (snap) => {
        if (!snap.empty) {
          const list: SheetSetting[] = [];
          snap.forEach((d) => list.push(d.data() as SheetSetting));
          callbacks.onSettingsChange(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings')
    )
  );

  // 7. Car Parts
  unsubscribers.push(
    onSnapshot(
      collection(db, 'carParts'),
      (snap) => {
        if (!snap.empty) {
          const parts: string[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data.name) parts.push(data.name);
          });
          if (parts.length > 0) callbacks.onCarPartsChange(parts);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'carParts')
    )
  );

  // 8. Master SOP Stages
  unsubscribers.push(
    onSnapshot(
      collection(db, 'masterSopStages'),
      (snap) => {
        if (!snap.empty) {
          const list: MasterSopStage[] = [];
          snap.forEach((d) => list.push(d.data() as MasterSopStage));
          list.sort((a, b) => a.stepNumber - b.stepNumber);
          callbacks.onStagesChange(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'masterSopStages')
    )
  );

  // 9. Tech Leaves
  unsubscribers.push(
    onSnapshot(
      collection(db, 'techLeaves'),
      (snap) => {
        const list: TechLeave[] = [];
        snap.forEach((d) => list.push(d.data() as TechLeave));
        callbacks.onLeavesChange(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'techLeaves')
    )
  );

  // 10. Departments
  unsubscribers.push(
    onSnapshot(
      collection(db, 'departments'),
      (snap) => {
        if (!snap.empty) {
          const list: MasterDepartment[] = [];
          snap.forEach((d) => list.push(d.data() as MasterDepartment));
          list.sort((a, b) => a.id.localeCompare(b.id));
          callbacks.onDepartmentsChange(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'departments')
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// Direct mutation operations to Firestore
export async function saveUserToFirestore(user: SheetUser) {
  try {
    await setDoc(doc(db, 'users', user.UserID), user);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.UserID}`);
    throw error;
  }
}

export async function deleteUserFromFirestore(userId: string) {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    throw error;
  }
}

export async function saveJobToFirestore(job: SheetJob) {
  try {
    await setDoc(doc(db, 'jobs', job.JobID), job);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jobs/${job.JobID}`);
    throw error;
  }
}

export async function deleteJobFromFirestore(jobId: string) {
  try {
    await deleteDoc(doc(db, 'jobs', jobId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `jobs/${jobId}`);
    throw error;
  }
}

export async function saveJobTaskToFirestore(task: SheetJobTask) {
  try {
    await setDoc(doc(db, 'jobTasks', task.TaskID), task);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jobTasks/${task.TaskID}`);
    throw error;
  }
}

export async function deleteJobTaskFromFirestore(taskId: string) {
  try {
    await deleteDoc(doc(db, 'jobTasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `jobTasks/${taskId}`);
    throw error;
  }
}

export async function saveTimeLogToFirestore(log: SheetTimeLog) {
  try {
    await setDoc(doc(db, 'timeLogs', log.LogID), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `timeLogs/${log.LogID}`);
    throw error;
  }
}

export async function clearAllTimeLogsFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'timeLogs'));
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'timeLogs');
    throw error;
  }
}

export async function saveWorkCalendarToFirestore(calendar: SheetWorkCalendar[]) {
  try {
    const batch = writeBatch(db);
    calendar.forEach((cal) => {
      batch.set(doc(db, 'workCalendar', cal.Date), cal);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'workCalendar');
    throw error;
  }
}

export async function saveTechLeavesToFirestore(leaves: TechLeave[]) {
  try {
    const batch = writeBatch(db);
    leaves.forEach((l) => {
      batch.set(doc(db, 'techLeaves', l.LeaveID), l);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'techLeaves');
    throw error;
  }
}

export async function deleteTechLeaveFromFirestore(leaveId: string) {
  try {
    await deleteDoc(doc(db, 'techLeaves', leaveId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `techLeaves/${leaveId}`);
    throw error;
  }
}

export async function saveSettingsToFirestore(settings: SheetSetting[]) {
  try {
    const batch = writeBatch(db);
    settings.forEach((s) => {
      batch.set(doc(db, 'settings', s.ConfigKey), s);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings');
    throw error;
  }
}

export async function saveCarPartsToFirestore(carParts: string[]) {
  try {
    const batch = writeBatch(db);
    // Clear and re-populate
    carParts.forEach((part, idx) => {
      const partId = `PART-${String(idx + 1).padStart(2, '0')}`;
      batch.set(doc(db, 'carParts', partId), { id: partId, name: part });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'carParts');
    throw error;
  }
}

export async function saveMasterSopStagesToFirestore(stages: MasterSopStage[]) {
  try {
    const batch = writeBatch(db);
    stages.forEach((stage) => {
      batch.set(doc(db, 'masterSopStages', stage.id), stage);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'masterSopStages');
    throw error;
  }
}

export async function saveDepartmentsToFirestore(departments: MasterDepartment[]) {
  try {
    const batch = writeBatch(db);
    departments.forEach((dept) => {
      batch.set(doc(db, 'departments', dept.id), dept);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'departments');
    throw error;
  }
}
