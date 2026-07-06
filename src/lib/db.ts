import { UserProfile, FocusSession, DistractionLog, InsightStats, Project } from "../types";
import { db, auth } from "./firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  deleteDoc,
  writeBatch
} from "firebase/firestore";

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
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        const updatedProfile = {
          ...data,
          completedOnboarding: data.completedOnboarding ?? true,
          projects: (!data.projects || data.projects.length === 0) ? DEFAULT_PROJECTS : data.projects
        };
        // Cache locally for guest/local fallback
        localStorage.setItem("focuson_profile_" + uid, JSON.stringify(updatedProfile));
        localStorage.setItem("focuson_profile", JSON.stringify(updatedProfile));
        return updatedProfile;
      } else {
        const freshProfile: UserProfile = {
          uid,
          email: email || "user@focuson.app",
          displayName: displayName || "FocusOn Pilot",
          photoURL,
          createdAt: new Date().toISOString(),
          adhdMode: false,
          weeklyGoalMinutes: 150,
          projects: DEFAULT_PROJECTS,
          completedOnboarding: false
        };
        await setDoc(userRef, freshProfile);
        // Cache locally
        localStorage.setItem("focuson_profile_" + uid, JSON.stringify(freshProfile));
        localStorage.setItem("focuson_profile", JSON.stringify(freshProfile));
        return freshProfile;
      }
    } catch (err) {
      console.warn("Firestore error fetching user profile, falling back to local storage:", err);
    }
  }

  // Fallback to Local Storage for guest / local mode caching
  const storedKey = isLocal ? "focuson_profile" : "focuson_profile_" + uid;
  const stored = localStorage.getItem(storedKey) || localStorage.getItem("focuson_profile");
  if (stored) {
    const data = JSON.parse(stored) as UserProfile;
    const dataWithUid: UserProfile = {
      ...data,
      uid: isLocal ? "local-user" : uid, // retain correct uid
      completedOnboarding: data.completedOnboarding ?? true,
      projects: (!data.projects || data.projects.length === 0) ? DEFAULT_PROJECTS : data.projects
    };
    localStorage.setItem(storedKey, JSON.stringify(dataWithUid));
    localStorage.setItem("focuson_profile", JSON.stringify(dataWithUid));
    return dataWithUid;
  } else {
    const freshProfile: UserProfile = {
      uid: isLocal ? "local-user" : uid,
      email: email || (isLocal ? "user@focuson.local" : "user@focuson.app"),
      displayName: displayName || "FocusOn Pilot",
      photoURL: isLocal ? null : photoURL,
      createdAt: new Date().toISOString(),
      adhdMode: false,
      weeklyGoalMinutes: 150,
      projects: DEFAULT_PROJECTS,
      completedOnboarding: false
    };
    localStorage.setItem(storedKey, JSON.stringify(freshProfile));
    localStorage.setItem("focuson_profile", JSON.stringify(freshProfile));
    return freshProfile;
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const isLocal = uid === "local-user";

  if (!isLocal) {
    try {
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, updates, { merge: true });
    } catch (err) {
      console.error("Error updating user profile in Firestore:", err);
    }
  }

  // Always keep local storage updated in case of guest/local fallback
  const storedKey = isLocal ? "focuson_profile" : "focuson_profile_" + uid;
  const stored = localStorage.getItem(storedKey) || localStorage.getItem("focuson_profile");
  if (stored) {
    const current = JSON.parse(stored) as UserProfile;
    const updated = { ...current, ...updates, uid };
    localStorage.setItem(storedKey, JSON.stringify(updated));
    localStorage.setItem("focuson_profile", JSON.stringify(updated));
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
    localStorage.setItem("focuson_profile", JSON.stringify(freshProfile));
  }
}

