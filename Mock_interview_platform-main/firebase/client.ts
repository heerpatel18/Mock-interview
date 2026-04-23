// Import the functions you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";          // ✅ ADD THIS
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCSW7jOclJ4_Bsdqc_kWt3DSVyAaEgQHgQ",
  authDomain: "prepwise-1c672.firebaseapp.com",
  projectId: "prepwise-1c672",
  storageBucket: "prepwise-1c672.firebasestorage.app",
  messagingSenderId: "1028734469476",
  appId: "1:1028734469476:web:4c218d12f0bef2f45ce671",
  measurementId: "G-H3703KSRRD"
};

const app = initializeApp(firebaseConfig);

// ⚠️ Analytics only works in browser
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// ✅ Now this will work
export const auth = getAuth(app);