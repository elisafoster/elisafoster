import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBnjvA5J2Yqnbg4yxYUxwzRtxvkXikTsBk",
  authDomain: "nr-development-5bb32.firebaseapp.com",
  projectId: "nr-development-5bb32",
  storageBucket: "nr-development-5bb32.firebasestorage.app",
  messagingSenderId: "573178036744",
  appId: "1:573178036744:web:8ab4e4545643f1c91107bd"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();