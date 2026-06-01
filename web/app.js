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
};

let scripts = [];
let settings = { ...DEFAULT_SETTINGS };
let editingId = null;
let player = {
  script: null,
  offset: 0,
  playing: false,
  raf: null,
  wakeLock: null,
  controlsVisible: true,
  touchY: null,
};

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

Tap Play to scroll. Tap the screen to show or hide controls. Use the arrows while paused to nudge.

Add this page to your Home Screen in Safari for a full-screen app experience.`,
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
        <button type="button" class="play" data-play="${s.id}" aria-label="Play">▶</button>
      </div>
      <h3>${escapeHtml(s.title)}</h3>
    `;
    card.querySelector(".script-preview").addEventListener("click", (e) => {
      if (e.target.closest(".play")) return;
      openEditor(s.id);
    });
    card.querySelector(".play").addEventListener("click", (e) => {
      e.stopPropagation();
      openPlayer(s);
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
}

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

// --- Player ---

function openPlayer(script) {
  player.script = script;
  player.offset = 0;
  player.playing = false;
  $("#player-title").textContent = script.title;
  $("#player-text").textContent = script.body;
  applyPlayerStyles();
  $("#player").classList.remove("hidden");
  $("#player").setAttribute("aria-hidden", "false");
  $("#scroll-wrap").style.transform = "translateY(0px)";
  $("#player-speed").value = settings.speed;
  $("#reading-line").classList.toggle("hidden", !settings.guide);
  updatePlayButton();
}

function applyPlayerStyles() {
  const t = $("#player-text");
  t.style.fontSize = `${settings.fontSize}px`;
  t.style.lineHeight = `${(settings.fontSize + settings.lineSpacing) / settings.fontSize}`;
  t.style.color = settings.textColor;
  t.style.paddingLeft = t.style.paddingRight = `${settings.margin}px`;
  t.style.transform = settings.mirror ? "scaleX(-1)" : "";
  $("#player-bg").style.background = settings.bgColor;
}

function closePlayer() {
  stopScroll();
  releaseWakeLock();
  $("#player").classList.add("hidden");
  $("#player").setAttribute("aria-hidden", "true");
  $("#countdown").classList.add("hidden");
}

function updatePlayButton() {
  $("#btn-play").textContent = player.playing ? "⏸" : "▶";
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      player.wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch { /* ignore */ }
}

function releaseWakeLock() {
  player.wakeLock?.release();
  player.wakeLock = null;
}

function maxScroll() {
  const wrap = $("#scroll-wrap");
  return Math.max(0, wrap.scrollHeight - window.innerHeight);
}

function setOffset(y) {
  player.offset = Math.min(0, Math.max(-maxScroll(), y));
  $("#scroll-wrap").style.transform = `translateY(${player.offset}px)`;
}

function stopScroll() {
  player.playing = false;
  if (player.raf) cancelAnimationFrame(player.raf);
  player.raf = null;
  updatePlayButton();
}

function scrollLoop() {
  if (!player.playing) return;
  const speed = Number($("#player-speed").value) / 60;
  setOffset(player.offset - speed);
  if (player.offset <= -maxScroll()) {
    stopScroll();
    releaseWakeLock();
    return;
  }
  player.raf = requestAnimationFrame(scrollLoop);
}

function startScroll() {
  player.playing = true;
  updatePlayButton();
  requestWakeLock();
  scrollLoop();
}

function runCountdown(then) {
  let n = settings.countdown;
  if (n <= 0) {
    then();
    return;
  }
  const el = $("#countdown");
  el.classList.remove("hidden");
  el.textContent = n;
  const tick = () => {
    n -= 1;
    if (n > 0) {
      el.textContent = n;
      setTimeout(tick, 1000);
    } else {
      el.classList.add("hidden");
      then();
    }
  };
  setTimeout(tick, 1000);
}

function togglePlay() {
  if (player.playing) {
    stopScroll();
    releaseWakeLock();
    return;
  }
  if (player.offset >= -2) {
    runCountdown(startScroll);
  } else {
    startScroll();
  }
}

$("#btn-close-player").addEventListener("click", closePlayer);
$("#btn-play").addEventListener("click", (e) => {
  e.stopPropagation();
  togglePlay();
});
$("#btn-nudge-up").addEventListener("click", (e) => {
  e.stopPropagation();
  stopScroll();
  setOffset(player.offset + 80);
});
$("#btn-nudge-down").addEventListener("click", (e) => {
  e.stopPropagation();
  stopScroll();
  setOffset(player.offset - 80);
});
$("#player-speed").addEventListener("input", (e) => {
  settings.speed = Number(e.target.value);
  saveSettings();
});

$("#player").addEventListener("click", (e) => {
  if (e.target.closest(".player-controls button, .player-controls input")) return;
  $("#player-controls").classList.toggle("hidden-ui");
});

// Touch drag while paused
$("#player").addEventListener(
  "touchstart",
  (e) => {
    if (player.playing) return;
    player.touchY = e.touches[0].clientY;
  },
  { passive: true }
);
$("#player").addEventListener(
  "touchmove",
  (e) => {
    if (player.playing || player.touchY == null) return;
    const dy = e.touches[0].clientY - player.touchY;
    player.touchY = e.touches[0].clientY;
    setOffset(player.offset + dy);
  },
  { passive: true }
);
$("#player").addEventListener("touchend", () => {
  player.touchY = null;
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

// --- Service worker ---

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// --- Init ---

load();
renderScripts();
syncSettingsUI();
showView("scripts");
