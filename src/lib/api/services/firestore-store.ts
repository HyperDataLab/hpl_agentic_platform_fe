import {
  addDoc,
  collection,
  type DocumentData,
  deleteDoc,
  doc,
  type FirestoreError,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import type { ReviewMode } from "@/lib/run-stream/contract";
import { ApiError } from "@/types/api";

/** `projects/{id}`. */
export interface ProjectDoc {
  name: string;
  description: string;
  ownerEmail: string;
  memberEmails: string[];
  createdAt: string;
  updatedAt: string;
  /** Set once the project is archived or completed; absent means it is being worked on. */
  status?: string;
}

/** `projects/{id}/runs/{runId}`: what the list needs. The events stay in the worker. */
export interface RunDoc {
  topic: string;
  review_mode: ReviewMode;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  domains?: string[];
}

/** Firestore keeps times as Timestamps; the app reads ISO 8601. A write still pending reads as now. */
export function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function")
    return (value.toDate() as Date).toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toProjectDoc(data: DocumentData): ProjectDoc {
  return {
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    ownerEmail: String(data.ownerEmail ?? ""),
    memberEmails: Array.isArray(data.memberEmails) ? data.memberEmails.map(String) : [],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt ?? data.createdAt),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
  };
}

function toRunDoc(data: DocumentData): RunDoc {
  return {
    topic: String(data.topic ?? ""),
    review_mode: (data.review_mode ?? "light") as ReviewMode,
    status: String(data.status ?? "queued"),
    createdBy: String(data.createdBy ?? ""),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt ?? data.createdAt),
    ...(Array.isArray(data.domains) ? { domains: data.domains.map(String) } : {}),
  };
}

/** Firestore's errors as the app's, so screens show the same messages they did for the Platform's. */
export function toApiError(error: unknown): unknown {
  const code = (error as FirestoreError | undefined)?.code;
  if (code === "permission-denied") return new ApiError(403, "FORBIDDEN", "You don't have access to this project.");
  if (code === "not-found") return new ApiError(404, "NOT_FOUND", "This project no longer exists.");
  if (code === "unauthenticated") return new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (code === "unavailable") return new ApiError(0, "NETWORK_ERROR", "Unable to reach Firestore. Please try again.");
  return error;
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toApiError(error);
  }
}

async function db() {
  const { firestore } = await import("@/lib/firebase/client");
  return firestore();
}

export const firestoreProjects = {
  /** The projects the account is a member of, newest first. */
  list: (email: string) =>
    guarded(async () => {
      const snapshot = await getDocs(
        query(
          collection(await db(), "projects"),
          where("memberEmails", "array-contains", email),
          orderBy("createdAt", "desc"),
        ),
      );
      return snapshot.docs.map((item) => ({ id: item.id, doc: toProjectDoc(item.data()) }));
    }),
  /** Null when the project doesn't exist; a project the account can't read fails with 403. */
  get: (id: string) =>
    guarded(async () => {
      const snapshot = await getDoc(doc(await db(), "projects", id));
      return snapshot.exists() ? toProjectDoc(snapshot.data()) : null;
    }),
  create: (input: { name: string; description: string; ownerEmail: string }) =>
    guarded(async () => {
      const ref = await addDoc(collection(await db(), "projects"), {
        name: input.name,
        description: input.description,
        ownerEmail: input.ownerEmail,
        memberEmails: [input.ownerEmail],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    }),
  update: (id: string, fields: Partial<Pick<ProjectDoc, "name" | "description" | "status" | "ownerEmail">>) =>
    guarded(async () => {
      await updateDoc(doc(await db(), "projects", id), { ...fields, updatedAt: serverTimestamp() });
    }),
  remove: (id: string) =>
    guarded(async () => {
      await deleteDoc(doc(await db(), "projects", id));
    }),
};

export const firestoreRuns = {
  list: (projectId: string, count?: number) =>
    guarded(async () => {
      const runs = collection(await db(), "projects", projectId, "runs");
      const snapshot = await getDocs(
        count ? query(runs, orderBy("createdAt", "desc"), limitTo(count)) : query(runs, orderBy("createdAt", "desc")),
      );
      return snapshot.docs.map((item) => ({ id: item.id, doc: toRunDoc(item.data()) }));
    }),
  get: (projectId: string, runId: string) =>
    guarded(async () => {
      const snapshot = await getDoc(doc(await db(), "projects", projectId, "runs", runId));
      return snapshot.exists() ? toRunDoc(snapshot.data()) : null;
    }),
  /** Written after the worker answered 201, under the worker's run id. */
  create: (projectId: string, runId: string, fields: Omit<RunDoc, "createdAt" | "updatedAt">) =>
    guarded(async () => {
      await setDoc(doc(await db(), "projects", projectId, "runs", runId), {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const now = new Date().toISOString();
      return { ...fields, createdAt: now, updatedAt: now } satisfies RunDoc;
    }),
  setStatus: (projectId: string, runId: string, status: string) =>
    guarded(async () => {
      await updateDoc(doc(await db(), "projects", projectId, "runs", runId), { status, updatedAt: serverTimestamp() });
    }),
};
