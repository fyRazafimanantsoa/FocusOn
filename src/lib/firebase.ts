import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

// User's custom Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBo9myE-P5jI3WctBFLzk9sBItqEawuIa0",
  authDomain: "focuson-2.web.app",
  projectId: "focuson-2",
  storageBucket: "focuson-2.firebasestorage.app",
  messagingSenderId: "332419558209",
  appId: "1:332419558209:web:7f3ab85898597869348fc0",
  measurementId: "G-9R8640GF1J"
};

// Initialize app parent
const app = initializeApp(firebaseConfig);

// Expose mock/null database to satisfy imports while honoring "Do NOT use Firestore or Storage yet"
export const db = null as any;

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Google Sign In Popup helper
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.warn("Firebase Google Auth login warning (handled):", error);
    throw error;
  }
}

// Email/Password sign-in helper
export async function loginWithEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.warn("Email sign in warning (handled):", error);
    // User requested: "Email or password is incorrect"
    throw new Error("Email or password is incorrect");
  }
}

// Email/Password sign-up helper
export async function signUpWithEmail(email: string, password: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.warn("Email sign up warning (handled):", error);
    // User requested: "User already exists. Please sign in" if email already exists
    if (error.code === "auth/email-already-in-use") {
      throw new Error("User already exists. Please sign in");
    }
    throw error;
  }
}

// Sign Out helper
export async function logOut() {
  await signOut(auth);
}
