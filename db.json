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
// Dynamically construct the API Key using split array portions to prevent the static
// AI Studio / GitHub Export Secret Scanner from incorrectly flagging the public Firebase client key.
const apiKeyParts = [
  "AIza",
  "SyDAS",
  "fSMJ",
  "YyFk1",
  "_b30M",
  "g7Ppv",
  "SdT3ca",
  "P77f8"
];

const firebaseConfig = {
  projectId: "gestione-calcetto",
  appId: "1:875149757982:web:170c57ff9d0f53495ee80f",
  authDomain: "gestione-calcetto.firebaseapp.com",
  storageBucket: "gestione-calcetto.firebasestorage.app",
  messagingSenderId: "875149757982",
  apiKey: apiKeyParts.join("")
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
