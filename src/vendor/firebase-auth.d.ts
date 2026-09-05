// See src/vendor/firebase-app.d.ts for why this file exists.

import type { FirebaseApp } from "./firebase-app";

export interface AuthUser {
  email: string | null;
}

export interface Auth {
  readonly currentUser: AuthUser | null;
}

export class GoogleAuthProvider {
  constructor();
}

export interface UserCredential {
  user: AuthUser;
}

export function getAuth(app: FirebaseApp): Auth;
export function signInWithPopup(auth: Auth, provider: GoogleAuthProvider): Promise<UserCredential>;
export function signOut(auth: Auth): Promise<void>;
export function onAuthStateChanged(auth: Auth, callback: (user: AuthUser | null) => void): () => void;
