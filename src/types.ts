export type Instrument = "piano" | "guitar" | "voice" | "ukulele" | "drums";

export type View = "week" | "month" | "billing" | "students";
export type Recurrence = "weekly" | "once";
export type ClientType = "local" | "foreign";
export type BillStatus = "unpaid" | "partial" | "paid";
export type BillFilter = "all" | BillStatus;
export type Role = "admin" | "scheduler" | "viewer";
export type BookingStatus =
  | "booked"
  | "in-progress"
  | "completed-unpaid"
  | "completed-paid"
  | "cancelled"
  | "rescheduled";

export interface Teacher {
  id: Instrument;
  label: string;
  name: string;
}

export interface Settings {
  title: string;
  subtitle: string;
  weekStartsMon: boolean;
  dayStart: number;
  dayEnd: number;
}

export interface Lesson {
  id: string;
  teacher: Instrument;
  student: string;
  studentId?: string | null;
  recurrence: Recurrence;
  /** Present when recurrence === "weekly" */
  dow?: number;
  /** Present when recurrence === "once" */
  date?: string;
  start: string; // "HH:MM"
  mins: number;
  notes: string;
  sample?: boolean;
  /** "lessonId|date" of the booking this lesson was rescheduled from, if any */
  rescheduledFrom?: string;
}

export interface InstrumentRate {
  local: number;
  foreign: number;
}

export interface Package {
  id: string;
  label: string;
  instrument: Instrument;
  sessions: number;
  discount: number;
  localOnly: boolean;
  enabled: boolean;
}

export interface Rates {
  currency: string;
  symbol: string;
  perInstrument: Record<Instrument, InstrumentRate>;
  packages: Package[];
}

export interface Bill {
  id: string;
  date: string;
  student: string;
  studentId?: string | null;
  instrument: Instrument;
  clientType: ClientType;
  packageId?: string | null;
  sessions: number;
  unitRate: number;
  discount: number;
  paidAmount: number;
  notes: string;
  sample?: boolean;
}

export interface BillCalc {
  sub: number;
  disc: number;
  tot: number;
  paid: number;
  bal: number;
  status: BillStatus;
}

export interface Booking {
  status: BookingStatus;
  billId?: string | null;
  /** "lessonId|date" of the new occurrence, when status === "rescheduled" */
  rescheduledTo?: string;
}

export type Bookings = Record<string, Booking>;

export interface Student {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: number;
}

export interface UIState {
  view: View;
  filter: Instrument[];
  helpDismissed: boolean;
  billFilter: BillFilter;
  billMonth: string;
}

export interface AppState {
  v: number;
  settings: Settings;
  teachers: Teacher[];
  lessons: Lesson[];
  rates: Rates;
  bills: Bill[];
  bookings: Bookings;
  students: Student[];
  ui: UIState;
}

export interface AuthUser {
  email: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  role: Role | null;
}

export interface MemberRow {
  email: string;
  role: string;
  bootstrap: boolean;
}

/** window.LessonBookFB -- the bridge the firebase-client module exposes to app.ts. */
export interface LessonBookFB {
  signIn(): Promise<unknown>;
  signOut(): Promise<void>;
  onAuth(cb: (user: AuthUser | null) => void): () => void;
  roleFor(user: AuthUser | null): Promise<Role | null>;
  watch(name: string, cb: (data: Record<string, unknown> | null) => void): () => void;
  save(name: string, data: Record<string, unknown>): Promise<void>;
  listMembers(): Promise<MemberRow[]>;
  setMember(email: string, role: string): Promise<void>;
  removeMember(email: string): Promise<void>;
}