// Focus Sessions CRUD
export async function fetchUserSessions(uid: string, limitCount = 50): Promise<FocusSession[]> {
  const isLocal = uid === "local-user";

  if (!isLocal) {
    try {
      const sessionsRef = collection(db, "sessions");
      const q = query(
        sessionsRef,
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      const sessions: FocusSession[] = [];
      querySnapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() } as FocusSession);
      });
      // Synchronize with local storage for guest/local caching
      localStorage.setItem("focuson_sessions_" + uid, JSON.stringify(sessions));
      localStorage.setItem("focuson_sessions", JSON.stringify(sessions));
      return sessions;
    } catch (err) {
      console.warn("Firestore error fetching user sessions, falling back to local storage:", err);
    }
  }

  // Fallback to local storage
  const storedKey = isLocal ? "focuson_sessions" : "focuson_sessions_" + uid;
  const stored = localStorage.getItem(storedKey) || localStorage.getItem("focuson_sessions");
  if (stored) {
    const list = JSON.parse(stored) as FocusSession[];
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limitCount);
  } else {
    // Initial clean dummy entries for nice UX presentation
    const seedSessions: FocusSession[] = [
      {
        id: "1",
        userId: uid,
        taskName: "Database design of main API",
        tinyStep: "Write out 5 schemas in text file",
        originalDurationMinutes: 25,
        actualDurationSeconds: 1500,
        completed: true,
        status: "completed",
        createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        dateStr: new Date(Date.now() - 36 * 3600 * 1000).toISOString().split("T")[0],
        reflectionNotes: "Completed schema definitions. Discovered that keeping them modular was more scalable.",
        nextStepSuggested: "Test primary signup routing controllers",
        stuckCount: 1,
        distractionCheckInCount: 1
      },
      {
        id: "2",
        userId: uid,
        taskName: "UI Landing page sketch",
        tinyStep: "Draw outline on paper or wireframe",
        originalDurationMinutes: 20,
        actualDurationSeconds: 1200,
        completed: true,
        status: "completed",
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        dateStr: new Date(Date.now() - 12 * 3600 * 1000).toISOString().split("T")[0],
        reflectionNotes: "Drew 3 layout variations. Picked version 2 for its serene aesthetic space.",
        nextStepSuggested: "Code the header layout",
        stuckCount: 0,
        distractionCheckInCount: 0
      }
    ];
    localStorage.setItem(storedKey, JSON.stringify(seedSessions));
    localStorage.setItem("focuson_sessions", JSON.stringify(seedSessions));
    return seedSessions.slice(0, limitCount);
  }
}

export async function saveFocusSession(session: Omit<FocusSession, "id">, id?: string): Promise<string> {
  const isLocal = session.userId === "local-user";
  const generatedId = id || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (!isLocal) {
    try {
      const sessionRef = doc(db, "sessions", generatedId);
      await setDoc(sessionRef, { ...session, id: generatedId }, { merge: true });
      return generatedId;
    } catch (err) {
      console.error("Error saving focus session to Firestore:", err);
    }
  }

  // Save/update locally
  const storedKey = isLocal ? "focuson_sessions" : "focuson_sessions_" + session.userId;
  const stored = localStorage.getItem(storedKey) || localStorage.getItem("focuson_sessions");
  let list = stored ? (JSON.parse(stored) as FocusSession[]) : [];
  
  const existingIdx = list.findIndex(s => s.id === generatedId);
  const sessionWithId = { id: generatedId, ...session } as FocusSession;
  if (existingIdx > -1) {
    list[existingIdx] = { ...list[existingIdx], ...sessionWithId };
  } else {
    list.push(sessionWithId);
  }
  localStorage.setItem(storedKey, JSON.stringify(list));
  localStorage.setItem("focuson_sessions", JSON.stringify(list));
  return generatedId;
}

export async function deleteUserSession(sessionId: string): Promise<void> {
  // First, try deleting from Firestore if we can find a matching session or if we are logged in
  const user = auth.currentUser;
  if (user) {
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      await deleteDoc(sessionRef);
    } catch (err) {
      console.error("Error deleting session from Firestore:", err);
    }
  }

  const storedKeys = user ? ["focuson_sessions_" + user.uid, "focuson_sessions"] : ["focuson_sessions"];
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

  if (!isLocal) {
    try {
      const sessionsRef = collection(db, "sessions");
      const q = query(sessionsRef, where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Error batch deleting sessions from Firestore:", err);
    }
  }

  localStorage.removeItem("focuson_sessions_" + uid);
  localStorage.removeItem("focuson_sessions");
}

export async function logDistraction(log: Omit<DistractionLog, "id">): Promise<string> {
  const isLocal = log.userId === "local-user";
  const generatedId = `dist_${Date.now()}`;

  if (!isLocal) {
    try {
      const distractionRef = doc(db, "distractions", generatedId);
      await setDoc(distractionRef, { ...log, id: generatedId });
    } catch (err) {
      console.error("Error logging distraction to Firestore:", err);
    }
  }

  const storedKey = isLocal ? "focuson_distractions" : "focuson_distractions_" + log.userId;
  const stored = localStorage.getItem(storedKey) || localStorage.getItem("focuson_distractions");
  let list = stored ? (JSON.parse(stored) as DistractionLog[]) : [];
  const newLog = { id: generatedId, ...log } as DistractionLog;
  list.push(newLog);
  localStorage.setItem(storedKey, JSON.stringify(list));
  localStorage.setItem("focuson_distractions", JSON.stringify(list));
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
