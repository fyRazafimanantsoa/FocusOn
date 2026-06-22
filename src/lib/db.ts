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
import { UserProfile, FocusSession, DistractionLog, InsightStats } from "../types";

// User Profile management
export async function getOrCreateUserProfile(uid: string, email: string, displayName: string | null, photoURL: string | null): Promise<UserProfile> {
  const userDocRef = doc(db, "users", uid);
  const userSnapshot = await getDoc(userDocRef);
  
  if (userSnapshot.exists()) {
    return userSnapshot.data() as UserProfile;
  } else {
    const freshProfile: UserProfile = {
      uid,
      email,
      displayName,
      photoURL,
      createdAt: new Date().toISOString(),
      adhdMode: false,
      weeklyGoalMinutes: 150
    };
    await setDoc(userDocRef, freshProfile);
    return freshProfile;
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, updates);
}

// Focus Sessions CRUD
export async function fetchUserSessions(uid: string, limitCount = 50): Promise<FocusSession[]> {
  try {
    const sessionsRef = collection(db, "sessions");
    // Only query by userId to avoid needing a composite index.
    const q = query(
      sessionsRef,
      where("userId", "==", uid)
    );
    const snap = await getDocs(q);
    const results: FocusSession[] = [];
    snap.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() } as FocusSession);
    });
    // Sort descending by createdAt
    return results.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limitCount);
  } catch (err) {
    console.warn("Firestore sessions fetch error:", err);
    return [];
  }
}

export async function saveFocusSession(session: Omit<FocusSession, "id">, id?: string): Promise<string> {
  if (id) {
    const docRef = doc(db, "sessions", id);
    await setDoc(docRef, session, { merge: true });
    return id;
  } else {
    const sessionsRef = collection(db, "sessions");
    const docRef = await addDoc(sessionsRef, session);
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
  const ref = collection(db, "distractions");
  const docRef = await addDoc(ref, log);
  return docRef.id;
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
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    
    // If the latest focus date is either today or yesterday, compute the streak
    if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
      streak = 1;
      let lastDate = new Date(uniqueDates[0]);
      for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i]);
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
