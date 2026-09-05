// See src/vendor/firebase-app.d.ts for why this file exists.

import type { FirebaseApp } from "./firebase-app";

export interface Firestore {
  readonly type: "firestore";
}

export interface FirestoreSettings {
  experimentalAutoDetectLongPolling?: boolean;
  useFetchStreams?: boolean;
}

export interface DocumentReference {
  readonly id: string;
}

export interface CollectionReference {
  readonly id: string;
}

export interface DocumentSnapshot {
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

export interface QueryDocumentSnapshot extends DocumentSnapshot {
  readonly id: string;
  data(): Record<string, unknown>;
}

export interface QuerySnapshot {
  forEach(callback: (doc: QueryDocumentSnapshot) => void): void;
}

export interface FirestoreError {
  code: string;
  message: string;
}

export function initializeFirestore(app: FirebaseApp, settings: FirestoreSettings): Firestore;
export function doc(db: Firestore, collectionPath: string, id: string): DocumentReference;
export function collection(db: Firestore, collectionPath: string): CollectionReference;
export function getDoc(ref: DocumentReference): Promise<DocumentSnapshot>;
export function getDocs(ref: CollectionReference): Promise<QuerySnapshot>;
export function setDoc(ref: DocumentReference, data: Record<string, unknown>): Promise<void>;
export function onSnapshot(
  ref: DocumentReference,
  onNext: (snap: DocumentSnapshot) => void,
  onError: (err: FirestoreError) => void
): () => void;
