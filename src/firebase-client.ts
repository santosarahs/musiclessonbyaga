import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import type { AuthUser, LessonBookFB, MemberRow, Role } from "./types";

// ---- Paste your Firebase project's web config here (Project settings -> Your apps). ----
// This is a public client identifier, not a secret -- safe to commit.
const firebaseConfig = {
  apiKey: "AIzaSyBeTflw0KyxDL_GLUOPJsZznO2_omFijcA",
  authDomain: "musiclessonbyaga.firebaseapp.com",
  projectId: "musiclessonbyaga",
  storageBucket: "musiclessonbyaga.firebasestorage.app",
  messagingSenderId: "502662860963",
  appId: "1:502662860963:web:9ca2f846539ab7a3aeef16",
};

// Kept in sync with firestore.rules -- these two always get in even before
// anyone has added a "members" document.
const BOOTSTRAP_ROLES: Record<string, Role> = {
  "santosarahsantiago@gmail.com": "admin",
  "manilynsantiagosantos@gmail.com": "scheduler",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Ad blockers / privacy extensions / some corporate networks block Firestore's
// streaming "webchannel" connection (shows up as ERR_BLOCKED_BY_CLIENT). Long
// polling avoids that at the cost of a little latency.
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
const provider = new GoogleAuthProvider();

async function roleFor(user: AuthUser | null): Promise<Role | null> {
  if (!user || !user.email) return null;
  const email = user.email.toLowerCase();
  if (BOOTSTRAP_ROLES[email]) return BOOTSTRAP_ROLES[email];
  try {
    const snap = await getDoc(doc(db, "members", email));
    const role = snap.exists() ? (snap.data()?.role as Role | undefined) : undefined;
    return role || null;
  } catch (e) {
    return null;
  }
}

const fb: LessonBookFB = {
  signIn() {
    return signInWithPopup(auth, provider);
  },
  signOut() {
    return signOut(auth);
  },
  onAuth(cb) {
    return onAuthStateChanged(auth, cb);
  },
  roleFor,
  watch(name, cb) {
    return onSnapshot(
      doc(db, "studio", name),
      (snap) => cb(snap.exists() ? (snap.data() as Record<string, unknown>) : null),
      (err) => {
        console.error("LessonBook: watch(" + name + ") failed:", err.code, err.message);
      }
    );
  },
  save(name, data) {
    return setDoc(doc(db, "studio", name), data).catch((err) => {
      console.error("LessonBook: save(" + name + ") failed:", err.code, err.message);
      throw err;
    });
  },
  async listMembers(): Promise<MemberRow[]> {
    const out: MemberRow[] = Object.keys(BOOTSTRAP_ROLES).map((email) => ({
      email,
      role: BOOTSTRAP_ROLES[email],
      bootstrap: true,
    }));
    try {
      const snap = await getDocs(collection(db, "members"));
      snap.forEach((d) => {
        const role = d.data().role as string | undefined;
        if (role) out.push({ email: d.id, role, bootstrap: false });
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.error("LessonBook: listMembers failed:", err.code, err.message);
    }
    return out;
  },
  setMember(email, role) {
    return setDoc(doc(db, "members", email.toLowerCase()), { role }).catch((err) => {
      console.error("LessonBook: setMember failed:", err.code, err.message);
      throw err;
    });
  },
  removeMember(email) {
    return setDoc(doc(db, "members", email.toLowerCase()), { role: null }).catch((err) => {
      console.error("LessonBook: removeMember failed:", err.code, err.message);
      throw err;
    });
  },
};

window.LessonBookFB = fb;
window.dispatchEvent(new Event("lessonbook-fb-ready"));
