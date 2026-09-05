import type {
  AppState,
  AuthState,
  Bill,
  BillCalc,
  BillFilter,
  BillStatus,
  Booking,
  Bookings,
  BookingStatus,
  ClientType,
  Instrument,
  Lesson,
  MemberRow,
  Package,
  Rates,
  Recurrence,
  Settings,
  Student,
  Teacher,
  View,
} from "./types";

(function () {
  "use strict";

  // ---- tiny typed DOM helpers ----
  function el<T extends Element = HTMLElement>(scope: ParentNode, sel: string): T {
    return scope.querySelector(sel) as T;
  }
  function els<T extends Element = HTMLElement>(scope: ParentNode, sel: string): NodeListOf<T> {
    return scope.querySelectorAll<T>(sel);
  }
  function val(scope: ParentNode, sel: string): string {
    return (el<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(scope, sel)).value;
  }
  function setVal(scope: ParentNode, sel: string, v: string | number): void {
    (el<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(scope, sel)).value = String(v);
  }
  function isChecked(scope: ParentNode, sel: string): boolean {
    return (el<HTMLInputElement>(scope, sel)).checked;
  }
  function attr(node: Element, name: string): string {
    return node.getAttribute(name) as string;
  }
  function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }

  const HOUR = 54;
  const TIDS: Instrument[] = ["piano", "guitar", "voice", "ukulele", "drums"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOWL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function pad(n: number): string {
    return (n < 10 ? "0" : "") + n;
  }
  function toMin(t: string): number {
    const p = String(t).split(":");
    return (+p[0]) * 60 + (+p[1] || 0);
  }
  function fromMin(v: number): string {
    v = Math.max(0, Math.min(1439, v));
    return pad(Math.floor(v / 60)) + ":" + pad(v % 60);
  }
  function fmt12(t: string): string {
    const p = String(t).split(":");
    const h = +p[0], m = +p[1] || 0;
    const ap = h < 12 ? "a" : "p";
    let hh = h % 12;
    if (hh === 0) hh = 12;
    return hh + (m ? ":" + pad(m) : "") + ap;
  }
  function fmtHour(h: number): string {
    const ap = h < 12 ? "a" : "p";
    let hh = h % 12;
    if (hh === 0) hh = 12;
    return hh + ap;
  }
  function iso(d: Date): string {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function esc(s: unknown): string {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" } as Record<string, string>)[c];
    });
  }
  function uid(): string {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
  }

  const DEFAULT: AppState = {
    v: 1,
    settings: { title: "The Lesson Book", subtitle: "Online music lessons · teaching schedule", weekStartsMon: true, dayStart: 9, dayEnd: 20 },
    teachers: TIDS.map(function (id) { return { id: id, label: id.charAt(0).toUpperCase() + id.slice(1), name: "" }; }),
    lessons: [],
    rates: {
      currency: "PHP", symbol: "₱",
      perInstrument: { piano: { local: 400, foreign: 600 }, guitar: { local: 500, foreign: 500 }, voice: { local: 0, foreign: 0 }, ukulele: { local: 0, foreign: 0 }, drums: { local: 600, foreign: 600 } },
      packages: [{ id: "piano12", label: "Piano · 12 sessions", instrument: "piano", sessions: 12, discount: 300, localOnly: true, enabled: true }],
    },
    bills: [],
    bookings: {},
    students: [],
    ui: { view: "week", filter: TIDS.slice(), helpDismissed: false, billFilter: "all", billMonth: "" },
  };
  const LSKEY = "lesson-book-v1";
  const VIEWS: View[] = ["week", "month", "billing", "students"];

  // ---- load state ----
  function loadState(): AppState {
    let raw: Partial<AppState> | null = null;
    try {
      raw = JSON.parse(document.getElementById("app-state")!.textContent!);
    } catch (e) {
      raw = null;
    }
    try {
      const ls = localStorage.getItem(LSKEY);
      if (ls) {
        const p = JSON.parse(ls) as Partial<AppState>;
        const embeddedIsSeed = !raw || !(raw.lessons || []).some(function (l) { return !l.sample; });
        if (p && p.lessons && embeddedIsSeed) raw = p;
      }
    } catch (e) {}
    if (!raw) raw = JSON.parse(JSON.stringify(DEFAULT));
    const s = raw as AppState;
    s.settings = Object.assign({}, DEFAULT.settings, s.settings || {});
    if (!Array.isArray(s.teachers) || s.teachers.length !== 5) s.teachers = JSON.parse(JSON.stringify(DEFAULT.teachers));
    if (!Array.isArray(s.lessons)) s.lessons = [];
    s.rates = s.rates || JSON.parse(JSON.stringify(DEFAULT.rates));
    s.rates.currency = s.rates.currency || "PHP";
    s.rates.symbol = s.rates.symbol || "₱";
    s.rates.perInstrument = Object.assign({}, DEFAULT.rates.perInstrument, s.rates.perInstrument || {});
    TIDS.forEach(function (id) { s.rates.perInstrument[id] = Object.assign({ local: 0, foreign: 0 }, s.rates.perInstrument[id] || {}); });
    if (!Array.isArray(s.rates.packages)) s.rates.packages = JSON.parse(JSON.stringify(DEFAULT.rates.packages));
    if (!Array.isArray(s.bills)) s.bills = [];
    if (!s.bookings || typeof s.bookings !== "object" || Array.isArray(s.bookings)) s.bookings = {};
    if (!Array.isArray(s.students)) s.students = [];
    s.ui = Object.assign({}, DEFAULT.ui, s.ui || {});
    if (!Array.isArray(s.ui.filter) || !s.ui.filter.length) s.ui.filter = TIDS.slice();
    if (VIEWS.indexOf(s.ui.view) < 0) s.ui.view = "week";
    return s;
  }

  const state = loadState();
  migrateStudentIds();

  const root = document.getElementById("root") as HTMLElement;

  // ---- auth & persistence ----
  const authState: AuthState = { user: null, role: null };
  function canEdit(): boolean { return authState.role === "admin" || authState.role === "scheduler"; }
  function isAdmin(): boolean { return authState.role === "admin"; }

  let saveT: ReturnType<typeof setTimeout> | null = null;
  let suspendRemote = false;
  function commit(): void {
    try { localStorage.setItem(LSKEY, JSON.stringify(state)); } catch (e) {}
    if (saveT) clearTimeout(saveT);
    saveT = setTimeout(pushRemote, 500);
  }
  function pushRemote(): void {
    if (!window.LessonBookFB || !canEdit()) return;
    suspendRemote = true;
    window.LessonBookFB.save("lessons", { lessons: state.lessons, bookings: state.bookings }).catch(function () {});
    window.LessonBookFB.save("billing", { bills: state.bills }).catch(function () {});
    window.LessonBookFB.save("students", { students: state.students }).catch(function () {});
    if (isAdmin()) window.LessonBookFB.save("settings", { settings: state.settings, teachers: state.teachers, rates: state.rates }).catch(function () {});
    setTimeout(function () { suspendRemote = false; }, 300);
  }
  function afterSync(): void {
    if (migrateStudentIds()) commit();
  }

  function startSync(): void {
    const fb = window.LessonBookFB!;
    fb.watch("lessons", function (data) {
      if (suspendRemote || overlay) return;
      if (data && Array.isArray(data.lessons)) {
        state.lessons = data.lessons as Lesson[];
        state.bookings = (data.bookings && typeof data.bookings === "object") ? (data.bookings as Bookings) : {};
        afterSync(); render();
      } else if (data === null && isAdmin()) {
        fb.save("lessons", { lessons: state.lessons, bookings: state.bookings }).catch(function () {});
      }
    });
    fb.watch("billing", function (data) {
      if (suspendRemote || overlay) return;
      if (data && Array.isArray(data.bills)) { state.bills = data.bills as Bill[]; afterSync(); render(); }
      else if (data === null && isAdmin()) { fb.save("billing", { bills: state.bills }).catch(function () {}); }
    });
    fb.watch("students", function (data) {
      if (suspendRemote || overlay) return;
      if (data && Array.isArray(data.students)) { state.students = data.students as Student[]; afterSync(); render(); }
      else if (data === null && isAdmin()) { fb.save("students", { students: state.students }).catch(function () {}); }
    });
    fb.watch("settings", function (data) {
      if (suspendRemote || overlay) return;
      if (data) {
        if (data.settings) state.settings = Object.assign({}, DEFAULT.settings, data.settings as Partial<Settings>);
        if (Array.isArray(data.teachers) && (data.teachers as Teacher[]).length === 5) state.teachers = data.teachers as Teacher[];
        if (data.rates) state.rates = data.rates as Rates;
        render();
      } else if (data === null && isAdmin()) {
        fb.save("settings", { settings: state.settings, teachers: state.teachers, rates: state.rates }).catch(function () {});
      }
    });
  }

  function showLoading(): void {
    root.innerHTML = "<div class=\"wrap\" style=\"max-width:420px;text-align:center;padding-top:18vh;color:var(--muted)\">Connecting&hellip;</div>";
  }
  function showSignedOut(): void {
    root.innerHTML = "<div class=\"wrap\" style=\"max-width:380px;text-align:center;padding-top:16vh\">"
      + "<h1 style=\"font-family:var(--f-disp);font-size:22px;margin-bottom:6px\">The Lesson Book</h1>"
      + "<p style=\"color:var(--muted);margin-bottom:18px\">Sign in with your studio Google account to view the schedule.</p>"
      + "<button class=\"btn primary\" id=\"signin-btn\">Sign in with Google</button>"
      + "</div>";
    el<HTMLButtonElement>(root, "#signin-btn").addEventListener("click", function () {
      window.LessonBookFB!.signIn().catch(function (e) { alert("Sign-in failed: " + errMsg(e)); });
    });
  }
  function showUnauthorized(email: string | null): void {
    root.innerHTML = "<div class=\"wrap\" style=\"max-width:380px;text-align:center;padding-top:16vh\">"
      + "<h1 style=\"font-family:var(--f-disp);font-size:22px;margin-bottom:6px\">Access needed</h1>"
      + "<p style=\"color:var(--muted);margin-bottom:18px\">Signed in as <b>" + esc(email) + "</b>, but this account isn't on the studio's access list. Ask the admin to add it under Settings &rsaquo; Manage access.</p>"
      + "<button class=\"btn\" id=\"signout-btn\">Sign out</button>"
      + "</div>";
    el<HTMLButtonElement>(root, "#signout-btn").addEventListener("click", function () { window.LessonBookFB!.signOut(); });
  }
  showLoading();
  window.addEventListener("lessonbook-fb-ready", function () {
    window.LessonBookFB!.onAuth(function (user) {
      authState.user = user;
      if (!user) { authState.role = null; showSignedOut(); return; }
      window.LessonBookFB!.roleFor(user).then(function (role) {
        authState.role = role;
        if (!role) { showUnauthorized(user.email); return; }
        startSync();
        render();
      });
    });
  });

  // ---- helpers over state ----
  function teacher(id: Instrument): Teacher {
    for (const t of state.teachers) if (t.id === id) return t;
    return { id: id, label: id, name: "" };
  }
  function tlabel(id: Instrument): string { const t = teacher(id); return t.label + (t.name ? " · " + t.name : ""); }
  function visible(l: Lesson): boolean { return state.ui.filter.indexOf(l.teacher) >= 0; }
  function cols(): number[] { return state.settings.weekStartsMon ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]; }
  function tvars(id: Instrument): string { return "--c:var(--" + id + ");--cb:var(--" + id + "-bg);--ci:var(--" + id + "-ink)"; }

  // ---- billing helpers ----
  function money(n: number): string { n = Math.round(+n || 0); return (state.rates.symbol || "₱") + n.toLocaleString("en-US"); }
  function rateFor(inst: Instrument, type: ClientType): number { const r = state.rates.perInstrument[inst] || { local: 0, foreign: 0 }; return +(type === "foreign" ? r.foreign : r.local) || 0; }
  function pkgsFor(inst: Instrument, type: ClientType): Package[] { return (state.rates.packages || []).filter(function (p) { return p.enabled && p.instrument === inst && (!p.localOnly || type === "local"); }); }
  function pkgById(id: string | null | undefined): Package | null { for (const p of (state.rates.packages || [])) if (p.id === id) return p; return null; }
  function billCalc(b: Bill): BillCalc {
    const sub = (+b.sessions || 0) * (+b.unitRate || 0);
    const disc = Math.max(0, +b.discount || 0);
    const tot = Math.max(0, sub - disc);
    const paid = Math.max(0, +b.paidAmount || 0);
    const status: BillStatus = (tot > 0 && paid >= tot) ? "paid" : (paid > 0 ? "partial" : "unpaid");
    return { sub: sub, disc: disc, tot: tot, paid: paid, bal: Math.max(0, tot - paid), status: status };
  }
  function findBill(id: string | null): Bill | null { for (const b of state.bills) if (b.id === id) return b; return null; }
  function instOpts(sel: Instrument): string {
    let o = "";
    state.teachers.forEach(function (t) { o += "<option value=\"" + t.id + "\"" + (t.id === sel ? " selected" : "") + ">" + esc(tlabel(t.id)) + "</option>"; });
    return o;
  }

  // ---- booking status ----
  const STATUSES: Record<BookingStatus, { label: string; dot?: string; strike?: boolean }> = {
    "booked": { label: "Booked" },
    "in-progress": { label: "In progress", dot: "var(--st-progress)" },
    "completed-unpaid": { label: "Completed · unpaid", dot: "var(--st-unpaid)" },
    "completed-paid": { label: "Completed · paid", dot: "var(--st-paid)" },
    "cancelled": { label: "Cancelled", dot: "var(--st-cancel)", strike: true },
    "rescheduled": { label: "Rescheduled", dot: "var(--st-resched)", strike: true },
  };
  function bkey(lessonId: string, date: string): string { return lessonId + "|" + date; }
  function bookingFor(lessonId: string, date: string): Booking {
    const base: Booking = { status: "booked", billId: null };
    return Object.assign(base, state.bookings[bkey(lessonId, date)]);
  }
  function setBooking(lessonId: string, date: string, patch: Partial<Booking>): void {
    const k = bkey(lessonId, date);
    const base: Booking = { status: "booked", billId: null };
    state.bookings[k] = Object.assign(base, state.bookings[k], patch);
  }
  function billsForStudent(studentId: string | null | undefined, excludeId?: string | null): Bill[] {
    return state.bills.filter(function (b) { return b.studentId === studentId && b.id !== excludeId && billCalc(b).status !== "paid"; });
  }
  // Only auto-advances completed-unpaid -> completed-paid when the linked bill is
  // fully paid. Never touches booked/in-progress/cancelled/rescheduled -- a
  // pre-paid package must not fake-complete sessions that haven't happened yet.
  function syncBookingsForBill(bill: Bill | null): void {
    if (!bill || billCalc(bill).status !== "paid") return;
    Object.keys(state.bookings).forEach(function (k) {
      const bk = state.bookings[k];
      if (bk.billId === bill.id && bk.status === "completed-unpaid") bk.status = "completed-paid";
    });
  }

  // ---- students ----
  function studentById(id: string | null): Student | null { for (const s of state.students) if (s.id === id) return s; return null; }
  function ensureStudentId(name: string | null | undefined): string | null {
    name = (name || "").trim();
    if (!name) return null;
    const lname = name.toLowerCase();
    for (const s of state.students) if (s.name.trim().toLowerCase() === lname) return s.id;
    const rec: Student = { id: uid(), name: name, phone: "", notes: "", createdAt: Date.now() };
    state.students.push(rec);
    return rec.id;
  }
  function migrateStudentIds(): boolean {
    let changed = false;
    state.lessons.forEach(function (l) { if (l.student && !l.studentId) { l.studentId = ensureStudentId(l.student); changed = true; } });
    state.bills.forEach(function (b) { if (b.student && !b.studentId) { b.studentId = ensureStudentId(b.student); changed = true; } });
    return changed;
  }
  function studentDatalist(id: string): string {
    return "<datalist id=\"" + id + "\">" + state.students.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (s) { return "<option value=\"" + esc(s.name) + "\">"; }).join("") + "</datalist>";
  }

  let cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  // ---- week layout (overlap lanes) ----
  interface LayoutItem { l: Lesson; s: number; e: number; lane?: number; lanes?: number; }
  function layout(items: LayoutItem[]): LayoutItem[] {
    items.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    let i = 0;
    while (i < items.length) {
      const group = [items[i]];
      let maxEnd = items[i].e;
      let j = i + 1;
      while (j < items.length && items[j].s < maxEnd) { group.push(items[j]); if (items[j].e > maxEnd) maxEnd = items[j].e; j++; }
      const lanes: number[] = [];
      group.forEach(function (it) {
        let placed = false;
        for (let k = 0; k < lanes.length; k++) { if (lanes[k] <= it.s) { it.lane = k; lanes[k] = it.e; placed = true; break; } }
        if (!placed) { it.lane = lanes.length; lanes.push(it.e); }
      });
      group.forEach(function (it) { it.lanes = lanes.length; });
      i = j;
    }
    return items;
  }

  function itemsFor(d: Date): Lesson[] {
    const ds = iso(d), dw = d.getDay();
    return state.lessons.filter(function (l) {
      if (!visible(l)) return false;
      return l.recurrence === "weekly" ? l.dow === dw : l.date === ds;
    }).sort(function (a, b) { return toMin(a.start) - toMin(b.start); });
  }

  // ---- rendering ----
  function render(): void {
    const s = state.settings;
    const view = state.ui.view;
    const hasSamples = state.lessons.some(function (l) { return l.sample; }) || state.bills.some(function (b) { return b.sample; });
    const showHelp = hasSamples && !state.ui.helpDismissed;
    const allOn = state.ui.filter.length === 5;

    let h = "";
    h += "<div class=\"wrap\">";
    h += "<header class=\"hd\">";
    h += "<div class=\"brand\"><h1>" + esc(s.title || "The Lesson Book") + "</h1><p>" + esc(s.subtitle || "") + "</p></div>";
    h += "<div class=\"hd-actions\">";
    if (canEdit()) {
      h += (view === "billing" ? "<button class=\"btn primary\" data-act=\"new-bill\">+ New bill</button>"
        : view === "students" ? "<button class=\"btn primary\" data-act=\"add-student\">+ Add student</button>"
        : "<button class=\"btn primary\" data-act=\"add\">+ Add lesson</button>");
    }
    if (isAdmin()) h += "<button class=\"btn icon\" data-act=\"settings\" aria-label=\"Settings\" title=\"Teachers &amp; settings\">&#9881;</button>";
    h += "<button class=\"btn icon\" data-act=\"print\" aria-label=\"Print\" title=\"Print\">&#9113;</button>";
    h += "<button class=\"btn ghost\" data-act=\"signout\" title=\"" + esc((authState.user && authState.user.email) || "") + " (" + esc(authState.role || "") + ")\">Sign out</button>";
    h += "</div>";
    h += "</header>";

    if (showHelp) {
      h += "<div class=\"help\">";
      h += "<span><b>Sample data</b> is shown so you can see the layout. Click any item to edit it, or add your own.</span>";
      h += "<span class=\"spacer\"></span>";
      h += "<button class=\"linkish\" data-act=\"clear-samples\">Delete all samples</button>";
      h += "<button class=\"btn ghost\" data-act=\"dismiss-help\" aria-label=\"Dismiss\">&times;</button>";
      h += "</div>";
    }

    h += "<div class=\"bar\">";
    h += "<div class=\"seg\" role=\"tablist\" aria-label=\"View\">";
    h += "<button role=\"tab\" aria-selected=\"" + (view === "week") + "\" data-act=\"view\" data-v=\"week\">Week</button>";
    h += "<button role=\"tab\" aria-selected=\"" + (view === "month") + "\" data-act=\"view\" data-v=\"month\">Month</button>";
    h += "<button role=\"tab\" aria-selected=\"" + (view === "billing") + "\" data-act=\"view\" data-v=\"billing\">Billing</button>";
    h += "<button role=\"tab\" aria-selected=\"" + (view === "students") + "\" data-act=\"view\" data-v=\"students\">Students</button>";
    h += "</div>";

    if (view === "month") {
      h += "<div class=\"nav\">";
      h += "<button class=\"btn ghost arw\" data-act=\"mprev\" aria-label=\"Previous month\">&#8249;</button>";
      h += "<strong>" + cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) + "</strong>";
      h += "<button class=\"btn ghost arw\" data-act=\"mnext\" aria-label=\"Next month\">&#8250;</button>";
      h += "<button class=\"btn ghost today-btn\" data-act=\"today\">Today</button>";
      h += "</div>";
    } else if (view === "billing") {
      h += "<div class=\"bfilter\">";
      (["all", "unpaid", "partial", "paid"] as BillFilter[]).forEach(function (f) {
        h += "<button class=\"chip sf\" data-act=\"bfilter\" data-f=\"" + f + "\" aria-pressed=\"" + (state.ui.billFilter === f) + "\">" + f + "</button>";
      });
      const months: Record<string, 1> = {};
      state.bills.forEach(function (b) { if (b.date) months[b.date.slice(0, 7)] = 1; });
      const mk = Object.keys(months).sort().reverse();
      if (mk.length) {
        h += "<select id=\"bmonth\"><option value=\"\">All months</option>";
        mk.forEach(function (m) {
          const lbl = new Date(m + "-01T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" });
          h += "<option value=\"" + m + "\"" + (state.ui.billMonth === m ? " selected" : "") + ">" + lbl + "</option>";
        });
        h += "</select>";
      }
      h += "</div>";
      if (isAdmin()) h += "<div class=\"bill-actions\"><button class=\"btn\" data-act=\"reports\">Reports</button><button class=\"btn\" data-act=\"rates\">Rates &amp; packages</button></div>";
    } else if (view === "students") {
      h += "<div class=\"wk-cap\">" + state.students.length + " student" + (state.students.length === 1 ? "" : "s") + "</div>";
    } else {
      h += "<div class=\"wk-cap\">Standing weekly schedule</div>";
    }

    if (view === "week" || view === "month") {
      h += "<div class=\"chips\">";
      h += "<button class=\"chip all\" data-act=\"filter-all\" aria-pressed=\"" + allOn + "\">All teachers</button>";
      state.teachers.forEach(function (t) {
        const on = state.ui.filter.indexOf(t.id) >= 0;
        h += "<button class=\"chip\" data-act=\"filter\" data-id=\"" + t.id + "\" aria-pressed=\"" + on + "\" style=\"" + tvars(t.id) + "\"><span class=\"dot\"></span>" + esc(tlabel(t.id)) + "</button>";
      });
      h += "</div>";
    }
    h += "</div>";

    h += "<div id=\"view\">" + (view === "week" ? weekHTML() : view === "month" ? monthHTML() : view === "students" ? studentsHTML() : billingHTML()) + "</div>";
    h += "</div>";
    root.innerHTML = h;
    bind();
  }

  function weekHTML(): string {
    const s = state.settings, ds = s.dayStart, de = s.dayEnd;
    const hrs = Math.max(1, de - ds);
    const C = cols();
    let out = "<div class=\"scroll\"><div class=\"wk\" style=\"--hour:" + HOUR + "px\">";
    out += "<div class=\"wk-head\"><div class=\"cnr\"></div>";
    C.forEach(function (dw) { out += "<div class=\"wk-dh\">" + DOW[dw] + "</div>"; });
    out += "</div>";
    out += "<div class=\"wk-body\" style=\"height:" + (hrs * HOUR) + "px\">";
    out += "<div class=\"gutter\">";
    for (let hh = ds; hh < de; hh++) { out += "<div class=\"hl\" style=\"top:" + ((hh - ds) * HOUR) + "px\">" + fmtHour(hh) + "</div>"; }
    out += "</div>";
    let total = 0;
    C.forEach(function (dw) {
      out += "<div class=\"daycol\" data-dw=\"" + dw + "\">";
      const its: LayoutItem[] = state.lessons.filter(function (l) { return visible(l) && l.recurrence === "weekly" && l.dow === dw; })
        .map(function (l) { const st = toMin(l.start); return { l: l, s: st, e: st + (l.mins || 30) }; });
      layout(its);
      total += its.length;
      its.forEach(function (it) {
        const l = it.l;
        const top = Math.max(0, (it.s - ds * 60) / 60 * HOUR);
        const hgt = Math.max(16, (it.e - it.s) / 60 * HOUR - 2);
        const w = 100 / (it.lanes as number), left = (it.lane as number) * w;
        const style = tvars(l.teacher) + ";top:" + top.toFixed(1) + "px;height:" + hgt.toFixed(1) + "px;left:" + left + "%;width:calc(" + w + "% - 4px)";
        out += "<button class=\"ev" + (hgt < 40 ? " short" : "") + "\" data-act=\"edit\" data-id=\"" + l.id + "\" style=\"" + style + "\">";
        out += "<span class=\"ev-t\">" + fmt12(l.start) + "</span><span class=\"ev-s\">" + esc(l.student || "(no name)") + "</span>";
        if (hgt > 44 && l.notes) out += "<span class=\"ev-n\">" + esc(l.notes) + "</span>";
        out += "</button>";
      });
      out += "</div>";
    });
    out += "</div></div></div>";
    if (total === 0) out += "<div class=\"empty\"><h3>No weekly lessons yet</h3><p>Click a time slot above, or use &ldquo;+ Add lesson&rdquo;. One-time lessons show up in Month view.</p></div>";
    return out;
  }

  function monthHTML(): string {
    const C = cols();
    const first = new Date(cursor);
    const startIdx = C.indexOf(first.getDay());
    const start = new Date(first); start.setDate(first.getDate() - startIdx);
    const todayIso = iso(new Date());
    const mo = cursor.getMonth();
    let out = "<div class=\"scroll\"><div class=\"mo\">";
    out += "<div class=\"mo-head\">";
    C.forEach(function (dw) { out += "<div>" + DOWL[dw] + "</div>"; });
    out += "</div><div class=\"mo-grid\">";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const di = iso(d);
      const cls = "mo-cell" + (d.getMonth() !== mo ? " out" : "") + (di === todayIso ? " today" : "");
      out += "<div class=\"" + cls + "\" data-act=\"day\" data-date=\"" + di + "\">";
      out += "<span class=\"mo-d\">" + d.getDate() + "</span>";
      const its = itemsFor(d);
      its.slice(0, 3).forEach(function (l) {
        const bk = bookingFor(l.id, di), st = STATUSES[bk.status] || STATUSES.booked;
        out += "<button class=\"pill" + (st.strike ? " strike" : "") + "\" data-act=\"booking\" data-id=\"" + l.id + "\" data-date=\"" + di + "\" style=\"" + tvars(l.teacher) + "\"><span class=\"pdot\"></span><span class=\"pt\">" + fmt12(l.start) + "</span><span class=\"ps\">" + esc(l.student || "(no name)") + "</span>" + (st.dot ? "<span class=\"sdot\" style=\"--sc:" + st.dot + "\" title=\"" + esc(st.label) + "\"></span>" : "") + "</button>";
      });
      if (its.length > 3) out += "<button class=\"more\" data-act=\"day\" data-date=\"" + di + "\">+" + (its.length - 3) + " more</button>";
      out += "</div>";
    }
    out += "</div></div></div>";
    return out;
  }

  // ---- billing ----
  function billingHTML(): string {
    const f = state.ui.billFilter || "all", mm = state.ui.billMonth || "";
    const rows = state.bills.slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "") || (String(b.id) < String(a.id) ? -1 : 1);
    });
    const shown = rows.filter(function (b) {
      const c = billCalc(b);
      if (f !== "all" && c.status !== f) return false;
      if (mm && (b.date || "").slice(0, 7) !== mm) return false;
      return true;
    });
    let billed = 0, collected = 0;
    shown.forEach(function (b) { const c = billCalc(b); billed += c.tot; collected += Math.min(c.paid, c.tot); });

    let out = "";
    out += "<div class=\"stats\">";
    out += "<div class=\"stat\"><div class=\"k\">Billed</div><div class=\"v\">" + money(billed) + "</div></div>";
    out += "<div class=\"stat coll\"><div class=\"k\">Collected</div><div class=\"v\">" + money(collected) + "</div></div>";
    out += "<div class=\"stat out\"><div class=\"k\">Outstanding</div><div class=\"v\">" + money(billed - collected) + "</div></div>";
    out += "</div>";

    if (!state.bills.length) {
      out += "<div class=\"empty\"><h3>No bills yet</h3><p>Click &ldquo;+ New bill&rdquo; to record a student's lessons and payment. Rates come from &ldquo;Rates &amp; packages&rdquo;.</p></div>";
      return out;
    }

    out += "<div class=\"tbl-wrap\"><table class=\"tbl\"><thead><tr>";
    out += "<th>Date</th><th>Student</th><th>Lessons</th><th class=\"num\">Qty</th><th class=\"num\">Rate</th><th class=\"num\">Discount</th><th class=\"num\">Total</th><th class=\"num\">Paid</th><th class=\"num\">Balance</th><th>Status</th><th></th>";
    out += "</tr></thead><tbody>";
    shown.forEach(function (b) {
      const c = billCalc(b), t = teacher(b.instrument), pk = b.packageId ? pkgById(b.packageId) : null;
      out += "<tr data-act=\"edit-bill\" data-id=\"" + b.id + "\">";
      out += "<td class=\"dt\">" + esc(b.date || "") + "</td>";
      out += "<td class=\"stu\">" + esc(b.student || "—") + "</td>";
      out += "<td><span class=\"lz\" style=\"--c:var(--" + b.instrument + ")\"><span class=\"dot\"></span>" + esc(t.label) + "</span>"
        + "<span class=\"badge\">" + (b.clientType === "foreign" ? "Abroad" : "Local") + "</span>"
        + (pk ? "<span class=\"badge pack\">" + (+pk.sessions) + "-pack</span>" : "") + "</td>";
      out += "<td class=\"num\">" + (+b.sessions || 0) + "</td>";
      out += "<td class=\"num\">" + money(b.unitRate) + "</td>";
      out += "<td class=\"num\">" + (c.disc > 0 ? "&minus;" + money(c.disc) : "&mdash;") + "</td>";
      out += "<td class=\"num\">" + money(c.tot) + "</td>";
      out += "<td class=\"num\">" + money(Math.min(c.paid, c.tot)) + "</td>";
      out += "<td class=\"num\">" + money(c.bal) + "</td>";
      out += "<td><span class=\"pill-s " + c.status + "\">" + c.status + "</span></td>";
      out += "<td>" + (c.status !== "paid" && canEdit() ? "<button class=\"mini\" data-act=\"mark-paid\" data-id=\"" + b.id + "\">Mark paid</button> " : "") + "<button class=\"mini\" data-act=\"invoice\" data-id=\"" + b.id + "\">" + (c.bal <= 0 ? "Receipt" : "Invoice") + "</button></td>";
      out += "</tr>";
    });
    out += "</tbody></table></div>";
    if (!shown.length) out += "<p class=\"hint\">No bills match this filter.</p>";
    return out;
  }

  // ---- students view ----
  function outstandingForStudent(id: string): number {
    return state.bills.filter(function (b) { return b.studentId === id; }).reduce(function (sum, b) { return sum + billCalc(b).bal; }, 0);
  }
  function studentsHTML(): string {
    const list = state.students.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    let out = "<div class=\"fld\" style=\"max-width:280px;margin-bottom:14px\"><input id=\"stu-search\" type=\"text\" placeholder=\"Search students…\"></div>";
    if (!list.length) {
      out += "<div class=\"empty\"><h3>No students yet</h3><p>They show up automatically once you add a lesson or bill, or click &ldquo;+ Add student&rdquo; to add one ahead of time.</p></div>";
      return out;
    }
    out += "<div class=\"tbl-wrap\"><table class=\"tbl\"><thead><tr><th>Student</th><th class=\"num\">Bookings</th><th class=\"num\">Outstanding</th></tr></thead><tbody>";
    list.forEach(function (s) {
      const lessonCount = state.lessons.filter(function (l) { return l.studentId === s.id; }).length;
      const bal = outstandingForStudent(s.id);
      out += "<tr class=\"stu-row\" data-act=\"student\" data-id=\"" + s.id + "\" data-name=\"" + esc(s.name.toLowerCase()) + "\">";
      out += "<td class=\"stu\">" + esc(s.name) + (s.phone ? "<span class=\"badge\">" + esc(s.phone) + "</span>" : "") + "</td>";
      out += "<td class=\"num\">" + lessonCount + "</td>";
      out += "<td class=\"num\">" + (bal > 0 ? money(bal) : "&mdash;") + "</td>";
      out += "</tr>";
    });
    out += "</tbody></table></div>";
    return out;
  }

  // ---- events ----
  function bind(): void {
    root.querySelectorAll<HTMLElement>("[data-act]").forEach(function (node) {
      node.addEventListener("click", onAct);
    });
    const bm = root.querySelector<HTMLSelectElement>("#bmonth");
    if (bm) bm.addEventListener("change", function () { state.ui.billMonth = bm.value; commit(); render(); });
    const stq = root.querySelector<HTMLInputElement>("#stu-search");
    if (stq) stq.addEventListener("input", function () {
      const q = stq.value.trim().toLowerCase();
      root.querySelectorAll<HTMLElement>(".stu-row").forEach(function (row) {
        row.hidden = !!q && (row.getAttribute("data-name") || "").indexOf(q) < 0;
      });
    });
    root.querySelectorAll<HTMLElement>(".daycol").forEach(function (col) {
      col.addEventListener("click", function (e) {
        if (!canEdit()) return;
        if ((e.target as HTMLElement).closest(".ev")) return;
        const rect = col.getBoundingClientRect();
        const y = (e as MouseEvent).clientY - rect.top;
        const raw = state.settings.dayStart * 60 + y / HOUR * 60;
        let mins = Math.round(raw / 15) * 15;
        mins = Math.max(state.settings.dayStart * 60, Math.min(mins, state.settings.dayEnd * 60 - 30));
        openLesson(null, { recurrence: "weekly", dow: +attr(col, "data-dw"), start: fromMin(mins) });
      });
    });
  }

  function onAct(e: Event): void {
    const node = e.currentTarget as HTMLElement, act = node.getAttribute("data-act");
    if (act !== "day") e.stopPropagation();
    if (act === "add") { if (canEdit()) openLesson(null, null); }
    else if (act === "edit") { const l = find(node.getAttribute("data-id")); if (l) openLesson(l, null); }
    else if (act === "booking") { const bl = find(node.getAttribute("data-id")); if (bl) openBooking(bl, attr(node, "data-date")); }
    else if (act === "view") { state.ui.view = attr(node, "data-v") as View; commit(); render(); }
    else if (act === "mprev") { cursor.setMonth(cursor.getMonth() - 1); render(); }
    else if (act === "mnext") { cursor.setMonth(cursor.getMonth() + 1); render(); }
    else if (act === "today") { cursor = new Date(); cursor.setDate(1); cursor.setHours(0, 0, 0, 0); render(); }
    else if (act === "filter-all") { state.ui.filter = state.ui.filter.length === 5 ? [] : TIDS.slice(); if (!state.ui.filter.length) state.ui.filter = TIDS.slice(); commit(); render(); }
    else if (act === "filter") {
      const id = attr(node, "data-id") as Instrument, k = state.ui.filter.indexOf(id);
      if (k >= 0) state.ui.filter.splice(k, 1); else state.ui.filter.push(id);
      if (!state.ui.filter.length) state.ui.filter = TIDS.slice();
      commit(); render();
    }
    else if (act === "settings") { if (isAdmin()) openSettings(); }
    else if (act === "print") { window.print(); }
    else if (act === "signout") { window.LessonBookFB!.signOut(); }
    else if (act === "dismiss-help") { state.ui.helpDismissed = true; commit(); render(); }
    else if (act === "clear-samples") {
      if (!canEdit()) return;
      state.lessons = state.lessons.filter(function (l) { return !l.sample; });
      state.bills = state.bills.filter(function (b) { return !b.sample; });
      commit(); render();
    }
    else if (act === "day") { openDay(attr(node, "data-date")); }
    else if (act === "new-bill") { if (canEdit()) openBill(null, null); }
    else if (act === "edit-bill") { const b = findBill(node.getAttribute("data-id")); if (b) openBill(b, null); }
    else if (act === "invoice") { const ib = findBill(node.getAttribute("data-id")); if (ib) openInvoice(ib); }
    else if (act === "mark-paid") { if (canEdit()) { const mb = findBill(node.getAttribute("data-id")); if (mb) { mb.paidAmount = billCalc(mb).tot; syncBookingsForBill(mb); commit(); render(); } } }
    else if (act === "bfilter") { state.ui.billFilter = attr(node, "data-f") as BillFilter; commit(); render(); }
    else if (act === "rates") { if (isAdmin()) openRates(); }
    else if (act === "reports") { if (isAdmin()) openReports(); }
    else if (act === "add-student") { if (canEdit()) openStudentForm(null); }
    else if (act === "student") { openStudentDetail(attr(node, "data-id")); }
  }

  function find(id: string | null): Lesson | null { for (const l of state.lessons) if (l.id === id) return l; return null; }

  // ---- modal shell ----
  let overlay: HTMLDivElement | null = null;
  function modal(html: string): HTMLElement {
    close();
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = "<div class=\"modal\" role=\"dialog\" aria-modal=\"true\">" + html + "</div>";
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    const f = overlay.querySelector<HTMLElement>("input,select,textarea,button");
    if (f) f.focus();
    return overlay.querySelector<HTMLElement>(".modal")!;
  }
  function close(): void {
    if (overlay) { overlay.remove(); overlay = null; document.removeEventListener("keydown", onKey); }
  }
  function onKey(e: KeyboardEvent): void { if (e.key === "Escape") close(); }
  function printDoc(): void {
    document.body.classList.add("printing-doc");
    function done() { document.body.classList.remove("printing-doc"); window.removeEventListener("afterprint", done); }
    window.addEventListener("afterprint", done);
    window.print();
  }

  // ---- lesson modal ----
  interface LessonPrefill {
    teacher?: Instrument;
    recurrence?: Recurrence;
    dow?: number;
    date?: string;
    start?: string;
  }
  function openLessonReadOnly(l: Lesson): void {
    let h = "<h2>" + esc(l.student || "(no name)") + "</h2>";
    h += "<div class=\"fld\"><label>Instrument / teacher</label><div>" + esc(tlabel(l.teacher)) + "</div></div>";
    h += "<div class=\"fld\"><label>When</label><div>" + (l.recurrence === "weekly" ? "Every " + DOWL[l.dow as number] : new Date(l.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })) + " &middot; " + fmt12(l.start) + " (" + (l.mins || 60) + " min)</div></div>";
    if (l.notes) h += "<div class=\"fld\"><label>Notes</label><div>" + esc(l.notes) + "</div></div>";
    h += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"ro-close\">Close</button></div>";
    const m = modal(h);
    el<HTMLButtonElement>(m, "#ro-close").addEventListener("click", close);
  }
  function openLesson(existing: Lesson | null, prefill: LessonPrefill | null): void {
    if (existing && !canEdit()) { openLessonReadOnly(existing); return; }
    const l: Lesson = existing ? (JSON.parse(JSON.stringify(existing)) as Lesson) : {
      id: "", teacher: (prefill && prefill.teacher) || state.ui.filter[0] || "piano",
      student: "", recurrence: (prefill && prefill.recurrence) || "weekly",
      dow: (prefill && prefill.dow != null) ? prefill.dow : 1,
      date: (prefill && prefill.date) || iso(new Date()),
      start: (prefill && prefill.start) || "15:00", mins: 60, notes: "",
    };
    const C = cols();
    let h = "";
    h += "<h2>" + (existing ? "Edit lesson" : "New lesson") + "</h2>";
    h += "<div class=\"err\" id=\"lerr\" hidden></div>";
    h += "<div class=\"fld\"><label for=\"f-t\">Instrument / teacher</label><select id=\"f-t\">";
    state.teachers.forEach(function (t) { h += "<option value=\"" + t.id + "\"" + (t.id === l.teacher ? " selected" : "") + ">" + esc(tlabel(t.id)) + "</option>"; });
    h += "</select></div>";
    h += "<div class=\"fld\"><label for=\"f-s\">Student name</label><input id=\"f-s\" type=\"text\" list=\"f-names\" value=\"" + esc(l.student) + "\" placeholder=\"e.g. Mia Reyes\" autocomplete=\"off\"></div>" + studentDatalist("f-names");
    h += "<div class=\"fld\"><label>Repeats</label><div class=\"rep\">";
    h += "<button type=\"button\" data-rep=\"weekly\" aria-pressed=\"" + (l.recurrence === "weekly") + "\">Every week</button>";
    h += "<button type=\"button\" data-rep=\"once\" aria-pressed=\"" + (l.recurrence === "once") + "\">One time</button>";
    h += "</div></div>";
    h += "<div class=\"fld\" id=\"wrap-dow\"" + (l.recurrence === "once" ? " hidden" : "") + "><label for=\"f-d\">Day of week</label><select id=\"f-d\">";
    C.forEach(function (dw) { h += "<option value=\"" + dw + "\"" + (dw === l.dow ? " selected" : "") + ">" + DOWL[dw] + "</option>"; });
    h += "</select></div>";
    h += "<div class=\"fld\" id=\"wrap-date\"" + (l.recurrence === "weekly" ? " hidden" : "") + "><label for=\"f-date\">Date</label><input id=\"f-date\" type=\"date\" value=\"" + esc(l.date) + "\"></div>";
    h += "<div class=\"row2\">";
    h += "<div class=\"fld\"><label for=\"f-start\">Start time</label><input id=\"f-start\" type=\"time\" step=\"300\" value=\"" + esc(l.start) + "\"></div>";
    h += "<div class=\"fld\"><label for=\"f-len\">Length</label><select id=\"f-len\">";
    [60, 30, 45, 90, 15].forEach(function (m) { h += "<option value=\"" + m + "\"" + (m === (l.mins || 60) ? " selected" : "") + ">" + m + " min" + (m === 60 ? " (1 hr)" : "") + "</option>"; });
    h += "</select></div></div>";
    h += "<div class=\"fld\"><label for=\"f-n\">Notes <span style=\"text-transform:none;letter-spacing:0\">(optional)</span></label><textarea id=\"f-n\" placeholder=\"Level, focus, parent contact…\">" + esc(l.notes) + "</textarea></div>";
    h += "<div class=\"m-act\">";
    if (existing) h += "<button class=\"btn danger\" id=\"f-del\">Delete</button>";
    h += "<span class=\"grow\"></span><button class=\"btn\" id=\"f-cancel\">Cancel</button><button class=\"btn primary\" id=\"f-save\">" + (existing ? "Save" : "Add lesson") + "</button>";
    h += "</div>";

    const m = modal(h);
    let rec: Recurrence = l.recurrence;
    els<HTMLButtonElement>(m, "[data-rep]").forEach(function (b) {
      b.addEventListener("click", function () {
        rec = attr(b, "data-rep") as Recurrence;
        els<HTMLButtonElement>(m, "[data-rep]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        el<HTMLElement>(m, "#wrap-dow").hidden = rec !== "weekly";
        el<HTMLElement>(m, "#wrap-date").hidden = rec !== "once";
      });
    });
    el<HTMLButtonElement>(m, "#f-cancel").addEventListener("click", close);
    if (existing) {
      const delBtn = el<HTMLButtonElement>(m, "#f-del");
      delBtn.addEventListener("click", function () {
        if (delBtn.getAttribute("data-armed")) { state.lessons = state.lessons.filter(function (x) { return x.id !== l.id; }); commit(); close(); render(); }
        else { delBtn.setAttribute("data-armed", "1"); delBtn.textContent = "Click again to delete"; }
      });
    }
    el<HTMLButtonElement>(m, "#f-save").addEventListener("click", function () {
      const teacherId = val(m, "#f-t") as Instrument;
      const student = val(m, "#f-s").trim();
      const start = val(m, "#f-start");
      const mins = +val(m, "#f-len");
      const notes = val(m, "#f-n").trim();
      const err = el<HTMLElement>(m, "#lerr");
      if (!student) { err.textContent = "Please enter the student's name."; err.hidden = false; el<HTMLInputElement>(m, "#f-s").focus(); return; }
      if (!start) { err.textContent = "Please choose a start time."; err.hidden = false; return; }
      const rowset: Lesson = {
        id: existing ? l.id : uid(),
        teacher: teacherId, student: student, studentId: ensureStudentId(student),
        recurrence: rec, start: start, mins: mins, notes: notes,
      };
      if (rec === "weekly") { rowset.dow = +val(m, "#f-d"); }
      else {
        const dv = val(m, "#f-date");
        if (!dv) { err.textContent = "Please choose a date."; err.hidden = false; return; }
        rowset.date = dv;
      }
      if (existing) {
        const cur = find(l.id);
        if (cur) {
          Object.assign(cur, rowset);
          if (rec === "weekly") delete cur.date; else delete cur.dow;
          delete cur.sample;
        }
      } else {
        state.lessons.push(rowset);
      }
      commit(); close();
      if (rec === "once" && rowset.date) { cursor = new Date(rowset.date + "T00:00:00"); cursor.setDate(1); }
      render();
    });
  }

  // ---- booking modal (a dated occurrence: status + billing) ----
  interface MovedTo { date: string; lesson: Lesson; }
  function openBooking(l: Lesson, dateIso: string): void {
    const bk = bookingFor(l.id, dateIso);
    const st = STATUSES[bk.status] || STATUSES.booked;
    const bill = bk.billId ? findBill(bk.billId) : null;
    const whenStr = new Date(dateIso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + " &middot; " + fmt12(l.start) + " (" + (l.mins || 60) + " min)";
    let movedTo: MovedTo | null = null;
    if (bk.status === "rescheduled" && bk.rescheduledTo) {
      const parts = bk.rescheduledTo.split("|"), newDate = parts[1], newL = find(parts[0]);
      if (newL) movedTo = { date: newDate, lesson: newL };
    }

    if (!canEdit()) {
      let hr = "<h2>" + esc(l.student || "(no name)") + "</h2>";
      hr += "<div class=\"fld\"><label>Instrument / teacher</label><div>" + esc(tlabel(l.teacher)) + "</div></div>";
      hr += "<div class=\"fld\"><label>When</label><div>" + whenStr + "</div></div>";
      hr += "<div class=\"fld\"><label>Status</label><div class=\"stbadge\">" + (st.dot ? "<span class=\"sdot\" style=\"--sc:" + st.dot + "\"></span>" : "") + esc(st.label) + "</div></div>";
      if (movedTo) hr += "<p class=\"hint\">Moved to " + new Date(movedTo.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " at " + fmt12(movedTo.lesson.start) + ".</p>";
      if (l.notes) hr += "<div class=\"fld\"><label>Notes</label><div>" + esc(l.notes) + "</div></div>";
      if (bill) {
        const cr = billCalc(bill);
        hr += "<div class=\"bmini\"><div class=\"r\"><span>Total</span><span>" + money(cr.tot) + "</span></div><div class=\"r\"><span>Paid</span><span>" + money(cr.paid) + "</span></div><div class=\"r\"><span>Balance</span><span>" + money(cr.bal) + "</span></div></div>";
      }
      hr += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"ro-close\">Close</button></div>";
      const mr = modal(hr);
      el<HTMLButtonElement>(mr, "#ro-close").addEventListener("click", close);
      return;
    }

    const ORDER: BookingStatus[] = ["booked", "in-progress", "completed-unpaid", "completed-paid", "cancelled", "rescheduled"];
    let h = "<h2>" + esc(l.student || "(no name)") + "</h2>";
    h += "<p class=\"hint\" style=\"margin-top:-8px\">" + esc(tlabel(l.teacher)) + " &middot; " + whenStr + "</p>";
    if (l.notes) h += "<p class=\"hint\">" + esc(l.notes) + "</p>";
    if (movedTo) h += "<p class=\"hint\">Moved to " + new Date(movedTo.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " at " + fmt12(movedTo.lesson.start) + ". <button class=\"linkish\" id=\"bk-goto\" type=\"button\">View new booking</button></p>";
    h += "<div class=\"fld\"><label>Status</label><div class=\"stpick\">";
    ORDER.forEach(function (k) {
      const s = STATUSES[k];
      h += "<button type=\"button\" data-st=\"" + k + "\" aria-pressed=\"" + (bk.status === k) + "\">" + (s.dot ? "<span class=\"sdot\" style=\"--sc:" + s.dot + "\"></span>" : "") + esc(s.label) + "</button>";
    });
    h += "</div></div>";
    h += "<div id=\"resched-wrap\" hidden><div class=\"row2\"><div class=\"fld\"><label for=\"rs-date\">New date</label><input id=\"rs-date\" type=\"date\" value=\"" + esc(dateIso) + "\"></div><div class=\"fld\"><label for=\"rs-start\">New time</label><input id=\"rs-start\" type=\"time\" step=\"300\" value=\"" + esc(l.start) + "\"></div></div><button class=\"btn primary\" id=\"rs-confirm\" type=\"button\">Confirm reschedule</button></div>";

    h += "<div class=\"fld\"><label>Billing</label>";
    if (bill) {
      const c = billCalc(bill);
      h += "<div class=\"bmini\"><div class=\"r\"><span>Total</span><span>" + money(c.tot) + "</span></div><div class=\"r\"><span>Paid</span><span>" + money(c.paid) + "</span></div><div class=\"r\"><span>Balance</span><span>" + money(c.bal) + "</span></div><div class=\"r\"><span>Status</span><span class=\"pill-s " + c.status + "\">" + c.status + "</span></div>";
      h += "<div class=\"acts\"><button class=\"mini\" id=\"bk-managebill\" type=\"button\">Manage bill</button><button class=\"mini\" id=\"bk-invoice\" type=\"button\">" + (c.bal <= 0 ? "Receipt" : "Invoice") + "</button><button class=\"mini\" id=\"bk-unlink\" type=\"button\">Unlink</button></div></div>";
    } else {
      const others = billsForStudent(l.studentId);
      h += "<div class=\"bmini\"><p class=\"hint\" style=\"margin:0 0 8px\">No bill linked yet.</p><div class=\"acts\"><button class=\"btn\" id=\"bk-newbill\" type=\"button\">+ Create bill</button>" + (others.length ? "<button class=\"btn\" id=\"bk-linkbill\" type=\"button\">Link existing bill</button>" : "") + "</div><div id=\"bk-linklist\" class=\"linklist\" hidden></div></div>";
    }
    h += "</div>";
    h += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"bk-editlesson\" type=\"button\">Edit lesson details</button><button class=\"btn\" id=\"bk-close\">Close</button></div>";

    const m = modal(h);
    el<HTMLButtonElement>(m, "#bk-close").addEventListener("click", close);
    el<HTMLButtonElement>(m, "#bk-editlesson").addEventListener("click", function () { close(); openLesson(l, null); });
    const gotoBtn = m.querySelector<HTMLButtonElement>("#bk-goto");
    if (gotoBtn) gotoBtn.addEventListener("click", function () {
      close();
      const mv = movedTo as MovedTo;
      cursor = new Date(mv.date + "T00:00:00"); cursor.setDate(1);
      state.ui.view = "month"; commit(); render();
      openBooking(mv.lesson, mv.date);
    });

    function setStatus(k: BookingStatus): void {
      if (k === "completed-unpaid" && bill && billCalc(bill).status === "paid") k = "completed-paid";
      setBooking(l.id, dateIso, { status: k });
      commit(); close(); render();
    }
    els<HTMLButtonElement>(m, "[data-st]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const k = attr(btn, "data-st") as BookingStatus;
        if (k === "rescheduled") {
          els<HTMLButtonElement>(m, "[data-st]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === btn)); });
          el<HTMLElement>(m, "#resched-wrap").hidden = false;
          return;
        }
        setStatus(k);
      });
    });
    const rc = m.querySelector<HTMLButtonElement>("#rs-confirm");
    if (rc) rc.addEventListener("click", function () {
      const nd = val(m, "#rs-date"), ns = val(m, "#rs-start");
      if (!nd || !ns) return;
      const newLesson: Lesson = { id: uid(), teacher: l.teacher, student: l.student, studentId: l.studentId, recurrence: "once", date: nd, start: ns, mins: l.mins || 60, notes: l.notes || "", rescheduledFrom: bkey(l.id, dateIso) };
      state.lessons.push(newLesson);
      setBooking(l.id, dateIso, { status: "rescheduled", rescheduledTo: bkey(newLesson.id, nd) });
      commit(); close();
      cursor = new Date(nd + "T00:00:00"); cursor.setDate(1);
      render();
    });

    if (bill) {
      el<HTMLButtonElement>(m, "#bk-managebill").addEventListener("click", function () { close(); openBill(bill, null); });
      el<HTMLButtonElement>(m, "#bk-invoice").addEventListener("click", function () { openInvoice(bill); });
      el<HTMLButtonElement>(m, "#bk-unlink").addEventListener("click", function () { setBooking(l.id, dateIso, { billId: null }); commit(); close(); render(); });
    } else {
      el<HTMLButtonElement>(m, "#bk-newbill").addEventListener("click", function () {
        close();
        openBill(null, { teacher: l.teacher, student: l.student, date: dateIso, lessonId: l.id });
      });
      const lb = m.querySelector<HTMLButtonElement>("#bk-linkbill");
      if (lb) lb.addEventListener("click", function () {
        const list = el<HTMLElement>(m, "#bk-linklist");
        list.innerHTML = billsForStudent(l.studentId).map(function (b) {
          const cb = billCalc(b);
          return "<button type=\"button\" data-bid=\"" + b.id + "\">" + esc(b.date || "") + " &middot; " + esc(teacher(b.instrument).label) + " &middot; " + money(cb.tot) + " (" + cb.status + ")</button>";
        }).join("");
        list.hidden = false;
        els<HTMLButtonElement>(list, "[data-bid]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            const bid = attr(btn, "data-bid");
            setBooking(l.id, dateIso, { billId: bid });
            syncBookingsForBill(findBill(bid));
            commit(); close(); render();
          });
        });
      });
    }
  }

  // ---- day modal ----
  function openDay(dstr: string): void {
    const d = new Date(dstr + "T00:00:00");
    const its = itemsFor(d);
    let h = "<h2>" + d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + "</h2>";
    if (!its.length) { h += "<p class=\"hint\" style=\"margin-top:0\">No lessons scheduled.</p>"; }
    else {
      h += "<div class=\"daylist\">";
      its.forEach(function (l) {
        const bk = bookingFor(l.id, dstr), st = STATUSES[bk.status] || STATUSES.booked;
        h += "<button class=\"" + (st.strike ? "strike" : "") + "\" data-id=\"" + l.id + "\"><span class=\"swatch\" style=\"background:var(--" + l.teacher + ")\"></span><span class=\"pt\">" + fmt12(l.start) + "</span> " + esc(l.student || "(no name)") + "<span class=\"tag\">" + esc(teacher(l.teacher).label) + (l.recurrence === "weekly" ? " · weekly" : "") + "</span>" + (st.dot ? "<span class=\"sdot\" style=\"--sc:" + st.dot + "\" title=\"" + esc(st.label) + "\"></span>" : "") + "</button>";
      });
      h += "</div>";
    }
    h += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"d-close\">Close</button>" + (canEdit() ? "<button class=\"btn primary\" id=\"d-add\">+ Add on this day</button>" : "") + "</div>";
    const m = modal(h);
    el<HTMLButtonElement>(m, "#d-close").addEventListener("click", close);
    if (canEdit()) el<HTMLButtonElement>(m, "#d-add").addEventListener("click", function () { close(); openLesson(null, { recurrence: "once", date: dstr }); });
    els<HTMLButtonElement>(m, ".daylist button").forEach(function (b) {
      b.addEventListener("click", function () { const l = find(b.getAttribute("data-id")); close(); if (l) openBooking(l, dstr); });
    });
  }

  // ---- settings modal ----
  function hourOpts(sel: number, a: number, b: number): string {
    let o = "";
    for (let hh = a; hh <= b; hh++) { o += "<option value=\"" + hh + "\"" + (hh === sel ? " selected" : "") + ">" + fmtHour(hh) + "</option>"; }
    return o;
  }
  function openSettings(): void {
    const s = state.settings;
    let h = "<h2>Teachers &amp; settings</h2>";
    h += "<div class=\"fld\"><label for=\"g-title\">Calendar title</label><input id=\"g-title\" type=\"text\" value=\"" + esc(s.title) + "\"></div>";
    h += "<div class=\"fld\"><label for=\"g-sub\">Subtitle</label><input id=\"g-sub\" type=\"text\" value=\"" + esc(s.subtitle) + "\"></div>";
    h += "<div class=\"fld\"><label>Teacher names</label>";
    state.teachers.forEach(function (t) {
      h += "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:6px\"><span class=\"swatch\" style=\"background:var(--" + t.id + ")\"></span><span style=\"font-family:var(--f-mono);font-size:11px;width:64px;color:var(--muted)\">" + t.label + "</span><input data-tid=\"" + t.id + "\" type=\"text\" value=\"" + esc(t.name) + "\" placeholder=\"teacher's name\" style=\"flex:1\"></div>";
    });
    h += "</div>";
    h += "<div class=\"row2\">";
    h += "<div class=\"fld\"><label for=\"g-ws\">Week starts</label><select id=\"g-ws\"><option value=\"1\"" + (s.weekStartsMon ? " selected" : "") + ">Monday</option><option value=\"0\"" + (!s.weekStartsMon ? " selected" : "") + ">Sunday</option></select></div>";
    h += "<div class=\"fld\"><label>&nbsp;</label><div></div></div>";
    h += "</div>";
    h += "<div class=\"row2\">";
    h += "<div class=\"fld\"><label for=\"g-ds\">Day starts</label><select id=\"g-ds\">" + hourOpts(s.dayStart, 5, 21) + "</select></div>";
    h += "<div class=\"fld\"><label for=\"g-de\">Day ends</label><select id=\"g-de\">" + hourOpts(s.dayEnd, 8, 23) + "</select></div>";
    h += "</div>";
    h += "<p class=\"hint\">Everything you enter is saved automatically. Use Print to hand your brother a paper copy.</p>";
    h += "<div class=\"fld\"><label>Manage access</label><div id=\"members-list\" class=\"hint\">Loading&hellip;</div>";
    h += "<div class=\"row2\"><input id=\"mem-email\" type=\"email\" placeholder=\"email@gmail.com\" autocomplete=\"off\"><select id=\"mem-role\"><option value=\"scheduler\">Scheduler</option><option value=\"viewer\">Viewer</option><option value=\"admin\">Admin</option></select></div>";
    h += "<button class=\"mini\" id=\"mem-add\" type=\"button\" style=\"margin-top:6px\">+ Add / update access</button>";
    h += "</div>";
    h += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"g-cancel\">Cancel</button><button class=\"btn primary\" id=\"g-save\">Save</button></div>";
    const m = modal(h);
    el<HTMLButtonElement>(m, "#g-cancel").addEventListener("click", close);
    el<HTMLButtonElement>(m, "#g-save").addEventListener("click", function () {
      s.title = val(m, "#g-title").trim() || "The Lesson Book";
      s.subtitle = val(m, "#g-sub").trim();
      s.weekStartsMon = val(m, "#g-ws") === "1";
      const dsv = +val(m, "#g-ds"); let dev = +val(m, "#g-de");
      if (dev <= dsv) dev = dsv + 1;
      s.dayStart = dsv; s.dayEnd = dev;
      els<HTMLInputElement>(m, "[data-tid]").forEach(function (inp) { teacher(attr(inp, "data-tid") as Instrument).name = inp.value.trim(); });
      commit(); close(); render();
    });
    (function () {
      const mlist = el<HTMLElement>(m, "#members-list");
      function refresh(): void {
        window.LessonBookFB!.listMembers().then(function (rows: MemberRow[]) {
          mlist.innerHTML = rows.map(function (r) {
            return "<div style=\"display:flex;align-items:center;gap:8px;margin:4px 0;font-size:12.5px\"><span style=\"flex:1;overflow:hidden;text-overflow:ellipsis\">" + esc(r.email) + "</span><span class=\"badge\">" + esc(r.role) + "</span>"
              + (r.bootstrap ? "" : "<button class=\"mini\" data-rm=\"" + esc(r.email) + "\" type=\"button\">Remove</button>") + "</div>";
          }).join("") || "<span class=\"hint\">No one else yet.</span>";
          els<HTMLButtonElement>(mlist, "[data-rm]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              btn.disabled = true; btn.textContent = "Removing…";
              window.LessonBookFB!.removeMember(attr(btn, "data-rm")).then(refresh).catch(function (err) {
                alert("Couldn't remove access: " + errMsg(err));
                refresh();
              });
            });
          });
        }).catch(function (err) { mlist.textContent = "Couldn't load: " + errMsg(err); });
      }
      refresh();
      el<HTMLButtonElement>(m, "#mem-add").addEventListener("click", function () {
        const em = val(m, "#mem-email").trim();
        const rl = val(m, "#mem-role");
        if (!em) return;
        const btn = el<HTMLButtonElement>(m, "#mem-add");
        btn.disabled = true; const was = btn.textContent; btn.textContent = "Saving…";
        window.LessonBookFB!.setMember(em, rl).then(function () {
          setVal(m, "#mem-email", "");
          btn.disabled = false; btn.textContent = was;
          refresh();
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = was;
          alert("Couldn't save access for " + em + ":\n" + errMsg(err) + "\n\nIf this keeps happening, an ad blocker or privacy extension may be blocking the connection to Firestore -- try again with it paused for this site.");
        });
      });
    })();
  }

  // ---- bill modal ----
  interface BillPrefill {
    teacher?: Instrument;
    student?: string;
    studentId?: string | null;
    date?: string;
    lessonId?: string;
  }
  function openBillReadOnly(b: Bill): void {
    const c = billCalc(b), t = teacher(b.instrument), pk = b.packageId ? pkgById(b.packageId) : null;
    let h = "<h2>" + esc(b.student || "—") + "</h2>";
    h += "<div class=\"fld\"><label>Instrument</label><div>" + esc(t.label) + " &middot; " + (b.clientType === "foreign" ? "Abroad" : "Local") + (pk ? " &middot; " + (+pk.sessions) + "-pack" : "") + "</div></div>";
    h += "<div class=\"fld\"><label>Date</label><div>" + esc(b.date || "") + "</div></div>";
    h += "<div class=\"calc\">";
    h += "<div class=\"r\"><span>" + (+b.sessions || 0) + " &times; " + money(b.unitRate) + "</span><span>" + money((+b.sessions || 0) * (+b.unitRate || 0)) + "</span></div>";
    if (c.disc > 0) h += "<div class=\"r\"><span>Discount</span><span>&minus;" + money(c.disc) + "</span></div>";
    h += "<div class=\"r tot\"><span>Total</span><span>" + money(c.tot) + "</span></div>";
    h += "<div class=\"r bal\"><span>Paid</span><span>" + money(c.paid) + "</span></div>";
    h += "<div class=\"r bal\"><span>Balance</span><span>" + money(c.bal) + "</span></div>";
    h += "</div>";
    h += "<div class=\"fld\"><label>Status</label><div><span class=\"pill-s " + c.status + "\">" + c.status + "</span></div></div>";
    if (b.notes) h += "<div class=\"fld\"><label>Notes</label><div>" + esc(b.notes) + "</div></div>";
    h += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"ro-close\">Close</button></div>";
    const m = modal(h);
    el<HTMLButtonElement>(m, "#ro-close").addEventListener("click", close);
  }
  function openBill(existing: Bill | null, prefill: BillPrefill | null): void {
    if (existing && !canEdit()) { openBillReadOnly(existing); return; }
    const pf = prefill || null;
    const pfInst: Instrument = (pf && pf.teacher) || "piano", pfType: ClientType = "local";
    const b: Bill = existing ? (JSON.parse(JSON.stringify(existing)) as Bill) : {
      id: "", date: (pf && pf.date) || iso(new Date()), student: (pf && pf.student) || "", instrument: pfInst,
      clientType: pfType, packageId: null, sessions: 1, unitRate: rateFor(pfInst, pfType),
      discount: 0, paidAmount: 0, notes: "",
    };
    let h = "";
    h += "<h2>" + (existing ? "Edit bill" : "New bill") + "</h2>";
    h += "<div class=\"err\" id=\"berr\" hidden></div>";
    h += "<div class=\"row2\">";
    h += "<div class=\"fld\"><label for=\"b-date\">Date</label><input id=\"b-date\" type=\"date\" value=\"" + esc(b.date) + "\"></div>";
    h += "<div class=\"fld\"><label for=\"b-stu\">Student</label><input id=\"b-stu\" type=\"text\" list=\"b-names\" autocomplete=\"off\" value=\"" + esc(b.student) + "\" placeholder=\"Student name\"></div>";
    h += "</div>" + studentDatalist("b-names");
    h += "<div class=\"row2\">";
    h += "<div class=\"fld\"><label for=\"b-inst\">Instrument</label><select id=\"b-inst\">" + instOpts(b.instrument) + "</select></div>";
    h += "<div class=\"fld\"><label>Client</label><div class=\"rep\">";
    h += "<button type=\"button\" data-ct=\"local\" aria-pressed=\"" + (b.clientType !== "foreign") + "\">Local</button>";
    h += "<button type=\"button\" data-ct=\"foreign\" aria-pressed=\"" + (b.clientType === "foreign") + "\">Foreigner / abroad</button>";
    h += "</div></div>";
    h += "</div>";
    h += "<div class=\"ckline\" id=\"b-pkgwrap\" hidden><input type=\"checkbox\" id=\"b-pkg\"><label for=\"b-pkg\" id=\"b-pkglabel\" style=\"cursor:pointer\"></label></div>";
    h += "<div class=\"row2\">";
    h += "<div class=\"fld\"><label for=\"b-ses\">Sessions</label><input id=\"b-ses\" type=\"number\" min=\"1\" step=\"1\" value=\"" + (+b.sessions || 1) + "\"></div>";
    h += "<div class=\"fld\"><label for=\"b-rate\">Rate / session</label><input id=\"b-rate\" type=\"number\" min=\"0\" step=\"50\" value=\"" + (+b.unitRate || 0) + "\"></div>";
    h += "</div>";
    h += "<div class=\"row2\">";
    h += "<div class=\"fld\"><label for=\"b-disc\">Discount</label><input id=\"b-disc\" type=\"number\" min=\"0\" step=\"50\" value=\"" + (+b.discount || 0) + "\"></div>";
    h += "<div class=\"fld\"><label for=\"b-paid\">Amount paid</label><input id=\"b-paid\" type=\"number\" min=\"0\" step=\"50\" value=\"" + (+b.paidAmount || 0) + "\"></div>";
    h += "</div>";
    h += "<div class=\"calc\" id=\"b-calc\"></div>";
    h += "<div class=\"fld\"><label for=\"b-notes\">Notes <span style=\"text-transform:none;letter-spacing:0\">(optional)</span></label><textarea id=\"b-notes\">" + esc(b.notes) + "</textarea></div>";
    h += "<div class=\"m-act\">";
    if (existing) h += "<button class=\"btn danger\" id=\"b-del\">Delete</button>";
    if (existing) h += "<button class=\"btn\" id=\"b-invoice\" type=\"button\">" + (billCalc(existing).bal <= 0 ? "Receipt" : "Invoice") + "</button>";
    h += "<span class=\"grow\"></span><button class=\"btn\" id=\"b-cancel\">Cancel</button><button class=\"btn primary\" id=\"b-save\">" + (existing ? "Save" : "Add bill") + "</button>";
    h += "</div>";

    const m = modal(h);
    let ct: ClientType = b.clientType === "foreign" ? "foreign" : "local";
    let pkgOn = !!b.packageId;

    function curPkg(): Package | null { return pkgsFor(val(m, "#b-inst") as Instrument, ct)[0] || null; }

    function syncPkgUI(): void {
      const pk = curPkg();
      if (pk) {
        el<HTMLElement>(m, "#b-pkgwrap").hidden = false;
        el<HTMLElement>(m, "#b-pkglabel").textContent = "Apply " + pk.label + " — " + pk.sessions + " sessions, " + money(pk.discount) + " off";
        el<HTMLInputElement>(m, "#b-pkg").checked = pkgOn;
      } else {
        if (pkgOn) { setVal(m, "#b-disc", 0); }
        el<HTMLElement>(m, "#b-pkgwrap").hidden = true;
        el<HTMLInputElement>(m, "#b-pkg").checked = false;
        pkgOn = false;
      }
      el<HTMLInputElement>(m, "#b-ses").disabled = pkgOn;
      el<HTMLInputElement>(m, "#b-disc").disabled = pkgOn;
      if (pkgOn && pk) { setVal(m, "#b-ses", pk.sessions); setVal(m, "#b-disc", pk.discount); }
    }
    function applyStdRate(): void { setVal(m, "#b-rate", rateFor(val(m, "#b-inst") as Instrument, ct)); }
    function calc(): void {
      const ses = +val(m, "#b-ses") || 0, rate = +val(m, "#b-rate") || 0, disc = Math.max(0, +val(m, "#b-disc") || 0);
      const sub = ses * rate, tot = Math.max(0, sub - disc), paid = Math.max(0, +val(m, "#b-paid") || 0);
      const c = el<HTMLElement>(m, "#b-calc");
      let s = "<div class=\"r\"><span>" + ses + " &times; " + money(rate) + "</span><span>" + money(sub) + "</span></div>";
      if (disc > 0) s += "<div class=\"r\"><span>Discount</span><span>&minus;" + money(disc) + "</span></div>";
      s += "<div class=\"r tot\"><span>Total</span><span>" + money(tot) + "</span></div>";
      s += "<div class=\"r bal\"><span>Paid</span><span>" + money(Math.min(paid, tot)) + "</span></div>";
      s += "<div class=\"r bal\"><span>Balance</span><span>" + money(Math.max(0, tot - paid)) + "</span></div>";
      c.innerHTML = s;
    }

    els<HTMLButtonElement>(m, "[data-ct]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ct = attr(btn, "data-ct") as ClientType;
        els<HTMLButtonElement>(m, "[data-ct]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === btn)); });
        applyStdRate(); syncPkgUI(); calc();
      });
    });
    el<HTMLSelectElement>(m, "#b-inst").addEventListener("change", function () { applyStdRate(); syncPkgUI(); calc(); });
    el<HTMLInputElement>(m, "#b-pkg").addEventListener("change", function () {
      pkgOn = isChecked(m, "#b-pkg");
      if (!pkgOn) { setVal(m, "#b-disc", 0); }
      syncPkgUI(); calc();
    });
    ["#b-ses", "#b-rate", "#b-disc", "#b-paid"].forEach(function (id) { el<HTMLInputElement>(m, id).addEventListener("input", calc); });

    syncPkgUI(); calc();

    el<HTMLButtonElement>(m, "#b-cancel").addEventListener("click", close);
    if (existing) el<HTMLButtonElement>(m, "#b-invoice").addEventListener("click", function () { openInvoice(existing); });
    if (existing) {
      const delBtn = el<HTMLButtonElement>(m, "#b-del");
      delBtn.addEventListener("click", function () {
        if (delBtn.getAttribute("data-armed")) { state.bills = state.bills.filter(function (z) { return z.id !== b.id; }); commit(); close(); render(); }
        else { delBtn.setAttribute("data-armed", "1"); delBtn.textContent = "Click again to delete"; }
      });
    }
    el<HTMLButtonElement>(m, "#b-save").addEventListener("click", function () {
      const err = el<HTMLElement>(m, "#berr");
      const student = val(m, "#b-stu").trim();
      const ses = Math.max(1, Math.round(+val(m, "#b-ses") || 0));
      const rate = Math.max(0, +val(m, "#b-rate") || 0);
      if (!student) { err.textContent = "Please enter the student's name."; err.hidden = false; el<HTMLInputElement>(m, "#b-stu").focus(); return; }
      const pk = curPkg();
      const rec: Bill = {
        id: existing ? b.id : uid(),
        date: val(m, "#b-date") || iso(new Date()),
        student: student,
        studentId: ensureStudentId(student),
        instrument: val(m, "#b-inst") as Instrument,
        clientType: ct,
        packageId: (pkgOn && pk) ? pk.id : null,
        sessions: (pkgOn && pk) ? pk.sessions : ses,
        unitRate: rate,
        discount: (pkgOn && pk) ? pk.discount : Math.max(0, +val(m, "#b-disc") || 0),
        paidAmount: Math.max(0, +val(m, "#b-paid") || 0),
        notes: val(m, "#b-notes").trim(),
      };
      let saved: Bill;
      if (existing) {
        const cur = findBill(b.id);
        if (!cur) return;
        Object.assign(cur, rec);
        delete cur.sample;
        saved = cur;
      } else {
        state.bills.push(rec);
        saved = rec;
        if (pf && pf.lessonId) {
          const curBk = bookingFor(pf.lessonId, pf.date as string);
          const patch: Partial<Booking> = { billId: saved.id };
          if (curBk.status === "booked" || curBk.status === "in-progress") patch.status = "completed-unpaid";
          setBooking(pf.lessonId, pf.date as string, patch);
        }
      }
      syncBookingsForBill(saved);
      commit(); close();
      if (!pf) state.ui.view = "billing";
      render();
    });
  }

  // ---- invoice / receipt ----
  function openInvoice(bill: Bill): void {
    const c = billCalc(bill), t = teacher(bill.instrument), pk = bill.packageId ? pkgById(bill.packageId) : null;
    const isReceipt = c.bal <= 0;
    const s = state.settings;
    let h = "<div class=\"invoice\">";
    h += "<div class=\"ihead\"><div><h2>" + esc(s.title || "The Lesson Book") + "</h2><p class=\"hint\" style=\"margin:0\">" + esc(s.subtitle || "") + "</p></div>";
    h += "<div class=\"idoc\">" + (isReceipt ? "Receipt" : "Invoice") + "<b>#" + esc(String(bill.id || "").slice(-6).toUpperCase()) + "</b></div></div>";
    h += "<div class=\"row2\"><div class=\"fld\"><label>Billed to</label><div>" + esc(bill.student || "—") + "</div></div><div class=\"fld\"><label>Date</label><div>" + esc(bill.date || "") + "</div></div></div>";
    h += "<table><thead><tr><th>Description</th><th class=\"num\">Qty</th><th class=\"num\">Rate</th><th class=\"num\">Amount</th></tr></thead><tbody>";
    h += "<tr><td>" + esc(t.label) + " lessons" + (bill.clientType === "foreign" ? " (abroad rate)" : "") + (pk ? " — " + esc(pk.label) : "") + "</td><td class=\"num\">" + (+bill.sessions || 0) + "</td><td class=\"num\">" + money(bill.unitRate) + "</td><td class=\"num\">" + money(c.sub) + "</td></tr>";
    if (c.disc > 0) h += "<tr><td colspan=\"3\">Discount</td><td class=\"num\">&minus;" + money(c.disc) + "</td></tr>";
    h += "</tbody></table>";
    h += "<div class=\"calc\"><div class=\"r tot\"><span>Total</span><span>" + money(c.tot) + "</span></div><div class=\"r bal\"><span>Paid</span><span>" + money(c.paid) + "</span></div><div class=\"r bal\"><span>Balance due</span><span>" + money(c.bal) + "</span></div></div>";
    if (bill.notes) h += "<p class=\"hint\">" + esc(bill.notes) + "</p>";
    h += "<p class=\"hint\">Thank you!</p>";
    h += "</div>";
    h += "<div class=\"m-act noprint\"><span class=\"grow\"></span><button class=\"btn\" id=\"inv-close\">Close</button><button class=\"btn primary\" id=\"inv-print\">Print</button></div>";
    const m = modal(h);
    el<HTMLButtonElement>(m, "#inv-close").addEventListener("click", close);
    el<HTMLButtonElement>(m, "#inv-print").addEventListener("click", printDoc);
  }

  // ---- reports ----
  function openReports(): void {
    const byTeacher: Record<Instrument, { billed: number; collected: number }> = {} as Record<Instrument, { billed: number; collected: number }>;
    TIDS.forEach(function (id) { byTeacher[id] = { billed: 0, collected: 0 }; });
    const byMonth: Record<string, { billed: number; collected: number }> = {};
    const byStudent: Record<string, number> = {};
    state.bills.forEach(function (b) {
      const c = billCalc(b);
      if (byTeacher[b.instrument]) { byTeacher[b.instrument].billed += c.tot; byTeacher[b.instrument].collected += Math.min(c.paid, c.tot); }
      const mk = (b.date || "").slice(0, 7);
      if (mk) { byMonth[mk] = byMonth[mk] || { billed: 0, collected: 0 }; byMonth[mk].billed += c.tot; byMonth[mk].collected += Math.min(c.paid, c.tot); }
      if (c.bal > 0) byStudent[b.student] = (byStudent[b.student] || 0) + c.bal;
    });
    const months = Object.keys(byMonth).sort().reverse().slice(0, 12);
    const students = Object.keys(byStudent).sort(function (a, b) { return byStudent[b] - byStudent[a]; });

    let h = "<h2>Reports</h2><div class=\"repgrid\">";

    h += "<div><div class=\"rephead\">By teacher</div><table class=\"reptbl\"><thead><tr><th>Teacher</th><th class=\"num\">Billed</th><th class=\"num\">Collected</th><th class=\"num\">Outstanding</th></tr></thead><tbody>";
    let anyTeacher = false;
    TIDS.forEach(function (id) {
      const r = byTeacher[id];
      if (!r.billed && !r.collected) return;
      anyTeacher = true;
      h += "<tr><td>" + esc(tlabel(id)) + "</td><td class=\"num\">" + money(r.billed) + "</td><td class=\"num\">" + money(r.collected) + "</td><td class=\"num\">" + money(r.billed - r.collected) + "</td></tr>";
    });
    if (!anyTeacher) h += "<tr><td colspan=\"4\" class=\"hint\">No bills yet.</td></tr>";
    h += "</tbody></table></div>";

    h += "<div><div class=\"rephead\">By month</div><table class=\"reptbl\"><thead><tr><th>Month</th><th class=\"num\">Billed</th><th class=\"num\">Collected</th></tr></thead><tbody>";
    months.forEach(function (mk) {
      const r = byMonth[mk], lbl = new Date(mk + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
      h += "<tr><td>" + esc(lbl) + "</td><td class=\"num\">" + money(r.billed) + "</td><td class=\"num\">" + money(r.collected) + "</td></tr>";
    });
    if (!months.length) h += "<tr><td colspan=\"3\" class=\"hint\">No bills yet.</td></tr>";
    h += "</tbody></table></div>";

    h += "<div><div class=\"rephead\">Outstanding by student</div><table class=\"reptbl\"><thead><tr><th>Student</th><th class=\"num\">Balance</th></tr></thead><tbody>";
    students.forEach(function (name) { h += "<tr><td>" + esc(name || "—") + "</td><td class=\"num\">" + money(byStudent[name]) + "</td></tr>"; });
    if (!students.length) h += "<tr><td colspan=\"2\" class=\"hint\">Nothing outstanding.</td></tr>";
    h += "</tbody></table></div>";

    h += "</div><div class=\"m-act noprint\"><span class=\"grow\"></span><button class=\"btn\" id=\"rep-close\">Close</button><button class=\"btn primary\" id=\"rep-print\">Print</button></div>";
    const m = modal(h);
    el<HTMLButtonElement>(m, "#rep-close").addEventListener("click", close);
    el<HTMLButtonElement>(m, "#rep-print").addEventListener("click", printDoc);
  }

  // ---- student detail / add ----
  function openStudentForm(existing: Student | null): void {
    const s: Student = existing ? (JSON.parse(JSON.stringify(existing)) as Student) : { id: "", name: "", phone: "", notes: "", createdAt: Date.now() };
    let h = "<h2>" + (existing ? "Edit student" : "Add student") + "</h2>";
    h += "<div class=\"err\" id=\"sferr\" hidden></div>";
    h += "<div class=\"fld\"><label for=\"sf-name\">Name</label><input id=\"sf-name\" type=\"text\" value=\"" + esc(s.name) + "\" placeholder=\"e.g. Mia Reyes\"></div>";
    h += "<div class=\"fld\"><label for=\"sf-phone\">Phone <span style=\"text-transform:none;letter-spacing:0\">(optional)</span></label><input id=\"sf-phone\" type=\"text\" value=\"" + esc(s.phone) + "\"></div>";
    h += "<div class=\"fld\"><label for=\"sf-notes\">Notes <span style=\"text-transform:none;letter-spacing:0\">(optional)</span></label><textarea id=\"sf-notes\">" + esc(s.notes) + "</textarea></div>";
    h += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"sf-cancel\">Cancel</button><button class=\"btn primary\" id=\"sf-save\">" + (existing ? "Save" : "Add student") + "</button></div>";
    const m = modal(h);
    el<HTMLButtonElement>(m, "#sf-cancel").addEventListener("click", close);
    el<HTMLButtonElement>(m, "#sf-save").addEventListener("click", function () {
      const nm = val(m, "#sf-name").trim();
      const err = el<HTMLElement>(m, "#sferr");
      if (!nm) { err.textContent = "Please enter a name."; err.hidden = false; return; }
      const id = ensureStudentId(nm);
      const rec = studentById(id);
      if (rec) {
        rec.phone = val(m, "#sf-phone").trim();
        rec.notes = val(m, "#sf-notes").trim();
      }
      commit(); close(); render();
    });
  }

  interface ActivityItem { date: string; lesson: Lesson; booking: Booking; }
  function openStudentDetail(id: string): void {
    const s = studentById(id);
    if (!s) return;
    const lessons = state.lessons.filter(function (l) { return l.studentId === id; });
    const bills = state.bills.slice().filter(function (b) { return b.studentId === id; }).sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    const activity: ActivityItem[] = Object.keys(state.bookings).map(function (k) {
      const bk = state.bookings[k], parts = k.split("|"), lesson = find(parts[0]);
      if (!lesson || lesson.studentId !== id) return null;
      return { date: parts[1], lesson: lesson, booking: bk };
    }).filter(function (a): a is ActivityItem { return a !== null; }).sort(function (a, b) { return b.date.localeCompare(a.date); });

    let billed = 0, collected = 0;
    bills.forEach(function (b) { const c = billCalc(b); billed += c.tot; collected += Math.min(c.paid, c.tot); });

    let h = "<h2>" + esc(s.name) + "</h2>";
    if (canEdit()) {
      h += "<div class=\"row2\"><div class=\"fld\"><label for=\"sd-name\">Name</label><input id=\"sd-name\" type=\"text\" value=\"" + esc(s.name) + "\"></div><div class=\"fld\"><label for=\"sd-phone\">Phone</label><input id=\"sd-phone\" type=\"text\" value=\"" + esc(s.phone || "") + "\"></div></div>";
      h += "<div class=\"fld\"><label for=\"sd-notes\">Notes</label><textarea id=\"sd-notes\">" + esc(s.notes || "") + "</textarea></div>";
    } else {
      if (s.phone) h += "<div class=\"fld\"><label>Phone</label><div>" + esc(s.phone) + "</div></div>";
      if (s.notes) h += "<div class=\"fld\"><label>Notes</label><div>" + esc(s.notes) + "</div></div>";
    }

    h += "<div class=\"stats\"><div class=\"stat\"><div class=\"k\">Billed</div><div class=\"v\">" + money(billed) + "</div></div><div class=\"stat coll\"><div class=\"k\">Collected</div><div class=\"v\">" + money(collected) + "</div></div><div class=\"stat out\"><div class=\"k\">Outstanding</div><div class=\"v\">" + money(billed - collected) + "</div></div></div>";

    h += "<div class=\"rephead\">Lessons</div>";
    if (lessons.length) {
      h += "<div class=\"daylist\">";
      lessons.forEach(function (l) {
        h += "<button data-act=\"sd-lesson\" data-id=\"" + l.id + "\"><span class=\"swatch\" style=\"background:var(--" + l.teacher + ")\"></span>" + esc(tlabel(l.teacher)) + " &middot; " + (l.recurrence === "weekly" ? "Every " + DOWL[l.dow as number] : new Date(l.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })) + " " + fmt12(l.start) + "<span class=\"tag\">" + (l.recurrence === "weekly" ? "weekly" : "one-time") + "</span></button>";
      });
      h += "</div>";
    } else h += "<p class=\"hint\" style=\"margin-top:0\">No lessons on the books.</p>";

    if (activity.length) {
      h += "<div class=\"rephead\">Recent activity</div><div class=\"daylist\">";
      activity.slice(0, 10).forEach(function (a) {
        const st = STATUSES[a.booking.status] || STATUSES.booked;
        h += "<button data-act=\"sd-booking\" data-id=\"" + a.lesson.id + "\" data-date=\"" + a.date + "\"><span class=\"pt\">" + esc(a.date) + "</span> " + esc(tlabel(a.lesson.teacher)) + (st.dot ? " <span class=\"sdot\" style=\"--sc:" + st.dot + "\"></span>" : "") + " " + esc(st.label) + "</button>";
      });
      h += "</div>";
    }

    h += "<div class=\"rephead\">Billing</div>";
    if (bills.length) {
      h += "<div class=\"tbl-wrap\"><table class=\"reptbl\"><thead><tr><th>Date</th><th>Instrument</th><th class=\"num\">Total</th><th class=\"num\">Balance</th><th>Status</th></tr></thead><tbody>";
      bills.forEach(function (b) {
        const c = billCalc(b);
        h += "<tr data-act=\"sd-bill\" data-id=\"" + b.id + "\" style=\"cursor:pointer\"><td>" + esc(b.date || "") + "</td><td>" + esc(teacher(b.instrument).label) + "</td><td class=\"num\">" + money(c.tot) + "</td><td class=\"num\">" + money(c.bal) + "</td><td><span class=\"pill-s " + c.status + "\">" + c.status + "</span></td></tr>";
      });
      h += "</tbody></table></div>";
    } else h += "<p class=\"hint\" style=\"margin-top:0\">No bills yet.</p>";

    h += "<div class=\"m-act\">";
    if (canEdit()) h += "<button class=\"btn danger\" id=\"sd-del\" type=\"button\">Delete</button><button class=\"btn\" id=\"sd-newbill\" type=\"button\">+ New bill</button>";
    h += "<span class=\"grow\"></span><button class=\"btn\" id=\"sd-close\">Close</button>";
    if (canEdit()) h += "<button class=\"btn primary\" id=\"sd-save\">Save</button>";
    h += "</div>";

    const m = modal(h);
    el<HTMLButtonElement>(m, "#sd-close").addEventListener("click", close);
    els<HTMLButtonElement>(m, "[data-act='sd-lesson']").forEach(function (btn) {
      btn.addEventListener("click", function () { const l = find(btn.getAttribute("data-id")); close(); if (l) openLesson(l, null); });
    });
    els<HTMLButtonElement>(m, "[data-act='sd-booking']").forEach(function (btn) {
      btn.addEventListener("click", function () { const l = find(btn.getAttribute("data-id")), d = btn.getAttribute("data-date"); close(); if (l && d) openBooking(l, d); });
    });
    els<HTMLTableRowElement>(m, "[data-act='sd-bill']").forEach(function (btn) {
      btn.addEventListener("click", function () { const b = findBill(btn.getAttribute("data-id")); close(); if (b) openBill(b, null); });
    });
    if (canEdit()) {
      el<HTMLButtonElement>(m, "#sd-newbill").addEventListener("click", function () { close(); openBill(null, { student: s.name, studentId: s.id, date: iso(new Date()) }); });
      el<HTMLButtonElement>(m, "#sd-save").addEventListener("click", function () {
        const nm = val(m, "#sd-name").trim();
        if (!nm) return;
        s.name = nm;
        s.phone = val(m, "#sd-phone").trim();
        s.notes = val(m, "#sd-notes").trim();
        commit(); close(); render();
      });
      const delBtn = el<HTMLButtonElement>(m, "#sd-del");
      delBtn.addEventListener("click", function () {
        const used = state.lessons.some(function (l) { return l.studentId === s.id; }) || state.bills.some(function (b) { return b.studentId === s.id; });
        if (used) { alert("Can't delete " + s.name + " -- they still have lessons or bills on record."); return; }
        if (delBtn.getAttribute("data-armed")) {
          state.students = state.students.filter(function (x) { return x.id !== s.id; });
          commit(); close(); render();
        } else { delBtn.setAttribute("data-armed", "1"); delBtn.textContent = "Click again to delete"; }
      });
    }
  }

  // ---- rates & packages modal ----
  function pkgRowHTML(p: Package | null): string {
    const pp: Package = p || { id: "", label: "", instrument: "piano", sessions: 10, discount: 0, localOnly: true, enabled: true };
    let h = "<div class=\"pkg\" data-pkg data-id=\"" + esc(pp.id || "") + "\">";
    h += "<input type=\"text\" data-p=\"label\" value=\"" + esc(pp.label) + "\" placeholder=\"Package name\">";
    h += "<div class=\"row2\"><select data-p=\"instrument\">" + instOpts(pp.instrument) + "</select>";
    h += "<input type=\"number\" min=\"1\" step=\"1\" data-p=\"sessions\" value=\"" + (+pp.sessions || 1) + "\" placeholder=\"sessions\"></div>";
    h += "<div class=\"row2\"><input type=\"number\" min=\"0\" step=\"50\" data-p=\"discount\" value=\"" + (+pp.discount || 0) + "\" placeholder=\"discount off total\">";
    h += "<label class=\"ck\"><input type=\"checkbox\" data-p=\"localOnly\"" + (pp.localOnly ? " checked" : "") + "> Locals only</label></div>";
    h += "<div style=\"display:flex;align-items:center;gap:12px\"><label class=\"ck\"><input type=\"checkbox\" data-p=\"enabled\"" + (pp.enabled ? " checked" : "") + "> Enabled</label>";
    h += "<span class=\"grow\" style=\"flex:1\"></span><button class=\"mini\" data-p=\"remove\" type=\"button\">Remove</button></div>";
    h += "</div>";
    return h;
  }
  function openRates(): void {
    const r = state.rates;
    let h = "<h2>Rates &amp; packages</h2>";
    h += "<p class=\"hint\" style=\"margin-top:0;margin-bottom:12px\">Per 1-hour session, in " + esc(r.currency || "PHP") + " (" + esc(r.symbol || "₱") + "). Leave a rate at 0 if you don't teach it.</p>";
    h += "<div class=\"rategrid\"><div class=\"h\">Instrument</div><div class=\"h\">Local</div><div class=\"h\">Abroad</div>";
    state.teachers.forEach(function (t) {
      const pr = r.perInstrument[t.id] || { local: 0, foreign: 0 };
      h += "<div class=\"lbl\"><span class=\"swatch\" style=\"background:var(--" + t.id + ")\"></span>" + esc(t.label) + "</div>";
      h += "<input type=\"number\" min=\"0\" step=\"50\" data-rl=\"" + t.id + "\" value=\"" + (+pr.local || 0) + "\">";
      h += "<input type=\"number\" min=\"0\" step=\"50\" data-rf=\"" + t.id + "\" value=\"" + (+pr.foreign || 0) + "\">";
    });
    h += "</div>";
    h += "<div style=\"font-family:var(--f-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:16px 0 8px\">Packages</div>";
    h += "<div id=\"pkgs\">" + (r.packages || []).map(pkgRowHTML).join("") + "</div>";
    h += "<button class=\"mini\" id=\"pkg-add\" type=\"button\">+ Add package</button>";
    h += "<div class=\"m-act\"><span class=\"grow\"></span><button class=\"btn\" id=\"r-cancel\">Cancel</button><button class=\"btn primary\" id=\"r-save\">Save</button></div>";
    const m = modal(h);

    function bindRemoves(): void {
      els<HTMLButtonElement>(m, "[data-p='remove']").forEach(function (btn) {
        btn.onclick = function () { btn.closest("[data-pkg]")!.remove(); };
      });
    }
    bindRemoves();
    el<HTMLButtonElement>(m, "#pkg-add").addEventListener("click", function () {
      const wrap = document.createElement("div");
      wrap.innerHTML = pkgRowHTML(null);
      el<HTMLElement>(m, "#pkgs").appendChild(wrap.firstChild as ChildNode);
      bindRemoves();
    });
    el<HTMLButtonElement>(m, "#r-cancel").addEventListener("click", close);
    el<HTMLButtonElement>(m, "#r-save").addEventListener("click", function () {
      state.teachers.forEach(function (t) {
        const lv = el<HTMLInputElement>(m, "[data-rl='" + t.id + "']"), fv = el<HTMLInputElement>(m, "[data-rf='" + t.id + "']");
        state.rates.perInstrument[t.id] = { local: Math.max(0, +lv.value || 0), foreign: Math.max(0, +fv.value || 0) };
      });
      const pk: Package[] = [];
      els<HTMLElement>(m, "[data-pkg]").forEach(function (w) {
        const g = function <T extends Element = HTMLInputElement>(sel: string): T { return el<T>(w, "[data-p='" + sel + "']"); };
        const lbl = (g<HTMLInputElement>("label").value || "").trim();
        if (!lbl) return;
        pk.push({
          id: w.getAttribute("data-id") || uid(),
          label: lbl,
          instrument: g<HTMLSelectElement>("instrument").value as Instrument,
          sessions: Math.max(1, Math.round(+g<HTMLInputElement>("sessions").value || 1)),
          discount: Math.max(0, +g<HTMLInputElement>("discount").value || 0),
          localOnly: g<HTMLInputElement>("localOnly").checked,
          enabled: g<HTMLInputElement>("enabled").checked,
        });
      });
      state.rates.packages = pk;
      commit(); close(); render();
    });
  }
})();
