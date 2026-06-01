/** Camera + resizable teleprompter overlay + video recording */

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
    box: { x: 4, w: 92, h: 38 },
    drag: null,
    scrollTouchY: null,
    wakeLock: null,
  };

  const els = {
    root: $("#recorder"),
    video: $("#camera"),
    canvas: $("#composite"),
    box: $("#prompter-box"),
    text: $("#recorder-text"),
    scrollInner: $("#box-scroll-inner"),
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

  /** Top edge is fixed under the camera; only width, horizontal inset, and height adjust. */
  function normalizeBox(box) {
    if (!box) return { x: 4, w: 92, h: 38 };
    return {
      x: Math.min(20, Math.max(0, box.x ?? 4)),
      w: Math.min(100, Math.max(40, box.w ?? 92)),
      h: Math.min(70, Math.max(18, box.h ?? 38)),
    };
  }

  function boxPx() {
    const rect = els.box.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height, vw, vh };
  }

  function applyBoxDOM() {
    const b = state.box;
    els.box.style.top = "";
    els.box.style.left = `${b.x}%`;
    els.box.style.width = `${b.w}%`;
    els.box.style.height = `${b.h}%`;
  }

  function applyTextStyles() {
    const t = els.text;
    const scale = Math.min(1, state.box.w / 84);
    const fontSize = settings.fontSize * scale * 0.45;
    t.style.fontSize = `${fontSize}px`;
    t.style.lineHeight = `${(fontSize + settings.lineSpacing * scale * 0.4) / fontSize}`;
    t.style.color = settings.textColor;
    t.style.paddingLeft = t.style.paddingRight = `${settings.margin * scale * 0.3}px`;
    t.style.transform = settings.mirror ? "scaleX(-1)" : "";
    els.box.style.background = hexToRgba(settings.bgColor, 0.82);
    els.readingLine.classList.toggle("hidden", !settings.guide);
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

  function setOffset(y) {
    const inner = els.scrollInner;
    const max = Math.max(0, inner.scrollHeight - inner.clientHeight);
    state.offset = Math.min(0, Math.max(-max, y));
    els.text.style.transform = `translateY(${state.offset}px)`;
  }

  function maxScroll() {
    const inner = els.scrollInner;
    return Math.max(0, inner.scrollHeight - inner.clientHeight);
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
    const constraints = {
      audio: true,
      video: {
        facingMode: state.facing,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };
    try {
      state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      alert("Camera access is required to record. Allow camera & mic in Settings → Safari.");
      throw err;
    }
    els.video.srcObject = state.stream;
    await els.video.play();
  }

  function stopCamera() {
    state.stream?.getTracks().forEach((t) => t.stop());
    state.stream = null;
    els.video.srcObject = null;
  }

  function pickMimeType() {
    const candidates = [
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  function drawCompositeFrame() {
    const v = els.video;
    if (!v.videoWidth) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (els.canvas.width !== w) els.canvas.width = w;
    if (els.canvas.height !== h) els.canvas.height = h;

    ctx.drawImage(v, 0, 0, w, h);

    const b = boxPx();
    const sx = w / b.vw;
    const sy = h / b.vh;
    const bx = b.x * sx;
    const by = b.y * sy;
    const bw = b.w * sx;
    const bh = b.h * sy;

    ctx.fillStyle = hexToRgba(settings.bgColor, 0.82);
    ctx.fillRect(bx, by, bw, bh);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();

    const scale = Math.min(1, state.box.w / 84);
    const fontSize = settings.fontSize * scale * 0.45 * (w / b.vw);
    const lineH = fontSize + settings.lineSpacing * scale * 0.4 * (w / b.vw);
    const pad = settings.margin * scale * 0.3 * (w / b.vw);
    const lines = (state.script?.body || "").split("\n");
    const readingY = by + bh * 0.72;

    ctx.fillStyle = settings.textColor;
    ctx.font = `500 ${fontSize}px -apple-system, sans-serif`;
    ctx.textAlign = "left";
    if (settings.mirror) {
      ctx.translate(bx + bw, by);
      ctx.scale(-1, 1);
      ctx.translate(-bx - bw, 0);
    }

    let y = by + bh * 0.06 + state.offset * sy;
    for (const line of lines) {
      const words = line.split(" ");
      let row = "";
      for (const word of words) {
        const test = row ? `${row} ${word}` : word;
        if (ctx.measureText(test).width > bw - pad * 2 && row) {
          ctx.fillText(row, bx + pad, y);
          y += lineH;
          row = word;
        } else row = test;
      }
      if (row) {
        ctx.fillText(row, bx + pad, y);
        y += lineH;
      }
      y += lineH * 0.15;
    }

    if (settings.guide) {
      ctx.strokeStyle = "rgba(255, 159, 10, 0.5)";
      ctx.lineWidth = 2 * sx;
      ctx.beginPath();
      ctx.moveTo(bx, readingY);
      ctx.lineTo(bx + bw, readingY);
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

  function startRecording() {
    if (state.recording) return;
    drawCompositeFrame();
    const mime = pickMimeType();
    const canvasStream = els.canvas.captureStream(30);
    const audioTrack = state.stream?.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    state.chunks = [];
    try {
      state.mediaRecorder = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : undefined);
    } catch {
      state.mediaRecorder = new MediaRecorder(canvasStream);
    }
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) state.chunks.push(e.data);
    };
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
    const url = URL.createObjectURL(blob);
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const name = `${state.script?.title || "recording"}-${Date.now()}.${ext}`;

    if (navigator.share && navigator.canShare?.({ files: [new File([blob], name, { type })] })) {
      const file = new File([blob], name, { type });
      navigator.share({ files: [file], title: name }).catch(() => download(url, name));
    } else {
      download(url, name);
    }
    URL.revokeObjectURL(url);
  }

  function download(url, name) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    alert("Recording saved. Check Downloads or Files, or use Share to save to Photos.");
  }

  async function open(script) {
    state.script = script;
    state.offset = 0;
    state.playing = false;
    state.facing = "user";
    state.box = normalizeBox(settings.prompterBox);
    els.title.textContent = script.title;
    els.text.textContent = script.body;
    els.speed.value = settings.speed;
    setOffset(0);
    applyBoxDOM();
    applyTextStyles();

    els.root.classList.remove("hidden");
    els.root.setAttribute("aria-hidden", "false");

    try {
      await startCamera();
      startCompositeLoop();
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

  // Resize only — top stays anchored under the camera
  function pointerBoxInteraction(e) {
    const handle = e.target.closest("[data-handle]");
    if (!handle) return;

    e.preventDefault();
    const startX = e.clientX ?? e.touches?.[0]?.clientX;
    const startY = e.clientY ?? e.touches?.[0]?.clientY;
    const startBox = { ...state.box };
    const mode = handle.dataset.handle;

    const onMove = (ev) => {
      const cx = ev.clientX ?? ev.touches?.[0]?.clientX;
      const cy = ev.clientY ?? ev.touches?.[0]?.clientY;
      const dx = ((cx - startX) / window.innerWidth) * 100;
      const dy = ((cy - startY) / window.innerHeight) * 100;
      const b = { ...startBox };
      const maxH = 72;

      if (mode.includes("e")) b.w = Math.min(100 - b.x, Math.max(40, startBox.w + dx));
      if (mode.includes("s")) b.h = Math.min(maxH, Math.max(18, startBox.h + dy));
      if (mode.includes("w")) {
        const nw = Math.max(40, startBox.w - dx);
        b.x = Math.max(0, startBox.x + (startBox.w - nw));
        b.w = nw;
      }
      if (mode.includes("sw")) {
        const nw = Math.max(40, startBox.w - dx);
        b.x = Math.max(0, startBox.x + (startBox.w - nw));
        b.w = nw;
        b.h = Math.min(maxH, Math.max(18, startBox.h + dy));
      }
      if (mode.includes("se")) {
        b.w = Math.min(100 - b.x, Math.max(40, startBox.w + dx));
        b.h = Math.min(maxH, Math.max(18, startBox.h + dy));
      }

      state.box = normalizeBox(b);
      applyBoxDOM();
      applyTextStyles();
    };

    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      settings.prompterBox = { ...normalizeBox(state.box) };
      deps.saveSettings();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  els.box.addEventListener("pointerdown", pointerBoxInteraction);
  els.box.addEventListener("touchstart", pointerBoxInteraction, { passive: false });

  els.scrollInner.addEventListener(
    "touchstart",
    (e) => {
      if (state.playing) return;
      state.scrollTouchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  els.scrollInner.addEventListener(
    "touchmove",
    (e) => {
      if (state.playing || state.scrollTouchY == null) return;
      const dy = e.touches[0].clientY - state.scrollTouchY;
      state.scrollTouchY = e.touches[0].clientY;
      setOffset(state.offset + dy);
    },
    { passive: true }
  );
  els.scrollInner.addEventListener("touchend", () => {
    state.scrollTouchY = null;
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
    if (state.recording) stopRecording();
    else startRecording();
  });
  els.speed.addEventListener("input", (e) => {
    settings.speed = Number(e.target.value);
    deps.saveSettings?.();
  });

  els.root.addEventListener("click", (e) => {
    if (e.target.closest(".rec-controls-bar, .prompter-box, .resize-handle")) return;
    els.controls.classList.toggle("hidden-ui");
  });

  return { open, close, applyTextStyles };
}
