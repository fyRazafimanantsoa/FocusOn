export interface Project {
  id: string;
  name: string;
  color: string; // color hex code
  isArchived?: boolean;
  customDuration?: number; // override session duration in minutes
  weeklyGoalHours?: number; // target focused hours per week
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  adhdMode: boolean;
  weeklyGoalMinutes: number;
  projects?: Project[];
  theme?: "dark" | "light";
  blockedDomains?: string[];
  completedOnboarding?: boolean;
}

export interface FocusSession {
  id: string;
  userId: string;
  taskName: string;
  tinyStep: string;
  originalDurationMinutes: number;
  actualDurationSeconds: number;
  completed: boolean;
  status: "completed" | "interrupted" | "active";
  createdAt: string;
  dateStr: string; // YYYY-MM-DD
  reflectionNotes?: string;
  nextStepSuggested?: string;
  stuckCount: number;
  distractionCheckInCount: number;
  projectId?: string;
}

export interface DistractionLog {
  id: string;
  userId: string;
  sessionId: string;
  timestamp: string;
  activity: string;
  choice: "learning" | "break" | "resume";
  notes?: string;
}

export interface InsightStats {
  totalHours: number;
  completedSessions: number;
  activeStreak: number;
  learningRatio: number; // percentage of distractions deemed 'productive learning'
  bestTimeOfDay: string; // "Morning", "Afternoon", "Evening"
}
