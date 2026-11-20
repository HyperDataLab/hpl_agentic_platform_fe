"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, type Firestore, getFirestore } from "firebase/firestore";

import { firebaseConfig, USE_EMULATORS } from "./config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function firebaseApp() {
  app ??= getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function firebaseAuth() {
  if (!auth) {
    auth = getAuth(firebaseApp());
    if (USE_EMULATORS) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

export function firestore() {
  if (!db) {
    db = getFirestore(firebaseApp());
    if (USE_EMULATORS) connectFirestoreEmulator(db, "127.0.0.1", 8085);
  }
  return db;
}

/** A fresh ID token for the lab's services, or null when nobody is signed in. */
export async function getIdToken(): Promise<string | null> {
  const current = firebaseAuth();
  // On a fresh page the saved session is restored asynchronously.
  await current.authStateReady();
  return current.currentUser ? current.currentUser.getIdToken() : null;
}

/** The signed-in account's email, or null. */
export function currentEmail(): string | null {
  return firebaseAuth().currentUser?.email ?? null;
}
