import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA4caDoBy46hbjYVWFs4jo8-kX5nxHc6W4",
  authDomain: "elisa-35b24.firebaseapp.com",
  projectId: "elisa-35b24",
  storageBucket: "elisa-35b24.firebasestorage.app",
  messagingSenderId: "56533144499",
  appId: "1:56533144499:web:890c9f34c016d4a34af1c6",
  measurementId: "G-7YTSK57GPM"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();