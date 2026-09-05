// Minimal ambient types for the Firebase Web SDK modules loaded at runtime
// straight from the gstatic CDN (see src/firebase-client.ts). We don't install
// the `firebase` npm package -- these just describe the handful of functions
// this app actually calls, enough for `tsc` to type-check firebase-client.ts.
// Mapped here via tsconfig.json's `paths` so the CDN URL import resolves.

export interface FirebaseApp {
  readonly name: string;
}

export interface FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function initializeApp(options: FirebaseOptions): FirebaseApp;
