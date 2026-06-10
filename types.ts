/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";

const firebaseConfig = {
  projectId: "project-88b687bc-f709-4722-bc0",
  appId: "1:904887295261:web:580d3f4e7651f946eb15f4",
  apiKey: "AIzaSyAJ_dVhd1wq-sChVib0gcm6bwSyaRlHQE4",
  authDomain: "project-88b687bc-f709-4722-bc0.firebaseapp.com",
  storageBucket: "project-88b687bc-f709-4722-bc0.firebasestorage.app",
  messagingSenderId: "904887295261",
  measurementId: "",
  firestoreDatabaseId: "ai-studio-6b857cde-5955-4f04-8c44-cddcc408b2df",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets scope access
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.setCustomParameters({
  prompt: 'select_account'
});

let cachedAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("google_sheets_token") : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = cachedAccessToken || (typeof window !== "undefined" ? localStorage.getItem("google_sheets_token") : null);
      if (token) {
        cachedAccessToken = token;
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else {
        // No token captured
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("google_sheets_token");
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to capture workspace authorization access token.");
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem("google_sheets_token", cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign-in authentication error:", error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || (typeof window !== "undefined" ? localStorage.getItem("google_sheets_token") : null);
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_sheets_token");
  }
};
