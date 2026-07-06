import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAK81XHflF2MyDLKCdE0V7QJi1zXPZTn3I",
  authDomain: "focuson-webapp.firebaseapp.com",
  projectId: "focuson-webapp",
  storageBucket: "focuson-webapp.firebasestorage.app",
  messagingSenderId: "678649602813",
  appId: "1:678649602813:web:5222c73b790d54a4ef1494"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Auth helper functions
export const logInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logInWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const registerWithEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const updateDisplayName = (name: string) => {
  if (auth.currentUser) {
    return updateProfile(auth.currentUser, { displayName: name });
  }
  return Promise.resolve();
};
export const logOut = () => signOut(auth);

