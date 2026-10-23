import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDXwCtp3TavrG0S4lQi8Z90n-XBFsZqlIs",
  authDomain: "elisa-d6e4a.firebaseapp.com",
  projectId: "elisa-d6e4a",
  storageBucket: "elisa-d6e4a.firebasestorage.app",
  messagingSenderId: "985782089933",
  appId: "1:985782089933:web:7df5c68bce727850c75184"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();