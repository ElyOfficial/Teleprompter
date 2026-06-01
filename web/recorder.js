/** Camera + full-screen teleprompter scroll (text exits through top of screen) */

const VIDEO_PRESETS = {
  "720p": { width: 1280, height: 720, bitrate: 5_000_000 },
  "1080p": { width: 1920, height: 1080, bitrate: 12_000_000 },
  "4k": { width: 3840, height: 2160, bitrate: 28_000_000 },
};

export function createRecorder(deps) {
  const { $, settings, onClose } = deps;

  const state = {
    script: null,
    stream: null,
    facing: "user",
    offset: 0,
    playing: false,
    raf: null,
    recording: false,
    mediaRecorder: null,
    chunks: [],
    layout: { w: 92, fontScale: 1, frameH: 42 },
    scrollTouchY: null,
    wakeLock: null,
    actualVideo: null,
  };

  const els = {
    root: $("#recorder"),
    video: $("#camera"),
    canvas: $("#composite"),
    stage: $("#scroll-stage"),
    column: $("#scroll-column"),
    columnInner: $("#scroll-column-inner"),
    spacerTop: $("#scroll-spacer-top"),
    text: $("#recorder-text"),
    frame: $("#prompter-frame"),
    countdown: $("#countdown"),
    controls: $("#recorder-controls"),
    title: $("#recorder-title"),
    btnPlay: $("#btn-rec-play"),
    btnRecord: $("#btn-rec-record"),
    btnFlip: $("#btn-flip-camera"),
    btnClose: $("#btn-close-recorder"),
    btnSettings: $("#btn-rec-settings"),
    speed: $("#rec-speed"),
    readingLine: $("#rec-reading-line"),
    settingsSheet: $("#rec-settings"),
    cameraStatus: $("#rec-camera-status"),
  };

  const ctx = els.canvas.getContext("2d");

  function normalizeLayout(layout) {
    const L = layout || {};
    const w = L.w ?? (L.x != null ? L.w : 92) ?? 92;
    return {
      w: Math.min(98, Math.max(55, w)),
      fontScale: Math.min(1.6, Math.max(0.6, L.fontScale ?? 1)),
      frameH: Math.min(65, Math.max(28, L.frameH ?? L.h ?? 42)),
    };
  }

  function readingLinePx() {
    return window.innerHeight * 0.16 + 8;
  }

  function applyLayout() {
    const L = state.layout;
    els.stage.style.setProperty("--text-width", `${L.w}%`);
    els.stage.style.setProperty("--frame-height", `${L.frameH}%`);

    const fontSize = settings.fontSize * L.fontScale * 0.55;
    els.text.style.fontSize = `${fontSize}px`;
    els.text.style.lineHeight = `${(fontSize + settings.lineSpacing * L.fontScale * 0.35) / fontSize}`;
    els.text.style.color = settings.textColor;
    els.text.style.paddingLeft = els.text.style.paddingRight = `${settings.margin * L.fontScale * 0.25}px`;
    els.text.style.transform = settings.mirror ? "scaleX(-1)" : "";
    els.text.style.background = hexToRgba(settings.bgColor, 0.52);
    els.readingLine.classList.toggle("hidden", !settings.guide);
    updateSpacers();
  }

  function updateSpacers() {
    els.spacerTop.style.height = `${readingLinePx()}px`;
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function columnHeight() {
    return els.columnInner.offsetHeight;
  }

  function maxScroll() {
    return Math.max(0, columnHeight() - window.innerHeight + readingLinePx() * 0.5);
  }

  function setOffset(y) {
    state.offset = Math.min(0, Math.max(-maxScroll(), y));
    els.columnInner.style.transform = `translate3d(0, ${state.offset}px, 0)`;
  }

  function stopScroll() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    els.btnPlay.textContent = "▶";
  }

  function scrollLoop() {
    if (!state.playing) return;
    setOffset(state.offset - Number(els.speed.value) / 60);
    if (state.offset <= -maxScroll()) stopScroll();
    else state.raf = requestAnimationFrame(scrollLoop);
  }

  function startScroll() {
    state.playing = true;
    els.btnPlay.textContent = "⏸";
    scrollLoop();
  }

  function runCountdown(then) {
    let n = settings.countdown;
    if (n <= 0) return then();
    els.countdown.classList.remove("hidden");
    els.countdown.textContent = n;
    const tick = () => {
      n -= 1;
      if (n > 0) {
        els.countdown.textContent = n;
        setTimeout(tick, 1000);
      } else {
        els.countdown.classList.add("hidden");
        then();
      }
    };
    setTimeout(tick, 1000);
  }

  function videoConstraints() {
    const preset = VIDEO_PRESETS[settings.videoQuality] || VIDEO_PRESETS["1080p"];
    const fps = Number(settings.videoFps) || 30;
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
      video: {
        facingMode: state.facing,
        width: { ideal: preset.width, min: 640 },
        height: { ideal: preset.height, min: 480 },
        frameRate: { ideal: fps, min: 24, max: fps },
        resizeMode: "none",
      },
    };
  }

  function updateCameraStatusLabel() {
    const v = els.video;
    const track = state.stream?.getVideoTracks()[0];
    const settingsInfo = track?.getSettings?.();
    const preset = settings.videoQuality || "1080p";
    const fps = settings.videoFps || 30;
    let line = `${preset} · ${fps} fps requested`;
    if (v.videoWidth && settingsInfo) {
      line = `${v.videoWidth}×${v.videoHeight} · ${Math.round(settingsInfo.frameRate || fps)} fps · ${preset}`;
    }
    if (els.cameraStatus) els.cameraStatus.textContent = `Camera: ${line}`;
  }

  async function startCamera() {
    stopCamera();
    const constraints = videoConstraints();
    try {
      state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (settings.videoQuality === "4k") {
        settings.videoQuality = "1080p";
        deps.saveSettings();
        syncRecSettingsUI();
        try {
          state.stream = await navigator.mediaDevices.getUserMedia(videoConstraints());
        } catch {
          alert("Camera access failed. Allow camera & mic in Settings → Safari.");
          throw err;
        }
      } else {
        alert("Camera access failed. Allow camera & mic in Settings → Safari.");
        throw err;
      }
    }
    els.video.srcObject = state.stream;
    await els.video.play();
    await new Promise((r) => {
      if (els.video.videoWidth) r();
      else els.video.onloadedmetadata = () => r();
    });
    updateCameraStatusLabel();
  }

  function stopCamera() {
    state.stream?.getTracks().forEach((t) => t.stop());
    state.stream = null;
    els.video.srcObject = null;
  }

  function layoutMetrics() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const L = state.layout;
    const width = (L.w / 100) * vw;
    const left = (vw - width) / 2;
    const fontSize = settings.fontSize * L.fontScale * 0.55;
    const lineH = fontSize + settings.lineSpacing * L.fontScale * 0.35;
    const pad = settings.margin * L.fontScale * 0.25;
    return { vw, vh, left, width, fontSize, lineH, pad, readY: readingLinePx() };
  }

  function drawWrappedText(ctx, text, x, y, maxW, lineH) {
    let cy = y;
    for (const line of text.split("\n")) {
      const words = line.split(" ");
      let row = "";
      for (const word of words) {
        const test = row ? `${row} ${word}` : word;
        if (ctx.measureText(test).width > maxW && row) {
          ctx.fillText(row, x, cy);
          cy += lineH;
          row = word;
        } else row = test;
      }
      if (row) {
        ctx.fillText(row, x, cy);
        cy += lineH;
      }
      cy += lineH * 0.12;
    }
  }

  function drawCompositeFrame() {
    const v = els.video;
    if (!v.videoWidth) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (els.canvas.width !== w) els.canvas.width = w;
    if (els.canvas.height !== h) els.canvas.height = h;
    ctx.drawImage(v, 0, 0, w, h);

    const m = layoutMetrics();
    const sx = w / m.vw;
    const sy = h / m.vh;
    const left = m.left * sx;
    const maxW = m.width * sx;
    const fontSize = m.fontSize * sx;
    const lineH = m.lineH * sx;
    const pad = m.pad * sx;
    const readY = m.readY * sy;

    ctx.save();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    ctx.fillStyle = settings.textColor;
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 8 * sx;
    const startY = readY + state.offset * sy + fontSize;
    const body = state.script?.body || "";

    if (settings.mirror) {
      ctx.save();
      ctx.translate(left + maxW, 0);
      ctx.scale(-1, 1);
      drawWrappedText(ctx, body, left + pad, startY, maxW - pad * 2, lineH);
      ctx.restore();
    } else {
      drawWrappedText(ctx, body, left + pad, startY, maxW - pad * 2, lineH);
    }

    if (settings.guide) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 159, 10, 0.55)";
      ctx.lineWidth = 2 * sx;
      ctx.beginPath();
      ctx.moveTo(left, readY);
      ctx.lineTo(left + maxW, readY);
      ctx.stroke();
    }
    ctx.restore();
  }

  let compositeRaf = null;
  function startCompositeLoop() {
    const loop = () => {
      drawCompositeFrame();
      compositeRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  function stopCompositeLoop() {
    if (compositeRaf) cancelAnimationFrame(compositeRaf);
    compositeRaf = null;
  }

  function pickMimeType() {
    return ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) =>
      MediaRecorder.isTypeSupported(t)
    );
  }

  function startRecording() {
    if (state.recording) return;
    drawCompositeFrame();
    const mime = pickMimeType();
    const fps = Number(settings.videoFps) || 30;
    const preset = VIDEO_PRESETS[settings.videoQuality] || VIDEO_PRESETS["1080p"];
    const stream = els.canvas.captureStream(fps);
    const audio = state.stream?.getAudioTracks()[0];
    if (audio) stream.addTrack(audio);

    state.chunks = [];
    const opts = { mimeType: mime || undefined, videoBitsPerSecond: preset.bitrate };
    try {
      state.mediaRecorder = new MediaRecorder(stream, opts);
    } catch {
      state.mediaRecorder = new MediaRecorder(stream);
    }
    state.mediaRecorder.ondataavailable = (e) => e.data.size && state.chunks.push(e.data);
    state.mediaRecorder.onstop = saveRecording;
    state.mediaRecorder.start(1000);
    state.recording = true;
    els.btnRecord.classList.add("recording");
    els.btnRecord.textContent = "■";
  }

  function stopRecording() {
    if (!state.recording) return;
    state.recording = false;
    els.btnRecord.classList.remove("recording");
    els.btnRecord.textContent = "●";
    state.mediaRecorder?.stop();
  }

  function saveRecording() {
    const type = state.mediaRecorder?.mimeType || "video/mp4";
    const blob = new Blob(state.chunks, { type });
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const name = `${state.script?.title || "recording"}-${Date.now()}.${ext}`;
    const file = new File([blob], name, { type });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => download(blob, name));
    } else download(blob, name);
  }

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  function openSettingsSheet() {
    syncRecSettingsUI();
    els.settingsSheet.classList.remove("hidden");
    els.settingsSheet.setAttribute("aria-hidden", "false");
  }

  function closeSettingsSheet() {
    els.settingsSheet.classList.add("hidden");
    els.settingsSheet.setAttribute("aria-hidden", "true");
  }

  function syncRecSettingsUI() {
    const map = [
      ["rec-set-font", settings.fontSize, "rec-val-font"],
      ["rec-set-line", settings.lineSpacing, "rec-val-line"],
      ["rec-set-margin", settings.margin, "rec-val-margin"],
      ["rec-set-speed", settings.speed, "rec-val-speed"],
    ];
    map.forEach(([id, val, labelId]) => {
      const el = $(`#${id}`);
      if (el) el.value = val;
      const lab = $(`#${labelId}`);
      if (lab) lab.textContent = val;
    });
    const cd = $("#rec-set-countdown");
    if (cd) cd.value = settings.countdown;
    const g = $("#rec-set-guide");
    if (g) g.checked = settings.guide;
    const m = $("#rec-set-mirror");
    if (m) m.checked = settings.mirror;
    const tc = $("#rec-set-text-color");
    if (tc) tc.value = settings.textColor;
    const bc = $("#rec-set-bg-color");
    if (bc) bc.value = settings.bgColor;
    const q = $("#rec-set-quality");
    if (q) q.value = settings.videoQuality || "1080p";
    const f = $("#rec-set-fps");
    if (f) f.value = String(settings.videoFps || 30);
    if (els.speed) els.speed.value = settings.speed;
  }

  function bindRecSetting(id, key, labelId, parser = Number) {
    const el = $(`#${id}`);
    if (!el) return;
    el.addEventListener("input", async () => {
      const val = el.type === "checkbox" ? el.checked : parser(el.value);
      settings[key] = val;
      if (labelId) {
        const lab = $(`#${labelId}`);
        if (lab) lab.textContent = el.type === "checkbox" ? "" : val;
      }
      deps.saveSettings();
      applyLayout();
      if (key === "speed" && els.speed) els.speed.value = settings.speed;
      if (key === "videoQuality" || key === "videoFps") {
        if (!els.root.classList.contains("hidden")) await startCamera();
      }
    });
  }

  function bindRecSettings() {
    bindRecSetting("rec-set-font", "fontSize", "rec-val-font");
    bindRecSetting("rec-set-line", "lineSpacing", "rec-val-line");
    bindRecSetting("rec-set-margin", "margin", "rec-val-margin");
    bindRecSetting("rec-set-speed", "speed", "rec-val-speed");
    bindRecSetting("rec-set-countdown", "countdown", null);
    bindRecSetting("rec-set-guide", "guide", null, (v) => v);
    bindRecSetting("rec-set-mirror", "mirror", null, (v) => v);
    $("#rec-set-text-color")?.addEventListener("input", (e) => {
      settings.textColor = e.target.value;
      deps.saveSettings();
      applyLayout();
    });
    $("#rec-set-bg-color")?.addEventListener("input", (e) => {
      settings.bgColor = e.target.value;
      deps.saveSettings();
      applyLayout();
    });
    bindRecSetting("rec-set-quality", "videoQuality", null, (v) => v);
    bindRecSetting("rec-set-fps", "videoFps", null, (v) => Number(v));
  }

  async function open(script) {
    state.script = script;
    state.offset = 0;
    state.playing = false;
    state.facing = "user";
    state.layout = normalizeLayout(settings.prompterBox);
    els.title.textContent = script.title;
    els.text.textContent = script.body;
    els.speed.value = settings.speed;
    applyLayout();
    setOffset(0);
    closeSettingsSheet();

    els.root.classList.remove("hidden");
    els.root.setAttribute("aria-hidden", "false");

    try {
      await startCamera();
      startCompositeLoop();
      requestAnimationFrame(() => {
        updateSpacers();
        setOffset(0);
      });
      if ("wakeLock" in navigator) {
        try {
          state.wakeLock = await navigator.wakeLock.request("screen");
        } catch { /* ignore */ }
      }
    } catch {
      close();
    }
  }

  function close() {
    closeSettingsSheet();
    stopRecording();
    stopScroll();
    stopCompositeLoop();
    stopCamera();
    state.wakeLock?.release();
    state.wakeLock = null;
    els.root.classList.add("hidden");
    els.root.setAttribute("aria-hidden", "true");
    els.countdown.classList.add("hidden");
    onClose?.();
  }

  async function flipCamera() {
    state.facing = state.facing === "user" ? "environment" : "user";
    await startCamera();
  }

  function pointerLayoutInteraction(e) {
    const handle = e.target.closest("[data-handle]");
    if (!handle) return;
    e.preventDefault();
    const startX = e.clientX ?? e.touches?.[0]?.clientX;
    const startY = e.clientY ?? e.touches?.[0]?.clientY;
    const start = { ...state.layout };
    const mode = handle.dataset.handle;

    const onMove = (ev) => {
      const cx = ev.clientX ?? ev.touches?.[0]?.clientX;
      const cy = ev.clientY ?? ev.touches?.[0]?.clientY;
      const dx = ((cx - startX) / window.innerWidth) * 100;
      const dy = ((cy - startY) / window.innerHeight) * 100;
      const L = { ...start };

      if (mode === "width") {
        L.w = Math.min(98, Math.max(55, start.w + dx * 2));
      }
      if (mode === "se") {
        L.fontScale = Math.min(1.6, Math.max(0.6, start.fontScale + dy * 0.02 + dx * 0.008));
        L.frameH = Math.min(65, Math.max(28, start.frameH + dy * 0.5));
        L.w = Math.min(98, Math.max(55, start.w + dx * 2));
      }

      state.layout = normalizeLayout(L);
      applyLayout();
    };

    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      settings.prompterBox = { ...state.layout };
      deps.saveSettings();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  els.frame.addEventListener("pointerdown", pointerLayoutInteraction);
  els.frame.addEventListener("touchstart", pointerLayoutInteraction, { passive: false });

  els.stage.addEventListener("touchstart", (e) => {
    if (state.playing || e.target.closest(".resize-handle, .rec-settings")) return;
    state.scrollTouchY = e.touches[0].clientY;
  }, { passive: true });
  els.stage.addEventListener("touchmove", (e) => {
    if (state.playing || state.scrollTouchY == null) return;
    const dy = e.touches[0].clientY - state.scrollTouchY;
    state.scrollTouchY = e.touches[0].clientY;
    setOffset(state.offset + dy);
  }, { passive: true });
  els.stage.addEventListener("touchend", () => {
    state.scrollTouchY = null;
  });

  window.addEventListener("resize", () => {
    if (!els.root.classList.contains("hidden")) updateSpacers();
  });

  els.btnClose.addEventListener("click", close);
  els.btnFlip.addEventListener("click", (e) => {
    e.stopPropagation();
    flipCamera();
  });
  els.btnSettings?.addEventListener("click", (e) => {
    e.stopPropagation();
    openSettingsSheet();
  });
  $("#btn-close-rec-settings")?.addEventListener("click", closeSettingsSheet);
  $(".rec-settings-backdrop")?.addEventListener("click", closeSettingsSheet);

  els.btnPlay.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.playing) stopScroll();
    else if (state.offset >= -2) runCountdown(startScroll);
    else startScroll();
  });
  els.btnRecord.addEventListener("click", (e) => {
    e.stopPropagation();
    state.recording ? stopRecording() : startRecording();
  });
  els.speed.addEventListener("input", (e) => {
    settings.speed = Number(e.target.value);
    const rs = $("#rec-set-speed");
    if (rs) rs.value = settings.speed;
    const lab = $("#rec-val-speed");
    if (lab) lab.textContent = settings.speed;
    deps.saveSettings();
  });

  els.root.addEventListener("click", (e) => {
    if (e.target.closest(".rec-controls-bar, .prompter-frame, .resize-handle, .scroll-column, .rec-settings")) return;
    els.controls.classList.toggle("hidden-ui");
  });

  bindRecSettings();

  return { open, close };
}
