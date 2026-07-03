import { UserProfile, FocusSession, DistractionLog, InsightStats, Project } from "../types";

export const DEFAULT_PROJECTS: Project[] = [
  { id: "work", name: "Work", color: "#3B82F6" },
  { id: "study", name: "Study", color: "#8B5CF6" },
  { id: "personal", name: "Personal", color: "#10B981" },
  { id: "health", name: "Health & Wellness", color: "#F43F5E" }
];

// User Profile management
export async function getOrCreateUserProfile(uid: string, email: string, displayName: string | null, photoURL: string | null): Promise<UserProfile> {
  const cacheKey = `focuson_profile_${uid}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached) as UserProfile;
      if (!data.projects || data.projects.length === 0) {
        data.projects = DEFAULT_PROJECTS;
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
      return data;
    } catch (e) {
      console.error("Failed to parse cached profile", e);
    }
  }

  const freshProfile: UserProfile = {
    uid,
    email,
    displayName: displayName || email.split("@")[0] || "FocusOn User",
    photoURL,
    createdAt: new Date().toISOString(),
    adhdMode: false,
    weeklyGoalMinutes: 150,
    projects: DEFAULT_PROJECTS
  };
  localStorage.setItem(cacheKey, JSON.stringify(freshProfile));
  return freshProfile;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const cacheKey = `focuson_profile_${uid}`;
  const cached = localStorage.getItem(cacheKey);
  let profile: UserProfile;
  if (cached) {
    try {
      profile = { ...JSON.parse(cached), ...updates };
    } catch {
      profile = {
        uid,
        email: "",
        displayName: "FocusOn User",
        photoURL: null,
        createdAt: new Date().toISOString(),
        adhdMode: false,
        weeklyGoalMinutes: 150,
        projects: DEFAULT_PROJECTS,
        ...updates
      };
    }
  } else {
    profile = {
      uid,
      email: "",
      displayName: "FocusOn User",
      photoURL: null,
      createdAt: new Date().toISOString(),
      adhdMode: false,
      weeklyGoalMinutes: 150,
      projects: DEFAULT_PROJECTS,
      ...updates
    };
  }
  localStorage.setItem(cacheKey, JSON.stringify(profile));
}

// Focus Sessions CRUD
export async function fetchUserSessions(uid: string, limitCount = 50): Promise<FocusSession[]> {
  const cacheKey = `focuson_sessions_${uid}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const list = JSON.parse(cached) as FocusSession[];
      return list.slice(0, limitCount);
    } catch {
      return [];
    }
  }
  return [];
}

export async function saveFocusSession(session: Omit<FocusSession, "id">, id?: string): Promise<string> {
  const uid = session.userId;
  const cacheKey = `focuson_sessions_${uid}`;
  const cached = localStorage.getItem(cacheKey);
  let list: FocusSession[] = [];
  if (cached) {
    try {
      list = JSON.parse(cached);
    } catch {}
  }

  const targetId = id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const existingIdx = list.findIndex(s => s.id === targetId);

  const fullSession: FocusSession = {
    ...session,
    id: targetId
  };

  if (existingIdx >= 0) {
    list[existingIdx] = fullSession;
  } else {
    list.unshift(fullSession);
  }

  localStorage.setItem(cacheKey, JSON.stringify(list));
  return targetId;
}

export async function deleteUserSession(sessionId: string): Promise<void> {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("focuson_sessions_")) {
      try {
        const val = localStorage.getItem(key);
        if (val) {
          const list = JSON.parse(val) as FocusSession[];
          const filtered = list.filter(s => s.id !== sessionId);
          if (filtered.length !== list.length) {
            localStorage.setItem(key, JSON.stringify(filtered));
            break;
          }
        }
      } catch {}
    }
  }
}

export async function deleteAllUserSessions(uid: string): Promise<void> {
  const cacheKey = `focuson_sessions_${uid}`;
  localStorage.removeItem(cacheKey);
}

export async function logDistraction(log: Omit<DistractionLog, "id">): Promise<string> {
  const targetId = `dist_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const cacheKey = `focuson_distractions_${log.userId || "anonymous"}`;
  let list: any[] = [];
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      list = JSON.parse(cached);
    }
  } catch {}
  list.unshift({ ...log, id: targetId });
  localStorage.setItem(cacheKey, JSON.stringify(list));
  return targetId;
}

// Local YYYY-MM-DD Date string generator
export function getLocalDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to parse local YYYY-MM-DD string into a local Date object
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
}

// Generate real insight statistics based on records
export function calculateInsights(sessions: FocusSession[]): InsightStats {
  const completed = sessions.filter(s => s.completed);
  const totalMinutes = completed.reduce((acc, s) => acc + (s.actualDurationSeconds / 60), 0);
  
  // Calculate simple streak (consecutive calendar days ending today or yesterday)
  // Let's analyze dates
  const uniqueDates = Array.from(new Set(completed.map(s => s.dateStr))).sort().reverse();
  let streak = 0;
  if (uniqueDates.length > 0) {
    const todayStr = getLocalDateStr(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);
    
    // If the latest focus date is either today or yesterday, compute the streak
    if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
      streak = 1;
      let lastDate = parseLocalDate(uniqueDates[0]);
      for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = parseLocalDate(uniqueDates[i]);
        const diffTime = Math.abs(lastDate.getTime() - currentDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak++;
          lastDate = currentDate;
        } else if (diffDays > 1) {
          break; // Streak broken
        }
      }
    }
  }

  // Calculate intentional learning proportion: total checks vs learning choices would be checked,
  // let's estimate or read logs. For the MVP, we can mock or estimate if data is lean.
  const totalStuck = sessions.reduce((acc, s) => acc + (s.stuckCount || 0), 0);
  const totalDistractions = sessions.reduce((acc, s) => acc + (s.distractionCheckInCount || 0), 0);
  
  // Time distribution
  let morning = 0;
  let afternoon = 0;
  let evening = 0;
  
  completed.forEach(s => {
    const hour = new Date(s.createdAt).getHours();
    if (hour >= 5 && hour < 12) morning++;
    else if (hour >= 12 && hour < 17) afternoon++;
    else evening++;
  });
  
  let bestTime = "Morning";
  if (afternoon > morning && afternoon > evening) bestTime = "Afternoon";
  if (evening > morning && evening > afternoon) bestTime = "Evening";
  if (completed.length === 0) bestTime = "To be learned";

  return {
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    completedSessions: completed.length,
    activeStreak: streak,
    learningRatio: totalDistractions > 0 ? Math.round((completed.length / (completed.length + totalDistractions)) * 100) : 100,
    bestTimeOfDay: bestTime
  };
}
