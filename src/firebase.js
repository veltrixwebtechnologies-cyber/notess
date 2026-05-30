import { getApp, getApps, initializeApp } from "firebase/app";
import { doc, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
const isConfigured = missingKeys.length === 0;

function getWorkspaceId() {
  const params = new URLSearchParams(window.location.search);
  const urlWorkspace = params.get("workspace")?.trim() || params.get("share")?.trim() || params.get("id")?.trim();
  const storageKey = "study-notes-firebase-workspace-id";

  if (urlWorkspace) {
    localStorage.setItem(storageKey, urlWorkspace);
    return urlWorkspace;
  }

  const envWorkspace = import.meta.env.VITE_FIREBASE_WORKSPACE_ID?.trim();
  if (envWorkspace) return envWorkspace;

  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const workspaceId = `workspace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(storageKey, workspaceId);
  return workspaceId;
}

let notesDocRef = null;
let workspaceId = "";

if (isConfigured) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  workspaceId = getWorkspaceId();
  notesDocRef = doc(db, "noteWorkspaces", workspaceId);
}

export const firebaseNotes = {
  enabled: isConfigured,
  missingKeys,
  notesDocRef,
  workspaceId
};
