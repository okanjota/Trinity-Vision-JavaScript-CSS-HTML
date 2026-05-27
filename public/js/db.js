// Camada de "banco de dados" usando localStorage do navegador.
// Tudo fica salvo localmente — sem servidor, sem backend.

const KEYS = {
  admins: "tv_admins",
  session: "tv_session",
  students: "tv_students",
  logs: "tv_access_logs",
};

// ---------- helpers ----------
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- alerts ----------
export function showAlert(container, message, type = "info") {
  if (!container) return;
  const el = document.createElement("div");
  el.className = `alert ${type}`;
  el.textContent = message;
  container.prepend(el);
  setTimeout(() => el.remove(), 4500);
}

// ---------- auth ----------
export const auth = {
  async signUp(email, password, fullName = "") {
    const admins = read(KEYS.admins, []);
    if (admins.find((a) => a.email === email)) throw new Error("E-mail já cadastrado.");
    const passwordHash = await sha256(password);
    const user = { id: uuid(), email, fullName, passwordHash, createdAt: Date.now() };
    admins.push(user);
    write(KEYS.admins, admins);
    write(KEYS.session, { userId: user.id, email: user.email });
    return user;
  },
  async signIn(email, password) {
    const admins = read(KEYS.admins, []);
    const user = admins.find((a) => a.email === email);
    if (!user) throw new Error("Credenciais inválidas.");
    const passwordHash = await sha256(password);
    if (user.passwordHash !== passwordHash) throw new Error("Credenciais inválidas.");
    write(KEYS.session, { userId: user.id, email: user.email });
    return user;
  },
  signOut() { localStorage.removeItem(KEYS.session); },
  getSession() { return read(KEYS.session, null); },
  hasAnyAdmin() { return read(KEYS.admins, []).length > 0; },
};

export function requireAuth() {
  const s = auth.getSession();
  if (!s) { window.location.href = "/auth.html"; return null; }
  return s;
}

// ---------- students ----------
export const students = {
  list() {
    return read(KEYS.students, []).sort((a, b) => b.createdAt - a.createdAt);
  },
  withEncoding() {
    return read(KEYS.students, []).filter((s) => s.faceEncoding);
  },
  add(student) {
    const list = read(KEYS.students, []);
    const item = { id: uuid(), createdAt: Date.now(), ...student };
    list.push(item);
    write(KEYS.students, list);
    return item;
  },
  remove(id) {
    write(KEYS.students, read(KEYS.students, []).filter((s) => s.id !== id));
  },
};

// ---------- access logs ----------
export const logs = {
  list(limit = 200) {
    return read(KEYS.logs, []).sort((a, b) => b.accessTime - a.accessTime).slice(0, limit);
  },
  add(entry) {
    const list = read(KEYS.logs, []);
    list.push({ id: uuid(), accessTime: Date.now(), ...entry });
    // mantém só os últimos 500 registros
    write(KEYS.logs, list.slice(-500));
  },
};

// ---------- file → base64 ----------
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
