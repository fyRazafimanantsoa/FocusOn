import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  limit, 
  addDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { UserProfile, FocusSession, DistractionLog, InsightStats, Project } from "../types";

export const DEFAULT_PROJECTS: Project[] = [
  { id: "work", name: "Work", color: "#3B82F6" },
  { id: "study", name: "Study", color: "#8B5CF6" },
  { id: "personal", name: "Personal", color: "#10B981" },
  { id: "health", name: "Health & Wellness", color: "#F43F5E" }
];

// Helper to recursively strip any undefined properties to prevent Firestore errors
function cleanData<T>(value: T): any {
  if (value === undefined) {
    return null; // Convert undefined to null as Firestore supports null
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(item => cleanData(item));
  }
  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const cleaned: any = {};
    for (const key of Object.keys(value as any)) {
      const val = (value as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanData(val);
      }
    }
    return cleaned;
  }
  return value;
}

// User Profile management
export async function getOrCreateUserProfile(uid: string, email: string, displayName: string | null, photoURL: string | null): Promise<UserProfile> {
  const userDocRef = doc(db, "users", uid);
  const userSnapshot = await getDoc(userDocRef);
  
  if (userSnapshot.exists()) {
    const data = userSnapshot.data() as UserProfile;
    if (!data.projects || data.projects.length === 0) {
      const updatedProfile = { ...data, projects: DEFAULT_PROJECTS };
      await setDoc(userDocRef, cleanData({ projects: DEFAULT_PROJECTS }), { merge: true });
      return updatedProfile;
    }
    return data;
  } else {
    const freshProfile: UserProfile = {
      uid,
      email,
      displayName,
      photoURL,
      createdAt: new Date().toISOString(),
      adhdMode: false,
      weeklyGoalMinutes: 150,
      projects: DEFAULT_PROJECTS
    };
    await setDoc(userDocRef, cleanData(freshProfile));
    return freshProfile;
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const userDocRef = doc(db, "users", uid);
  const cleanedUpdates = cleanData(updates);
  if (cleanedUpdates && Object.keys(cleanedUpdates).length > 0) {
    await updateDoc(userDocRef, cleanedUpdates);
  }
}

// Focus Sessions CRUD
export async function fetchUserSessions(uid: string, limitCount = 50): Promise<FocusSession[]> {
  try {
    const sessionsRef = collection(db, "sessions");
    try {
      // 1. Try modern production query with ordering and limiting directly on the server
      const qOrdered = query(
        sessionsRef,
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
      const snap = await getDocs(qOrdered);
      const results: FocusSession[] = [];
      snap.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as FocusSession);
      });
      return results;
    } catch (orderErr: any) {
      // 2. Fall back to index-free query if composite index isn't set up yet, to guarantee zero-downtime onboarding
      if (orderErr && (orderErr.message?.includes("index") || orderErr.code === "failed-precondition")) {
        console.warn(
          "Firestore Composite Index is not yet provisioned. For production scale, please create this index in Firebase Console:\n",
          orderErr.message
        );
        
        // Fetch a safe max buffer in fallback, then sort and slice in client memory
        const qFallback = query(
          sessionsRef,
          where("userId", "==", uid),
          limit(Math.max(100, limitCount * 2))
        );
        const snap = await getDocs(qFallback);
        const results: FocusSession[] = [];
        snap.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() } as FocusSession);
        });
        return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limitCount);
      }
      throw orderErr;
    }
  } catch (err) {
    console.error("Firestore sessions fetch error:", err);
    return [];
  }
}

export async function saveFocusSession(session: Omit<FocusSession, "id">, id?: string): Promise<string> {
  const cleanedSession = cleanData(session);
  if (id) {
    const docRef = doc(db, "sessions", id);
    await setDoc(docRef, cleanedSession, { merge: true });
    return id;
  } else {
    const sessionsRef = collection(db, "sessions");
    const docRef = await addDoc(sessionsRef, cleanedSession);
    return docRef.id;
  }
}

export async function deleteUserSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, "sessions", sessionId));
}

export async function deleteAllUserSessions(uid: string): Promise<void> {
  const sessions = await fetchUserSessions(uid, 1000); // Fetch all to delete
  for (const session of sessions) {
    if (session.id) {
      await deleteDoc(doc(db, "sessions", session.id));
    }
  }
}

export async function logDistraction(log: Omit<DistractionLog, "id">): Promise<string> {
  const cleanedLog = cleanData(log);
  const ref = collection(db, "distractions");
  const docRef = await addDoc(ref, cleanedLog);
  return docRef.id;
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
