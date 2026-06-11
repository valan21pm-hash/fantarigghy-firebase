import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "project-88b687bc-f709-4722-bc0",
  appId: "1:904887295261:web:580d3f4e7651f946eb15f4",
  apiKey: "AIzaSyAJ_dVhd1wq-sChVib0gcm6bwSyaRlHQE4",
  authDomain: "project-88b687bc-f709-4722-bc0.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-6b857cde-5955-4f04-8c44-cddcc408b2df",
  storageBucket: "project-88b687bc-f709-4722-bc0.firebasestorage.app",
  messagingSenderId: "904887295261",
};

const app = initializeApp(firebaseConfig, "server-app");
export const dbServer = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export { doc, getDoc, setDoc, collection, getDocs, writeBatch };
