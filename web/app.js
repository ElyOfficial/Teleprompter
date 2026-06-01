import { createRecorder } from "./recorder.js";

const STORAGE_SCRIPTS = "tp_scripts";
const STORAGE_SETTINGS = "tp_settings";

const DEFAULT_SETTINGS = {
  fontSize: 52,
  lineSpacing: 12,
  margin: 28,
  speed: 42,
  countdown: 3,
  guide: true,
  mirror: false,
  textColor: "#ffffff",
  bgColor: "#000000",
  prompterBox: { w: 92, fontScale: 1, frameH: 42 },
  videoQuality: "1080p",
  videoFps: 30,
};

let scripts = [];
let settings = { ...DEFAULT_SETTINGS };
let editingId = null;

// --- Storage ---

function load() {
  try {
    scripts = JSON.parse(localStorage.getItem(STORAGE_SCRIPTS) || "[]");
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || "{}") };
  } catch {
    scripts = [];
    settings = { ...DEFAULT_SETTINGS };
  }
  if (!scripts.length) seedDemo();
}

function saveScripts() {
  localStorage.setItem(STORAGE_SCRIPTS, JSON.stringify(scripts));
}

function saveSettings() {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
}

function seedDemo() {
  scripts.push({
    id: crypto.randomUUID(),
    title: "Welcome",
    body: `Welcome to your personal teleprompter.

Tap Play on a script to open the camera. Drag the text box to move it, pull the corners to resize, then tap the red button to record while you read.

Use the flip button for front / back camera.`,
    updatedAt: Date.now(),
  });
  saveScripts();
}

// --- UI refs ---

const $ = (sel) => document.querySelector(sel);
const views = {
  scripts: $("#view-scripts"),
  editor: $("#view-editor"),
  timer: $("#view-timer"),
  settings: $("#view-settings"),
};
const titles = { scripts: "Scripts", editor: "Edit Script", timer: "Visual Timer", settings: "Settings" };

const recorder = createRecorder({ $, settings, saveSettings });

// --- Navigation ---

function showView(name) {
  Object.values(views).forEach((v) => v.classList.remove("active"));
  views[name]?.classList.add("active");
  $("#screen-title").textContent = titles[name] || name;
  $("#header-action").hidden = name !== "scripts";
  $("#tab-bar").hidden = name === "editor";
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name || (name === "editor" && t.dataset.tab === "scripts"));
  });
}

$("#tab-bar").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  showView(tab.dataset.tab);
  if (tab.dataset.tab === "settings") syncSettingsUI();
});

$("#header-action").addEventListener("click", () => openEditor(null));

// --- Scripts list ---

