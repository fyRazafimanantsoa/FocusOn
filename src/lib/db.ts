import { UserProfile, FocusSession, DistractionLog, InsightStats, Project } from "../types";
import { auth } from "./firebase";

export const DEFAULT_PROJECTS: Project[] = [
  { id: "work", name: "Work", color: "#3B82F6" },
  { id: "study", name: "Study", color: "#8B5CF6" },
  { id: "personal", name: "Personal", color: "#10B981" },
  { id: "health", name: "Health & Wellness", color: "#F43F5E" }
];

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

// State tracker for Firestore blocking (Ad blocker, network issue, etc.)
let blockedListener: ((blocked: boolean) => void) | null = null;
let isBlockedVal = false;

export function onFirestoreBlockedChange(listener: (blocked: boolean) => void) {
  blockedListener = listener;
  // Notify immediately with current state
  listener(isBlockedVal);
}

export function setFirestoreBlocked(blocked: boolean) {
  if (isBlockedVal !== blocked) {
    isBlockedVal = blocked;
    if (blockedListener) {
      blockedListener(blocked);
    }
  }
}

// Helper for making API calls to our Express backend proxy
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const headers = {
    ...options.headers,
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    "Content-Type": "application/json"
  };
  return fetch(url, { ...options, headers });
}

// User Profile management
export async function getOrCreateUserProfile(
  uid: string,
  email: string,
  displayName: string | null,
  photoURL: string | null
): Promise<UserProfile> {
  const isLocal = uid === "local-user";

  if (!isLocal) {
    try {
      const response = await fetchWithAuth("/api/user-profile");
      if (response.status === 200) {
        const data = await response.json() as UserProfile;
        const updatedProfile = {
          ...data,
          completedOnboarding: data.completedOnboarding ?? true,
          projects: (!data.projects || data.projects.length === 0) ? DEFAULT_PROJECTS : data.projects
        };
        // Cache locally for this specific user only
        localStorage.setItem("focuson_profile_" + uid, JSON.stringify(updatedProfile));
        return updatedProfile;
      } else if (response.status === 404) {
        const freshProfile: UserProfile = {
          uid,
          email: email || "user@focuson.app",
          displayName: displayName || "FocusOn Pilot",
          photoURL,
          createdAt: new Date().toISOString(),
          adhdMode: true,
          weeklyGoalMinutes: 150,
          projects: DEFAULT_PROJECTS,
          completedOnboarding: false
        };
        await fetchWithAuth("/api/user-profile", {
          method: "POST",
          body: JSON.stringify(freshProfile)
        });
        // Cache locally for this specific user only
        localStorage.setItem("focuson_profile_" + uid, JSON.stringify(freshProfile));
        return freshProfile;
      }
    } catch (err) {
      console.warn("API error fetching user profile, falling back to local storage:", err);
    }
  }

  // Fallback to Local Storage for guest / local mode caching
  const storedKey = isLocal ? "focuson_profile" : "focuson_profile_" + uid;
  const stored = localStorage.getItem(storedKey);
  if (stored) {
    const data = JSON.parse(stored) as UserProfile;
    const dataWithUid: UserProfile = {
      ...data,
      uid: isLocal ? "local-user" : uid, // retain correct uid
      completedOnboarding: data.completedOnboarding ?? true,
      projects: (!data.projects || data.projects.length === 0) ? DEFAULT_PROJECTS : data.projects
    };
    localStorage.setItem(storedKey, JSON.stringify(dataWithUid));
    return dataWithUid;
  } else {
    const freshProfile: UserProfile = {
      uid: isLocal ? "local-user" : uid,
      email: email || (isLocal ? "user@focuson.local" : "user@focuson.app"),
      displayName: displayName || "FocusOn Pilot",
      photoURL: isLocal ? null : photoURL,
      createdAt: new Date().toISOString(),
      adhdMode: true,
      weeklyGoalMinutes: 150,
      projects: DEFAULT_PROJECTS,
      completedOnboarding: false
    };
    localStorage.setItem(storedKey, JSON.stringify(freshProfile));
    return freshProfile;
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const isLocal = uid === "local-user";

  if (!isLocal) {
    try {
      await fetchWithAuth("/api/user-profile", {
        method: "POST",
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error("Error updating user profile via API:", err);
    }
  }

  // Always keep local storage updated in case of guest/local fallback
  const storedKey = isLocal ? "focuson_profile" : "focuson_profile_" + uid;
  const stored = localStorage.getItem(storedKey);
  if (stored) {
    const current = JSON.parse(stored) as UserProfile;
    const updated = { ...current, ...updates, uid };
    localStorage.setItem(storedKey, JSON.stringify(updated));
  } else {
    const freshProfile: UserProfile = {
      uid,
      email: isLocal ? "user@focuson.local" : "user@focuson.app",
      displayName: "FocusOn Pilot",
      photoURL: null,
      createdAt: new Date().toISOString(),
      adhdMode: false,
      weeklyGoalMinutes: 150,
      projects: DEFAULT_PROJECTS,
      ...updates
    };
    localStorage.setItem(storedKey, JSON.stringify(freshProfile));
  }
}

// Focus Sessions CRUD
export async function fetchUserSessions(uid: string, limitCount = 50): Promise<FocusSession[]> {
  const isLocal = uid === "local-user";

  if (!isLocal) {
    try {
      const response = await fetchWithAuth(`/api/user-sessions?limit=${limitCount}`);
      if (response.status === 200) {
        const sessions = await response.json() as FocusSession[];
        // Cache locally for this specific user only
        localStorage.setItem("focuson_sessions_" + uid, JSON.stringify(sessions));
        return sessions;
      }
    } catch (err) {
      console.warn("API error fetching user sessions, falling back to local storage:", err);
    }
  }

  // Fallback to local storage
  const storedKey = isLocal ? "focuson_sessions" : "focuson_sessions_" + uid;
  const stored = localStorage.getItem(storedKey);
  if (stored) {
    const list = JSON.parse(stored) as FocusSession[];
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limitCount);
  } else {
    // Return empty list for an actual clean history for a new user
    return [];
  }
}

export async function migrateLocalGuestData(newUid: string): Promise<void> {
  // 1. Get local guest profile
  const guestProfileStr = localStorage.getItem("focuson_profile");
  if (guestProfileStr) {
    try {
      const guestProfile = JSON.parse(guestProfileStr) as UserProfile;
      // Copy to new user profile cache, replacing uid
      const updatedProfile = { ...guestProfile, uid: newUid, completedOnboarding: true };
      localStorage.setItem("focuson_profile_" + newUid, JSON.stringify(updatedProfile));
      
      // Save profile to Firestore
      await fetchWithAuth("/api/user-profile", {
        method: "POST",
        body: JSON.stringify(updatedProfile)
      });
    } catch (e) {
      console.error("Failed to migrate guest profile:", e);
    }
  }

  // 2. Get local guest sessions
  const guestSessionsStr = localStorage.getItem("focuson_sessions");
  if (guestSessionsStr) {
    try {
      const guestSessions = JSON.parse(guestSessionsStr) as FocusSession[];
      // Map sessions to new uid
      const updatedSessions = guestSessions.map(s => ({ ...s, userId: newUid }));
      localStorage.setItem("focuson_sessions_" + newUid, JSON.stringify(updatedSessions));

      // Post sessions to the Express backend
      for (const sess of updatedSessions) {
        await fetchWithAuth("/api/user-sessions", {
          method: "POST",
          body: JSON.stringify({
            id: sess.id,
            session: sess
          })
        });
      }
    } catch (e) {
      console.error("Failed to migrate guest sessions:", e);
    }
  }

  // Clear guest storage so migration only runs once
  localStorage.removeItem("focuson_profile");
  localStorage.removeItem("focuson_sessions");
}

export async function saveFocusSession(session: Omit<FocusSession, "id">, id?: string): Promise<string> {
  const isLocal = session.userId === "local-user";
  const generatedId = id || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sessionWithId = { id: generatedId, ...session } as FocusSession;

  // 1. Cloud Save First if authenticated
  if (!isLocal) {
    try {
      const response = await fetchWithAuth("/api/user-sessions", {
        method: "POST",
        body: JSON.stringify({ id: generatedId, session })
      });
      if (!response.ok) {
        throw new Error(`Cloud save responded with ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.warn("Error saving focus session to cloud, falling back to local-only cache:", err);
    }
  }

  // 2. Always maintain local cache as backup
  const storedKey = isLocal ? "focuson_sessions" : "focuson_sessions_" + session.userId;
  const stored = localStorage.getItem(storedKey);
  let list = stored ? (JSON.parse(stored) as FocusSession[]) : [];
  
  const existingIdx = list.findIndex(s => s.id === generatedId);
  if (existingIdx > -1) {
    list[existingIdx] = { ...list[existingIdx], ...sessionWithId };
  } else {
    list.push(sessionWithId);
  }
  localStorage.setItem(storedKey, JSON.stringify(list));

  return generatedId;
}

export async function deleteUserSession(sessionId: string): Promise<void> {
  const user = auth.currentUser;
  
  // 1. Cloud Delete First if authenticated
  if (user) {
    try {
      const response = await fetchWithAuth(`/api/user-sessions/${sessionId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(`Cloud delete responded with ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error deleting session via API, falling back to local-only deletion:", err);
    }
  }

  // 2. Update local cache backup
  const storedKeys = user ? ["focuson_sessions_" + user.uid] : ["focuson_sessions"];
  storedKeys.forEach(key => {
    const stored = localStorage.getItem(key);
    if (stored) {
      const list = JSON.parse(stored) as FocusSession[];
      const filtered = list.filter(s => s.id !== sessionId);
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  });
}

export async function deleteAllUserSessions(uid: string): Promise<void> {
  const isLocal = uid === "local-user";

  // 1. Cloud Batch Delete First if authenticated
  if (!isLocal) {
    try {
      const response = await fetchWithAuth("/api/user-sessions", {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(`Cloud batch delete responded with ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error batch deleting sessions via API:", err);
    }
  }

  // 2. Remove local cache
  localStorage.removeItem("focuson_sessions_" + uid);
}

export async function logDistraction(log: Omit<DistractionLog, "id">): Promise<string> {
  const isLocal = log.userId === "local-user";
  const generatedId = `dist_${Date.now()}`;
  const newLog = { id: generatedId, ...log } as DistractionLog;

  // 1. Cloud Log First if authenticated
  if (!isLocal) {
    try {
      const response = await fetchWithAuth("/api/distraction-log", {
        method: "POST",
        body: JSON.stringify({ id: generatedId, log })
      });
      if (!response.ok) {
        throw new Error(`Cloud log distraction responded with ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error logging distraction via API:", err);
    }
  }

  // 2. Save in local cache backup
  const storedKey = isLocal ? "focuson_distractions" : "focuson_distractions_" + log.userId;
  const stored = localStorage.getItem(storedKey);
  let list = stored ? (JSON.parse(stored) as DistractionLog[]) : [];
  list.push(newLog);
  localStorage.setItem(storedKey, JSON.stringify(list));
  return generatedId;
}

// Generate real insight statistics based on records
export function calculateInsights(sessions: FocusSession[]): InsightStats {
  const completed = sessions.filter(s => s.completed);
  const totalMinutes = completed.reduce((acc, s) => acc + (s.actualDurationSeconds / 60), 0);
  
  const uniqueDates = Array.from(new Set(completed.map(s => s.dateStr))).sort().reverse();
  let streak = 0;
  if (uniqueDates.length > 0) {
    const todayStr = getLocalDateStr(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);
    
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

  const totalDistractions = sessions.reduce((acc, s) => acc + (s.distractionCheckInCount || 0), 0);
  
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
