import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth & Provider
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Setting Persistence allows us to rely primarily on Firebase's IndexedDB management gracefully
auth.setPersistence(browserLocalPersistence);

export { auth, googleProvider };
