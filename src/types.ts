export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  adhdMode: boolean;
  weeklyGoalMinutes: number;
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
