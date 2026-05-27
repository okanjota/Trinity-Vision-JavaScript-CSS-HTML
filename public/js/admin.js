import { auth, requireAuth, students, logs, showAlert, fileToDataURL } from "/js/db.js";

const session = requireAuth();
if (!session) throw new Error("not authenticated");

document.getElementById("user-email").textContent = session.email;
document.getElementById("logout-btn").addEventListener("click", (e) => {
  e.preventDefault();
  auth.signOut();
  window.location.href = "/auth.html";
});

// ----- Tabs -----
const tabs = document.querySelectorAll(".tab[data-tab]");
const contents = {
  add: document.getElementById("tab-add"),
  list: document.getElementById("tab-list"),
  logs: document.getElementById("tab-logs"),
};
tabs.forEach((t) =>
  t.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    Object.values(contents).forEach((c) => c.classList.add("hidden"));
    contents[t.dataset.tab].classList.remove("hidden");
    if (t.dataset.tab === "list") renderStudents();
    if (t.dataset.tab === "logs") renderLogs();
  })
);

const alerts = document.getElementById("alerts");

// ----- face-api -----
let modelsLoaded = false;
(async () => {
  try {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    document.getElementById("model-status").textContent = "✓ Modelos prontos.";
  } catch (e) {
    document.getElementById("model-status").textContent = "Erro ao carregar modelos: " + e.message;
  }
})();

// ----- Add student -----
const photoInput = document.getElementById("photo");
const preview = document.getElementById("preview");
let photoDataUrl = null;

photoInput.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  photoDataUrl = await fileToDataURL(f);
  preview.innerHTML = `<img src="${photoDataUrl}" alt="preview" />`;
});

document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!photoDataUrl) return showAlert(alerts, "Selecione uma foto.", "error");
  if (!modelsLoaded) return showAlert(alerts, "Aguarde os modelos carregarem.", "warning");

  const btn = document.getElementById("add-submit");
  btn.disabled = true;
  btn.textContent = "Processando...";
  try {
    const img = new Image();
    img.src = photoDataUrl;
    await new Promise((r) => (img.onload = r));
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) throw new Error("Nenhuma face detectada na foto.");

    students.add({
      name: document.getElementById("name").value.trim(),
      registrationNumber: document.getElementById("reg").value.trim(),
      course: document.getElementById("course").value.trim(),
      status: document.getElementById("status").value,
      photoDataUrl,
      faceEncoding: Array.from(detection.descriptor),
    });

    showAlert(alerts, "Estudante cadastrado com sucesso.", "success");
    e.target.reset();
    preview.innerHTML = "👤";
    photoDataUrl = null;
  } catch (err) {
    showAlert(alerts, err.message || "Erro ao cadastrar.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Cadastrar Estudante";
  }
});

// ----- Lista -----
function renderStudents() {
  const list = students.list();
  const tbody = document.getElementById("students-body");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum estudante cadastrado.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((s) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${s.photoDataUrl ? `<img src="${s.photoDataUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" />` : ""}
          ${escapeHtml(s.name)}
        </div>
      </td>
      <td>${escapeHtml(s.registrationNumber)}</td>
      <td>${escapeHtml(s.course)}</td>
      <td><span class="badge ${s.status}">${s.status}</span></td>
      <td><button class="btn btn-ghost" data-del="${s.id}">Excluir</button></td>
    </tr>`).join("");
  tbody.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Excluir este estudante?")) return;
      students.remove(b.dataset.del);
      renderStudents();
    })
  );
}

function renderLogs() {
  const list = logs.list();
  const tbody = document.getElementById("logs-body");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhum registro.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((l) => `
    <tr>
      <td>${new Date(l.accessTime).toLocaleString("pt-BR")}</td>
      <td>${escapeHtml(l.studentName || "—")}</td>
      <td>${escapeHtml(l.registrationNumber || "—")}</td>
      <td><span class="badge ${l.accessGranted ? "regular" : "bloqueado"}">${l.accessGranted ? "Autorizado" : "Negado"}</span></td>
      <td>${escapeHtml(l.reason || "")}</td>
    </tr>`).join("");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
