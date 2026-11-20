/**
 * The public web configuration of the hyperdatalab-idea2hypo Firebase project. It identifies the project to
 * Google's sign-in and Firestore; it is not a secret. Access is enforced by Firestore rules and the i2h-worker.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hyperdatalab-idea2hypo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hyperdatalab-idea2hypo",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
};

/** Talks to the local Auth and Firestore emulators instead of Google. */
export const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

export const LAB_DOMAIN = "hyperdatalab.org";

/** The rule the worker and Firestore apply: exactly one '@' and exactly the lab's domain. */
export function labEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const at = email.indexOf("@");
  return at > 0 && at === email.lastIndexOf("@") && email.slice(at + 1).toLowerCase() === LAB_DOMAIN;
}
