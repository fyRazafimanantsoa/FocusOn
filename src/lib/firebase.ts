import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config parsed from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBB_7LtIhfdmcqqQI-ALXFx___3CYvGCt8",
  authDomain: "gen-lang-client-0797471805.firebaseapp.com",
  projectId: "gen-lang-client-0797471805",
  storageBucket: "gen-lang-client-0797471805.firebasestorage.app",
  messagingSenderId: "804966477360",
  appId: "1:804966477360:web:339c28bcadaa9fc30607f5",
  firestoreDatabaseId: "ai-studio-a8b9b77c-8cce-480e-a795-520e5b0aead9"
};

// Initialize app parent
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID to bypass sandbox limitations
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Google Sign In Popup helper
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Google Auth popup error:", error);
    throw error;
  }
}

// Google Sign In Redirect helper (extremely robust for iframe constraints and unauthorized Vercel domains)
export async function signInWithGoogleRedirect() {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error: any) {
    console.error("Firebase Google Auth redirect error:", error);
    throw error;
  }
}

// Check redirect result on app load
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error: any) {
    console.error("Firebase Google Auth redirect result retrieval error:", error);
    throw error;
  }
}

// Sign Out helper
export async function logOut() {
  await signOut(auth);
}
