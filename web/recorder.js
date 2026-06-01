/** Camera + full-screen teleprompter scroll (text exits through top of screen) */

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
    layout: { x: 4, w: 92, fontScale: 1, frameH: 42 },
    scrollTouchY: null,
    wakeLock: null,
  };

  const els = {
    root: $("#recorder"),
    video: $("#camera"),
    canvas: $("#composite"),
    stage: $("#scroll-stage"),
    column: $("#scroll-column"),
    spacerTop: $("#scroll-spacer-top"),
    spacerBottom: $("#scroll-spacer-bottom"),
    text: $("#recorder-text"),
    frame: $("#prompter-frame"),
    countdown: $("#countdown"),
    controls: $("#recorder-controls"),
    title: $("#recorder-title"),
    btnPlay: $("#btn-rec-play"),
    btnRecord: $("#btn-rec-record"),
    btnFlip: $("#btn-flip-camera"),
    btnClose: $("#btn-close-recorder"),
    speed: $("#rec-speed"),
    readingLine: $("#rec-reading-line"),
  };

  const ctx = els.canvas.getContext("2d");

  function normalizeLayout(layout) {
    const L = layout || {};
    return {
      x: Math.min(24, Math.max(0, L.x ?? 4)),
      w: Math.min(100, Math.max(50, L.w ?? 92)),
      fontScale: Math.min(1.6, Math.max(0.6, L.fontScale ?? 1)),
      frameH: Math.min(65, Math.max(28, L.frameH ?? L.h ?? 42)),
    };
  }

  function readingLinePx() {
    const safe = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--safe-top") || "0"
    );
    const vh = window.innerHeight;
    return (Number.isNaN(safe) ? 0 : safe) + vh * 0.16;
  }

  function applyLayout() {
    const L = state.layout;
    const root = els.stage;
    root.style.setProperty("--text-left", `${L.x}%`);
    root.style.setProperty("--text-width", `${L.w}%`);
    root.style.setProperty("--frame-height", `${L.frameH}%`);
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
    const readY = readingLinePx();
    els.spacerTop.style.height = `${readY}px`;
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function columnHeight() {
    return els.column.offsetHeight;
  }

  function maxScroll() {
    return Math.max(0, columnHeight() - window.innerHeight + readingLinePx() * 0.5);
  }

  function setOffset(y) {
    state.offset = Math.min(0, Math.max(-maxScroll(), y));
    els.column.style.transform = `translate3d(0, ${state.offset}px, 0)`;
  }

  function stopScroll() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    els.btnPlay.textContent = "▶";
  }

  function scrollLoop() {
    if (!state.playing) return;
    const speed = Number(els.speed.value) / 60;
    setOffset(state.offset - speed);
    if (state.offset <= -maxScroll()) {
      stopScroll();
      return;
    }
    state.raf = requestAnimationFrame(scrollLoop);
  }

  function startScroll() {
    state.playing = true;
    els.btnPlay.textContent = "⏸";
    scrollLoop();
  }

  function runCountdown(then) {
    let n = settings.countdown;
    if (n <= 0) {
      then();
      return;
    }
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

  async function startCamera() {
    stopCamera();
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: state.facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
    } catch {
      alert("Camera access is required. Allow camera & microphone in Settings → Safari.");
      throw new Error("no camera");
    }
    els.video.srcObject = state.stream;
    await els.video.play();
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
    const left = (L.x / 100) * vw;
    const width = (L.w / 100) * vw;
    const fontSize = settings.fontSize * L.fontScale * 0.55;
    const lineH = fontSize + settings.lineSpacing * L.fontScale * 0.35;
    const pad = settings.margin * L.fontScale * 0.25;
    const readY = readingLinePx();
    return { vw, vh, left, width, fontSize, lineH, pad, readY };
  }

  function drawWrappedText(ctx, text, x, y, maxW, lineH) {
    const lines = text.split("\n");
    let cy = y;
    for (const line of lines) {
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
    return cy;
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
    const scrollY = state.offset * sy;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = settings.textColor;

    const body = state.script?.body || "";
    const startY = m.readY * sy + scrollY + fontSize;

    if (settings.mirror) {
      ctx.save();
      ctx.translate(left + maxW, 0);
      ctx.scale(-1, 1);
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8 * sx;
      drawWrappedText(ctx, body, left + pad, startY, maxW - pad * 2, lineH);
      ctx.restore();
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8 * sx;
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
    const stream = els.canvas.captureStream(30);
    const audio = state.stream?.getAudioTracks()[0];
    if (audio) stream.addTrack(audio);
    state.chunks = [];
    state.mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
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
    alert("Recording saved — use Share or Files to move it to Photos.");
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

      if (mode.includes("e")) L.w = Math.min(100 - L.x, Math.max(50, start.w + dx));
      if (mode.includes("w")) {
        const nw = Math.max(50, start.w - dx);
        L.x = Math.max(0, start.x + (start.w - nw));
        L.w = nw;
      }
      if (mode.includes("se")) {
        L.fontScale = Math.min(1.6, Math.max(0.6, start.fontScale + dy * 0.02 + dx * 0.01));
        L.frameH = Math.min(65, Math.max(28, start.frameH + dy * 0.5));
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

  els.stage.addEventListener(
    "touchstart",
    (e) => {
      if (state.playing || e.target.closest(".resize-handle")) return;
      state.scrollTouchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  els.stage.addEventListener(
    "touchmove",
    (e) => {
      if (state.playing || state.scrollTouchY == null) return;
      const dy = e.touches[0].clientY - state.scrollTouchY;
      state.scrollTouchY = e.touches[0].clientY;
      setOffset(state.offset + dy);
    },
    { passive: true }
  );
  els.stage.addEventListener("touchend", () => {
    state.scrollTouchY = null;
  });

  window.addEventListener("resize", () => {
    if (!els.root.classList.contains("hidden")) {
      updateSpacers();
    }
  });

  els.btnClose.addEventListener("click", close);
  els.btnFlip.addEventListener("click", (e) => {
    e.stopPropagation();
    flipCamera();
  });
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
    deps.saveSettings();
  });

  els.root.addEventListener("click", (e) => {
    if (e.target.closest(".rec-controls-bar, .prompter-frame, .resize-handle, .scroll-column")) return;
    els.controls.classList.toggle("hidden-ui");
  });

  return { open, close };
}
