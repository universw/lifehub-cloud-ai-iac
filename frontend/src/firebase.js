import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDmK3y9wZkq2qkDz2AbDJ-YVMz0t4rzKp8",
  authDomain: "lifehub-ai-cloud.firebaseapp.com",
  projectId: "lifehub-ai-cloud",
  storageBucket: "lifehub-ai-cloud.firebasestorage.app",
  messagingSenderId: "1069868196126",
  appId: "1:1069868196126:web:87631f90e08e8a4218690f",
};

const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;