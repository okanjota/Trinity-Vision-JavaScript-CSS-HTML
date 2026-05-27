import { requireAuth, students, logs, showAlert } from "/js/db.js";

if (!requireAuth()) throw new Error("not authenticated");

const video = document.getElementById("video");
const overlay = document.getElementById("cam-overlay");
const startBtn = document.getElementById("start-btn");
const verifyBtn = document.getElementById("verify-btn");
const stopBtn = document.getElementById("stop-btn");
const result = document.getElementById("result");
const alerts = document.getElementById("alerts");

const MATCH_THRESHOLD = 0.55;
let stream = null;
let modelsLoaded = false;

// ---- carrega face-api ----
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
    startBtn.disabled = false;
    showAlert(alerts, "Sistema pronto. Ative a câmera para começar.", "success");
  } catch (e) {
    showAlert(alerts, "Erro ao carregar modelos: " + e.message, "error");
  }
})();

// ---- câmera ----
startBtn.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    video.srcObject = stream;
    overlay.classList.add("hidden");
    startBtn.classList.add("hidden");
    verifyBtn.classList.remove("hidden");
    stopBtn.classList.remove("hidden");
  } catch {
    showAlert(alerts, "Não foi possível acessar a câmera.", "error");
  }
});

stopBtn.addEventListener("click", stopCamera);
window.addEventListener("beforeunload", stopCamera);

function stopCamera() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  video.srcObject = null;
  overlay.classList.remove("hidden");
  startBtn.classList.remove("hidden");
  verifyBtn.classList.add("hidden");
  stopBtn.classList.add("hidden");
}

// ---- verificar ----
verifyBtn.addEventListener("click", async () => {
  if (!modelsLoaded) return;
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<span class="spinner"></span> Processando...';
  result.innerHTML = "";

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      showAlert(alerts, "Nenhuma face detectada. Posicione-se em frente à câmera.", "warning");
      return;
    }

    let best = null;
    for (const s of students.withEncoding()) {
      const dist = faceapi.euclideanDistance(detection.descriptor, s.faceEncoding);
      if (dist < MATCH_THRESHOLD && (!best || dist < best.dist)) best = { s, dist };
    }

    if (best) {
      const st = best.s;
      const granted = st.status === "regular";
      renderResult(granted, st.name, st.registrationNumber,
        granted ? "Acesso autorizado" : `Acesso negado — Status: ${st.status}`);
      logs.add({
        studentId: st.id, studentName: st.name,
        registrationNumber: st.registrationNumber,
        accessGranted: granted,
        reason: granted ? "Reconhecido e regular" : `Status: ${st.status}`,
      });
    } else {
      renderResult(false, null, null, "Face não reconhecida no sistema");
      logs.add({ accessGranted: false, reason: "Face não reconhecida" });
    }
  } catch (e) {
    showAlert(alerts, "Erro ao processar reconhecimento.", "error");
    console.error(e);
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = "✓ Verificar Acesso";
  }
});

function renderResult(granted, name, reg, reason) {
  result.innerHTML = `
    <div class="access-result ${granted ? "granted" : "denied"}">
      <div class="icon">${granted ? "✓" : "✗"}</div>
      <h2>${granted ? "ACESSO AUTORIZADO" : "ACESSO NEGADO"}</h2>
      ${name ? `<p style="font-size:1.1rem;margin:6px 0"><strong>${esc(name)}</strong></p>` : ""}
      ${reg ? `<p style="opacity:0.9;margin:0">Matrícula: ${esc(reg)}</p>` : ""}
      <p style="opacity:0.9;margin-top:8px">${esc(reason)}</p>
    </div>`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
