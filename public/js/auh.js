import { auth, showAlert } from "/js/db.js";

const tabs = document.querySelectorAll(".tab");
const form = document.getElementById("auth-form");
const title = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const nameGroup = document.getElementById("name-group");
const alerts = document.getElementById("alerts");
let mode = "signin";

// Se já estiver logado, vai direto pro painel
if (auth.getSession()) window.location.href = "/admin.html";

// Se não há nenhum admin, força modo cadastro (primeiro vira admin)
if (!auth.hasAnyAdmin()) {
  showAlert(alerts, "Nenhum administrador encontrado. Crie a primeira conta — você se tornará o administrador.", "info");
  document.querySelector('.tab[data-mode="signup"]').click?.();
}

tabs.forEach((t) =>
  t.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    mode = t.dataset.mode;
    title.textContent = mode === "signin" ? "Entrar" : "Criar conta";
    submitBtn.textContent = mode === "signin" ? "Entrar" : "Cadastrar";
    nameGroup.style.display = mode === "signup" ? "block" : "none";
  })
);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const fullName = document.getElementById("full_name").value.trim();
  submitBtn.disabled = true;
  try {
    if (mode === "signin") await auth.signIn(email, password);
    else await auth.signUp(email, password, fullName);
    window.location.href = "/admin.html";
  } catch (err) {
    showAlert(alerts, err.message || "Erro.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