function renderScripts() {
  const q = $("#search").value.trim().toLowerCase();
  const list = scripts.filter(
    (s) => !q || s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)
  );
  const grid = $("#script-grid");
  grid.innerHTML = "";
  $("#empty-scripts").classList.toggle("hidden", list.length > 0);

  list.sort((a, b) => b.updatedAt - a.updatedAt).forEach((s) => {
    const card = document.createElement("article");
    card.className = "script-card";
    card.innerHTML = `
      <div class="script-preview">
        <div class="preview-text">${escapeHtml(s.body.slice(0, 200))}</div>
        <button type="button" class="play" data-play="${s.id}" aria-label="Record with camera">▶</button>
      </div>
      <h3>${escapeHtml(s.title)}</h3>
    `;
    card.querySelector(".script-preview").addEventListener("click", (e) => {
      if (e.target.closest(".play")) return;
      openEditor(s.id);
    });
    card.querySelector(".play").addEventListener("click", (e) => {
      e.stopPropagation();
      openRecorder(s);
    });
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

$("#search").addEventListener("input", renderScripts);

function openEditor(id) {
  editingId = id;
  if (id) {
    const s = scripts.find((x) => x.id === id);
    $("#editor-title").value = s.title;
    $("#editor-body").value = s.body;
  } else {
    $("#editor-title").value = "";
    $("#editor-body").value = "";
  }
  showView("editor");
}

$("#btn-cancel-edit").addEventListener("click", () => showView("scripts"));
$("#btn-save-edit").addEventListener("click", () => {
  const title = $("#editor-title").value.trim();
  const body = $("#editor-body").value;
  if (!title) return;
  if (editingId) {
    const s = scripts.find((x) => x.id === editingId);
    s.title = title;
    s.body = body;
    s.updatedAt = Date.now();
  } else {
    scripts.push({ id: crypto.randomUUID(), title, body, updatedAt: Date.now() });
  }
  saveScripts();
  renderScripts();
  showView("scripts");
});

function openRecorder(script) {
  recorder.open(script);
}

// --- Settings ---

function syncSettingsUI() {
  $("#set-font").value = settings.fontSize;
  $("#set-line").value = settings.lineSpacing;
  $("#set-margin").value = settings.margin;
  $("#set-speed").value = settings.speed;
  $("#set-countdown").value = settings.countdown;
  $("#set-guide").checked = settings.guide;
  $("#set-mirror").checked = settings.mirror;
  $("#set-text-color").value = settings.textColor;
  $("#set-bg-color").value = settings.bgColor;
  $("#val-font").textContent = settings.fontSize;
  $("#val-line").textContent = settings.lineSpacing;
  $("#val-margin").textContent = settings.margin;
  $("#val-speed").textContent = settings.speed;
  const q = $("#set-quality");
  if (q) q.value = settings.videoQuality || "1080p";
  const f = $("#set-fps");
  if (f) f.value = String(settings.videoFps || 30);
}

$("#set-quality")?.addEventListener("change", (e) => {
  settings.videoQuality = e.target.value;
  saveSettings();
});
$("#set-fps")?.addEventListener("change", (e) => {
  settings.videoFps = Number(e.target.value);
  saveSettings();
});

[
  ["set-font", "fontSize", "val-font"],
  ["set-line", "lineSpacing", "val-line"],
  ["set-margin", "margin", "val-margin"],
  ["set-speed", "speed", "val-speed"],
].forEach(([id, key, label]) => {
  $(`#${id}`).addEventListener("input", (e) => {
    settings[key] = Number(e.target.value);
    if (label) $(`#${label}`).textContent = settings[key];
    saveSettings();
  });
});

$("#set-countdown").addEventListener("change", (e) => {
  settings.countdown = Number(e.target.value);
  saveSettings();
});
$("#set-guide").addEventListener("change", (e) => {
  settings.guide = e.target.checked;
  saveSettings();
});
$("#set-mirror").addEventListener("change", (e) => {
  settings.mirror = e.target.checked;
  saveSettings();
});
$("#set-text-color").addEventListener("input", (e) => {
  settings.textColor = e.target.value;
  saveSettings();
});
$("#set-bg-color").addEventListener("input", (e) => {
  settings.bgColor = e.target.value;
  saveSettings();
});

// --- Timer ---

let timerMode = "countdown";
let timerRunning = false;
let timerRemain = 0;
let timerElapsed = 0;
let timerInterval = null;

document.querySelectorAll(".seg").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    timerMode = btn.dataset.mode;
    $("#timer-pickers").classList.toggle("hidden", timerMode !== "countdown");
    resetTimer();
  });
});

function formatTimer(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ds = Math.floor((t % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ds}`;
}

function updateTimerDisplay() {
  let t =
    timerMode === "countdown"
      ? timerRunning || timerRemain > 0
        ? timerRemain
        : Number($("#timer-min").value) * 60 + Number($("#timer-sec").value)
      : timerElapsed;
  $("#timer-display").textContent = formatTimer(t);
}

function resetTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerRemain = 0;
  timerElapsed = 0;
  $("#timer-start").textContent = "Start";
  updateTimerDisplay();
}

function tickTimer() {
  if (timerMode === "countdown") {
    timerRemain = Math.max(0, timerRemain - 0.1);
    if (timerRemain <= 0) {
      resetTimer();
      if (navigator.vibrate) navigator.vibrate(200);
    }
  } else {
    timerElapsed += 0.1;
  }
  updateTimerDisplay();
}

$("#timer-reset").addEventListener("click", resetTimer);
$("#timer-start").addEventListener("click", () => {
  if (timerRunning) {
    timerRunning = false;
    clearInterval(timerInterval);
    $("#timer-start").textContent = "Start";
    return;
  }
  if (timerMode === "countdown" && timerRemain <= 0) {
    timerRemain = Number($("#timer-min").value) * 60 + Number($("#timer-sec").value);
  }
  timerRunning = true;
  $("#timer-start").textContent = "Pause";
  timerInterval = setInterval(tickTimer, 100);
});

// --- Service worker + version ---

const BUILD_ID = "center-settings-hd-v6-2026-06-01";

async function refreshAppCache() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  window.location.reload();
}

$("#btn-force-update")?.addEventListener("click", refreshAppCache);

function showBuildTag() {
  const el = $("#build-tag");
  if (el) el.textContent = `Build: ${BUILD_ID}`;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((reg) => {
      reg.update();
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "activated" && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    })
    .catch(() => {});
}

// --- Init ---

load();
renderScripts();
syncSettingsUI();
showBuildTag();
showView("scripts");
