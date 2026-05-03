import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const STATE_DEFAULT = {
  video_path: "",
  video_url: "",
  file_name: "",
  fps: 24,
  frame_count: 1,
  duration: 0,
  in_frame: 0,
  out_frame: 0,
  use_inputs: false,
  media_type: "video",
};

const MIN_NODE_WIDTH = 620;
const DEFAULT_NODE_WIDTH = 700;
const DEFAULT_NODE_HEIGHT = 700;
const VIDEO_TO_WIDGET_MARGIN = 210;
const MIN_VIDEO_HEIGHT = 0;
const MAX_VIDEO_HEIGHT = 340;
const MIN_TIMELINE_HEIGHT = 96;
const MAX_TIMELINE_HEIGHT = 900;
const DEFAULT_TIMELINE_HEIGHT = 132;
const CONTROLS_HEIGHT = 48;
const SPLITTER_HEIGHT = 8;
const FIXED_WIDGET_HEIGHT = 34 + DEFAULT_TIMELINE_HEIGHT + CONTROLS_HEIGHT + SPLITTER_HEIGHT + 46;
const NODE_BOTTOM_PADDING = 8;

const icons = {
  first: `<svg viewBox="0 0 24 24"><path d="M5 5h2v14H5V5Zm4 7 5-5v4h5v2h-5v4l-5-5Z"/></svg>`,
  prev: `<svg viewBox="0 0 24 24"><path d="M15 7v10l-7-5 7-5Zm2 0h2v10h-2V7Z"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"/></svg>`,
  stop: `<svg viewBox="0 0 24 24"><path d="M7 7h10v10H7V7Z"/></svg>`,
  next: `<svg viewBox="0 0 24 24"><path d="M9 17V7l7 5-7 5ZM5 7h2v10H5V7Z"/></svg>`,
  last: `<svg viewBox="0 0 24 24"><path d="M17 5h2v14h-2V5Zm-2 7-5 5v-4H5v-2h5V7l5 5Z"/></svg>`,
  loop: `<svg viewBox="0 0 24 24"><path d="M7 7h8.4l-2-2L15 3.4 20 8l-5 4.6-1.6-1.6 2-2H7a3 3 0 0 0 0 6h1v2H7A5 5 0 0 1 7 7Zm10 10H8.6l2 2L9 20.6 4 16l5-4.6 1.6 1.6-2 2H17a3 3 0 0 0 0-6h-1V7h1a5 5 0 0 1 0 10Z"/></svg>`,
  inputArrow: `<svg viewBox="0 0 24 24"><path d="M20 17h-9a4 4 0 0 1-4-4V7.8l-3.1 3.1-1.4-1.4L8 4l5.5 5.5-1.4 1.4L9 7.8V13a2 2 0 0 0 2 2h9v2Z"/></svg>`,
  file: `<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6V2Zm7 1.8V8h4.2L13 3.8ZM8 4v16h9V10h-6V4H8Z"/></svg>`,
  audio: `<svg viewBox="0 0 24 24"><path d="M9 18V6h10v8h-2V8h-6v10a3 3 0 1 1-2-2.83V18Zm-2 1a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z"/></svg>`,
};

const VIDEO_EXTENSIONS = /\.(mp4|mov|mkv|webm|gif|avi|m4v)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i;
const MEDIA_EXTENSIONS = /\.(mp4|mov|mkv|webm|gif|avi|m4v|mp3|wav|flac|ogg|m4a|aac|opus)$/i;

function css() {
  if (document.getElementById("precut-style")) return;
  const style = document.createElement("style");
  style.id = "precut-style";
  style.textContent = `
    .precut-ui {
      --bg: #151719;
      --panel: #202224;
      --line: #3b3e42;
      --text: #e7e9ed;
      --muted: #a7adb6;
      --blue: #6ca5ff;
      --wave: #77a8ff;
      --yellow: #ffbd3e;
      --precut-btn-size: 42px;
      width: 100%;
      height: var(--precut-widget-height, auto);
      min-width: ${MIN_NODE_WIDTH - 16}px;
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      color: var(--text);
      background: linear-gradient(180deg, #202224, #17191b);
      border: 1px solid #111315;
      border-radius: 8px;
      box-sizing: border-box;
      font-family: Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif;
      overflow: hidden;
    }
    .precut-ui.loaded {
      box-shadow: inset 0 0 0 1px rgba(123,217,140,.22);
    }
    .precut-video {
      position: relative;
      width: 100%;
      flex: 1 1 auto;
      aspect-ratio: auto;
      min-height: 0;
      height: var(--precut-video-height, 320px);
      overflow: hidden;
      border: 1px solid #0e1011;
      border-radius: 7px;
      background: #0e1012;
    }
    .precut-video video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: #090a0b;
    }
    .precut-progress {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,.12);
      opacity: 0;
      transition: opacity 160ms ease;
      pointer-events: none;
    }
    .precut-progress.visible { opacity: 1; }
    .precut-progress span {
      display: block;
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #6ca5ff, #7bd98c);
      transition: width 120ms ease;
    }
    .precut-loaded-cue {
      position: absolute;
      top: 12px;
      right: 12px;
      padding: 5px 8px;
      border: 1px solid rgba(123,217,140,.4);
      border-radius: 6px;
      color: #bdf0c6;
      background: rgba(17,19,21,.78);
      font-size: 11px;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 180ms ease, transform 180ms ease;
      pointer-events: none;
    }
    .precut-ui.loaded .precut-loaded-cue {
      opacity: 1;
      transform: translateY(0);
    }
    .precut-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(6px, 1.4cqw, 14px);
      color: #8f969f;
      font-size: 13px;
      background: linear-gradient(135deg, #252b31, #101418 52%, #263128);
      text-align: center;
    }
    .precut-placeholder svg {
      width: clamp(42px, 10cqw, 118px);
      height: clamp(42px, 10cqw, 118px);
      fill: #77a8ff;
      opacity: .8;
      filter: drop-shadow(0 0 10px rgba(119,168,255,.18));
    }
    .precut-placeholder span {
      display: block;
    }
    .precut-placeholder.audio svg {
      width: clamp(64px, 14cqw, 150px);
      height: clamp(64px, 14cqw, 150px);
    }
    .precut-splitter {
      position: relative;
      flex: 0 0 ${SPLITTER_HEIGHT}px;
      height: ${SPLITTER_HEIGHT}px;
      cursor: ns-resize;
      border-radius: 999px;
    }
    .precut-splitter::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 54px;
      height: 2px;
      border-radius: 999px;
      background: rgba(255,255,255,.16);
      transform: translate(-50%, -50%);
      transition: background 120ms ease, box-shadow 120ms ease, width 120ms ease;
    }
    .precut-splitter:hover::before,
    .precut-splitter.resizing::before {
      width: 86px;
      background: var(--blue);
      box-shadow: 0 0 10px rgba(108,165,255,.42);
    }
    .precut-timeline {
      --in: 0%;
      --out: 100%;
      --in-label: 0%;
      --out-label: calc(100% - 40px);
      --in-label-top: 28px;
      --out-label-top: calc(100% - 50px);
      --playhead: 0%;
      position: relative;
      height: var(--precut-timeline-height, ${DEFAULT_TIMELINE_HEIGHT}px);
      flex: 0 0 var(--precut-timeline-height, ${DEFAULT_TIMELINE_HEIGHT}px);
      overflow: hidden;
      border: 1px solid #101214;
      border-radius: 7px;
      background:
        repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 34px),
        linear-gradient(180deg, #191b1d, #111315);
      cursor: ew-resize;
      user-select: none;
    }
    .precut-timecodes {
      position: absolute;
      inset: 2px 0 auto;
      height: 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #9ea4ac;
      font-size: 12px;
      pointer-events: none;
      z-index: 4;
      text-align: center;
    }
    .precut-timecodes span,
    .precut-timecodes strong { flex: 1 1 0; }
    .precut-timecodes strong { color: var(--blue); font-weight: 650; }
    .precut-wave {
      position: absolute;
      left: 0;
      right: 0;
      top: 36px;
      bottom: 30px;
      width: 100%;
      height: calc(100% - 72px);
      filter: drop-shadow(0 0 6px rgba(95,143,230,.28));
      pointer-events: none;
    }
    .precut-selection {
      position: absolute;
      left: var(--in);
      right: calc(100% - var(--out));
      top: var(--in-label-top);
      bottom: 30px;
      border: 2px solid var(--yellow);
      background: rgba(255,179,49,.16);
      pointer-events: none;
    }
    .precut-handle {
      position: absolute;
      top: 28px;
      display: grid;
      place-items: center;
      width: 40px;
      height: 20px;
      padding: 0;
      border: 2px solid var(--yellow);
      border-radius: 0;
      color: var(--yellow);
      background: #221c12;
      font-size: 11px;
      font-weight: 750;
      transform: none;
      box-sizing: border-box;
      pointer-events: none;
      z-index: 5;
    }
    .precut-handle::after {
      display: none;
    }
    .precut-handle.in { left: var(--in-label); top: var(--in-label-top); }
    .precut-handle.out {
      left: auto;
      right: calc(100% - var(--out));
      top: var(--out-label-top);
    }
    .precut-playhead {
      position: absolute;
      left: var(--playhead);
      top: 28px;
      bottom: 30px;
      width: 14px;
      background: transparent;
      pointer-events: none;
      z-index: 3;
      transform: translateX(-50%);
    }
    .precut-playhead::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 9px solid var(--blue);
      transform: translate(-50%, -100%);
    }
    .precut-playhead::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 5px;
      width: 3px;
      border-radius: 999px;
      background: linear-gradient(180deg, #72aaff, var(--blue));
      box-shadow: 0 0 8px rgba(108,165,255,.55);
      transform: translateX(-50%);
    }
    .precut-navigator {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 0;
      height: 18px;
      overflow: visible;
      border-radius: 999px;
      background: #373737;
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.35);
      z-index: 6;
      cursor: grab;
    }
    .precut-nav-window {
      position: absolute;
      left: 0;
      width: 100%;
      top: 0;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(180deg, #898989, #686868);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), 0 1px 2px rgba(0,0,0,.5);
    }
    .precut-nav-handle {
      position: absolute;
      top: 2px;
      width: 14px;
      height: 14px;
      border: 2px solid #c4cbd4;
      border-radius: 999px;
      background: #202224;
      box-shadow: 0 0 0 1px rgba(0,0,0,.55), 0 1px 4px rgba(0,0,0,.55);
      box-sizing: border-box;
      cursor: ew-resize;
    }
    .precut-nav-handle.left,
    .precut-nav-handle.right {
      left: 0;
      transform: translateX(-50%);
    }
    .precut-zoom-label {
      position: absolute;
      right: 10px;
      top: 31px;
      color: #ffd35a;
      background: rgba(17,19,21,.86);
      border: 1px solid rgba(255,211,90,.38);
      border-radius: 5px;
      padding: 4px 7px;
      font-size: 11px;
      opacity: 0;
      transition: opacity 140ms ease;
      pointer-events: none;
      z-index: 7;
    }
    .precut-navigator:hover ~ .precut-zoom-label { opacity: 1; }
    .precut-controls {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      gap: 18px;
      min-height: ${CONTROLS_HEIGHT}px;
      padding: 5px 8px;
      border: 1px solid #101214;
      border-radius: 7px;
      background: linear-gradient(180deg, #242629, #181a1c);
      box-sizing: border-box;
      overflow: visible;
    }
    .precut-control-group {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 0 0 auto;
    }
    .precut-marker-controls {
      margin-right: 0;
    }
    .precut-right-controls {
      margin-left: 0;
    }
    .precut-btn {
      display: grid;
      place-items: center;
      text-align: center;
      line-height: 1;
      min-width: 0;
      width: var(--precut-btn-size);
      height: var(--precut-btn-size);
      flex: 0 0 var(--precut-btn-size);
      aspect-ratio: 1 / 1;
      border: 1px solid #44484d;
      border-radius: 7px;
      color: #e2e5ea;
      background: linear-gradient(180deg, #303235, #1c1e20);
      cursor: pointer;
      transition: transform 90ms ease, filter 90ms ease, box-shadow 120ms ease, border-color 120ms ease;
      overflow: hidden;
      box-sizing: border-box;
    }
    .precut-btn:hover {
      border-color: #5b6269;
      filter: brightness(1.04);
    }
    .precut-btn:active {
      transform: translateY(1px) scale(.985);
      filter: brightness(1.12);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 0 12px rgba(108,165,255,.12);
    }
    .precut-btn svg { width: 21px; height: 21px; fill: currentColor; }
    .precut-btn.mark {
      width: var(--precut-btn-size);
      height: var(--precut-btn-size);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--yellow);
      border-color: rgba(255,189,62,.58);
      background: linear-gradient(180deg, #2d271b, #1b1710);
      font-size: 13px;
      font-weight: 800;
      line-height: 1;
      padding: 0;
      box-sizing: border-box;
    }
    .precut-btn.mark:active,
    .precut-btn.loop:active {
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.07), 0 0 13px rgba(255,189,62,.16);
    }
    .precut-btn.loop {
      color: #b8bec6;
      border-color: #44484d;
      background: linear-gradient(180deg, #303235, #1c1e20);
    }
    .precut-btn.loop.active {
      color: var(--yellow);
      border-color: rgba(255,189,62,.9);
      background: linear-gradient(180deg, #4b381c, #221b10);
      box-shadow: 0 0 0 1px rgba(255,189,62,.18), 0 0 14px rgba(255,189,62,.16);
    }
    .precut-load {
      width: auto;
      min-width: 132px;
      padding: 0 10px;
      color: #dce2eb;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      white-space: nowrap;
    }
    .precut-video-actions {
      position: static;
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      min-width: 0;
      flex-wrap: nowrap;
      overflow: visible;
    }
    .precut-video-actions .precut-btn {
      width: auto;
      height: 34px;
      min-width: 156px;
      flex: 0 0 156px;
      padding: 0 11px;
      border-color: rgba(255,255,255,.18);
      background: rgba(22,24,26,.82);
      backdrop-filter: blur(6px);
      font-size: 11px;
      grid-auto-flow: column;
      gap: 7px;
      align-content: center;
      justify-content: center;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .precut-video-actions .precut-btn svg {
      width: 16px;
      height: 16px;
    }
    .precut-logo {
      margin-left: auto;
      height: 34px;
      width: 190px;
      min-width: 190px;
      flex: 0 0 190px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 0 2px;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      pointer-events: none;
      user-select: none;
      opacity: .72;
      box-sizing: border-box;
    }
    .precut-logo-mark {
      width: 58px;
      height: 32px;
      display: block;
      flex: 0 0 auto;
      overflow: visible;
    }
    .precut-logo-mark path,
    .precut-logo-mark polygon {
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.8));
    }
    .precut-logo-text {
      color: #f2f4f7;
      font-size: 23px;
      line-height: 1;
      font-weight: 850;
      letter-spacing: .08em;
      text-shadow: 0 1px 2px rgba(0,0,0,.75);
    }
    .precut-readout {
      width: 128px;
      flex: 0 0 128px;
      height: var(--precut-btn-size);
      display: grid;
      place-items: center;
      border: 1px solid #4b4f55;
      border-radius: 7px;
      color: var(--blue);
      background: #16181a;
      font-size: 15px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      line-height: 1;
      text-align: center;
      overflow: hidden;
      box-sizing: border-box;
    }
    .precut-file { display: none; }
  `;
  document.head.appendChild(style);
}

function fmtTime(seconds, fps = 24) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const frames = Math.floor((seconds - totalSeconds) * fps);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

function readState(widget) {
  try {
    return { ...STATE_DEFAULT, ...(JSON.parse(widget?.value || "{}") || {}) };
  } catch {
    return { ...STATE_DEFAULT };
  }
}

function writeState(widget, state, node) {
  widget.value = JSON.stringify(state);
  node.setDirtyCanvas(true, true);
}

function setWidgetHidden(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
  widget.type = "hidden";
  widget.options ||= {};
  widget.options.hidden = true;
  for (const key of ["element", "inputEl", "domElement"]) {
    const element = widget[key];
    if (element?.style) {
      element.style.display = "none";
      element.style.height = "0";
      element.style.minHeight = "0";
      element.style.margin = "0";
      element.style.padding = "0";
      element.style.overflow = "hidden";
    }
  }
}

function hidePrecutStateTextarea(root) {
  const scope = root?.closest?.(".isolate") || root?.parentElement?.parentElement || root?.parentElement;
  if (!scope) return;
  for (const textarea of scope.querySelectorAll("textarea.comfy-multiline-input")) {
    if (root.contains(textarea)) continue;
    const holder = textarea.closest(".dom-widget") || textarea.parentElement;
    for (const element of [textarea, holder]) {
      if (!element?.style) continue;
      element.style.display = "none";
      element.style.height = "0";
      element.style.minHeight = "0";
      element.style.maxHeight = "0";
      element.style.margin = "0";
      element.style.padding = "0";
      element.style.border = "0";
      element.style.overflow = "hidden";
      element.style.pointerEvents = "none";
    }
  }
}

function makeButton(className, title, icon, onClick) {
  const btn = document.createElement("button");
  btn.className = `precut-btn ${className || ""}`.trim();
  btn.type = "button";
  btn.title = title;
  btn.innerHTML = icon;
  btn.addEventListener("click", onClick);
  return btn;
}

function videoPathFromNode(sourceNode) {
  const values = [];
  for (const widget of sourceNode?.widgets || []) {
    if (typeof widget.name === "string" && /video|path|file|filename/i.test(widget.name)) {
      if (typeof widget.value === "string") values.unshift(widget.value);
      if (typeof widget.options?.value === "string") values.unshift(widget.options.value);
    }
    if (typeof widget.value === "string") values.push(widget.value);
    if (typeof widget.options?.value === "string") values.push(widget.options.value);
  }
  for (const value of sourceNode?.widgets_values || []) {
    if (typeof value === "string") values.push(value);
  }
  for (const property of ["video", "video_path", "path", "filename", "file", "name"]) {
    const value = sourceNode?.properties?.[property];
    if (typeof value === "string") values.push(value);
  }
  return values.find((value) => MEDIA_EXTENSIONS.test(value.trim())) || "";
}

app.registerExtension({
  name: "PRECUT.UI",
  async nodeCreated(node) {
    if (node.comfyClass !== "PRECUT") return;
    css();

    node.resizable = true;
    const stateWidget = node.widgets?.find((w) => w.name === "precut_state");
    setWidgetHidden(stateWidget);

    let state = readState(stateWidget);
    const isFreshPrecutNode = !stateWidget?.value || stateWidget.value === "{}";
    if (isFreshPrecutNode) {
      node.size = [DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT];
    } else {
      node.size = [
        Math.max(MIN_NODE_WIDTH, node.size?.[0] || DEFAULT_NODE_WIDTH),
        node.size?.[1] || DEFAULT_NODE_HEIGHT,
      ];
    }
    let zoom = 1;
    let zoomCenter = 0.5;
    let hoverFrame = 0;
    let dragging = null;
    let rangeDragOffset = 0;
    let navDragging = null;
    let waveformPeaks = [];
    let pointerInside = false;

    const root = document.createElement("div");
    root.className = "precut-ui";
    root.tabIndex = 0;
    root.addEventListener("pointerenter", () => {
      pointerInside = true;
      root.focus({ preventScroll: true });
    });
    root.addEventListener("pointerleave", () => {
      pointerInside = false;
    });

    const videoWrap = document.createElement("div");
    videoWrap.className = "precut-video";
    const video = document.createElement("video");
    video.controls = false;
    video.muted = false;
    video.playsInline = true;
    const placeholder = document.createElement("div");
    placeholder.className = "precut-placeholder";
    function setPlaceholder(message, mode = "empty") {
      placeholder.classList.toggle("audio", mode === "audio");
      if (mode === "audio") {
        placeholder.innerHTML = `${icons.audio}<span>${message}</span>`;
      } else {
        placeholder.textContent = message;
      }
    }
    setPlaceholder("Load a media file or use connected media inputs");
    const progress = document.createElement("div");
    progress.className = "precut-progress";
    const progressFill = document.createElement("span");
    progress.appendChild(progressFill);
    const loadedCue = document.createElement("div");
    loadedCue.className = "precut-loaded-cue";
    loadedCue.textContent = "Loaded";
    const videoActions = document.createElement("div");
    videoActions.className = "precut-video-actions";
    videoWrap.append(video, placeholder, videoActions, progress, loadedCue);

    const timeline = document.createElement("div");
    timeline.className = "precut-timeline";
    timeline.innerHTML = `
      <div class="precut-timecodes"></div>
      <div class="precut-selection"></div>
      <canvas class="precut-wave"></canvas>
      <div class="precut-handle in">IN</div>
      <div class="precut-handle out">OUT</div>
      <div class="precut-playhead"></div>
      <div class="precut-navigator">
        <div class="precut-nav-window"></div>
        <div class="precut-nav-handle left"></div>
        <div class="precut-nav-handle right"></div>
      </div>
      <div class="precut-zoom-label">Wheel = zoom</div>
    `;
    const timecodes = timeline.querySelector(".precut-timecodes");
    const waveCanvas = timeline.querySelector(".precut-wave");
    const navigator = timeline.querySelector(".precut-navigator");
    const navWindow = timeline.querySelector(".precut-nav-window");
    const navLeft = timeline.querySelector(".precut-nav-handle.left");
    const navRight = timeline.querySelector(".precut-nav-handle.right");
    const splitter = document.createElement("div");
    splitter.className = "precut-splitter";
    splitter.title = "Drag to resize the timeline";

    const controls = document.createElement("div");
    controls.className = "precut-controls";

    const fileInput = document.createElement("input");
    fileInput.className = "precut-file";
    fileInput.type = "file";
    fileInput.accept = ".mp4,.mov,.mkv,.webm,.gif,.avi,.m4v,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus,video/*,audio/*";

    const firstBtn = makeButton("first", "Go to IN - Up arrow. Double-click: go to timeline start.", icons.first, () => seekFrame(state.in_frame));
    const prevBtn = makeButton("prev", "Previous frame - Left arrow", icons.prev, () => seekFrame(currentFrame() - 1));
    const playBtn = makeButton("play", "Play / stop - Space", icons.play, () => togglePlay());
    const nextBtn = makeButton("next", "Next frame - Right arrow", icons.next, () => seekFrame(currentFrame() + 1));
    const lastBtn = makeButton("last", "Go to OUT - Down arrow. Double-click: go to timeline end.", icons.last, () => seekFrame(state.out_frame));
    const loadFileBtn = makeButton(
      "load precut-load",
      "Load a video or audio file from disk.",
      `${icons.file}<span>LOAD MEDIA FILE</span>`,
      () => fileInput.click()
    );
    const loadInputsBtn = makeButton(
      "load-inputs precut-load",
      "Load from connected VIDEO or AUDIO input. Connect only one media input at a time.",
      `${icons.inputArrow}<span>LOAD MEDIA INPUTS</span>`,
      () => loadFromInputs()
    );
    const markInBtn = makeButton("mark mark-in", "Mark IN at playhead - I. Double-click: mark IN at first frame.", "IN", () => markIn());
    const markOutBtn = makeButton("mark mark-out", "Mark OUT at playhead - O. Double-click: mark OUT at last frame.", "OUT", () => markOut());
    const readout = document.createElement("div");
    readout.className = "precut-readout";
    readout.title = "Selected IN to OUT duration";
    const loopBtn = makeButton("loop", "Loop IN to OUT", icons.loop, () => toggleLoop());
    const logo = document.createElement("div");
    logo.className = "precut-logo";
    logo.innerHTML = `
      <svg class="precut-logo-mark" viewBox="0 0 74 40" aria-hidden="true">
        <path d="M18 5H6v30h12" fill="none" stroke="#f4f7fb" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"/>
        <path d="M56 5h12v30H56" fill="none" stroke="#f4f7fb" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"/>
        <path d="M29 10v20l18-10-18-10Z" fill="#f4f7fb"/>
      </svg>
      <span class="precut-logo-text">PRECUT</span>
    `;

    videoActions.append(loadInputsBtn, loadFileBtn, logo, fileInput);
    const markerControls = document.createElement("div");
    markerControls.className = "precut-control-group precut-marker-controls";
    const transportControls = document.createElement("div");
    transportControls.className = "precut-control-group precut-transport-controls";
    const rightControls = document.createElement("div");
    rightControls.className = "precut-control-group precut-right-controls";
    markerControls.append(markInBtn, markOutBtn);
    transportControls.append(firstBtn, prevBtn, playBtn, nextBtn, lastBtn);
    rightControls.append(loopBtn, readout);
    controls.append(markerControls, transportControls, rightControls);
    root.append(videoActions, videoWrap, splitter, timeline, controls);
    hidePrecutStateTextarea(root);

    const widget = node.addDOMWidget("precut", "precut", root, {
      getValue: () => stateWidget.value,
      setValue: (value) => {
        if (value) {
          stateWidget.value = value;
          state = readState(stateWidget);
          hydrateVideo();
          render();
        }
      },
      margin: 0,
      getMinHeight: () => minimumWidgetHeight(),
      getMaxHeight: () => node._precutWidgetHeight || minimumWidgetHeight(),
      getHeight: () => node._precutWidgetHeight || minimumWidgetHeight(),
    });
    node._precutWidget = widget;
    hidePrecutStateTextarea(root);

    function timelineHeight() {
      return Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, node._precutTimelineHeight || DEFAULT_TIMELINE_HEIGHT));
    }

    function fixedWidgetHeight(timelineValue = timelineHeight()) {
      return 34 + timelineValue + CONTROLS_HEIGHT + SPLITTER_HEIGHT + 46;
    }

    function minimumWidgetHeight() {
      return MIN_VIDEO_HEIGHT + fixedWidgetHeight(MIN_TIMELINE_HEIGHT);
    }

    node._precutTimelineHeight = isFreshPrecutNode
      ? Math.max(
          MIN_TIMELINE_HEIGHT,
          Math.min(
            MAX_TIMELINE_HEIGHT,
            Math.round(((DEFAULT_NODE_HEIGHT - nodeChromeHeight()) - fixedWidgetHeight(0)) / 3)
          )
        )
      : DEFAULT_TIMELINE_HEIGHT;

    function nodeChromeHeight() {
      const liteGraph = globalThis.LiteGraph;
      const titleHeight = liteGraph?.NODE_TITLE_HEIGHT ?? 30;
      const rowHeight = liteGraph?.NODE_SLOT_HEIGHT ?? 20;
      const widgetRowHeight = (liteGraph?.NODE_WIDGET_HEIGHT ?? 20) + 4;
      const slotRows = Math.max(node.inputs?.length || 0, node.outputs?.length || 0);
      let nativeWidgetRows = 0;
      for (const candidate of node.widgets || []) {
        if (candidate === widget) continue;
        if (candidate.hidden || candidate.type === "hidden" || candidate.type === "converted-widget") continue;
        const size = candidate.computeSize?.();
        if (Array.isArray(size) && size[1] <= 0) continue;
        nativeWidgetRows++;
      }
      return titleHeight + slotRows * rowHeight + nativeWidgetRows * widgetRowHeight + NODE_BOTTOM_PADDING;
    }

    let syncingSize = false;
    function setNodeSize(width, height) {
      if (typeof node.setSize === "function") {
        node.setSize([width, height]);
      } else {
        node.size = [width, height];
      }
    }

    function syncWidgetSize() {
      if (syncingSize) return;
      syncingSize = true;
      const width = Math.max(MIN_NODE_WIDTH, node.size?.[0] || MIN_NODE_WIDTH);
      const minHeight = minimumWidgetHeight();
      const availableHeight = Math.max(0, (node.size?.[1] || 0) - nodeChromeHeight());
      const requestedHeight = availableHeight;
      const height = Math.max(minHeight, requestedHeight);
      const maxTimelineForHeight = Math.max(
        MIN_TIMELINE_HEIGHT,
        height - fixedWidgetHeight(0) - MIN_VIDEO_HEIGHT
      );
      const actualTimelineHeight = Math.max(
        MIN_TIMELINE_HEIGHT,
        Math.min(MAX_TIMELINE_HEIGHT, maxTimelineForHeight, node._precutTimelineHeight || DEFAULT_TIMELINE_HEIGHT)
      );
      node._precutTimelineHeight = actualTimelineHeight;
      const videoHeight = Math.max(MIN_VIDEO_HEIGHT, height - fixedWidgetHeight(actualTimelineHeight));
      node._precutWidgetHeight = height;
      root.style.setProperty("--precut-video-height", `${videoHeight}px`);
      root.style.setProperty("--precut-timeline-height", `${actualTimelineHeight}px`);
      root.style.setProperty("--precut-widget-height", `${height}px`);
      root.style.height = `${height}px`;
      splitter.classList.remove("collapsed");
      splitter.title = "Drag to resize the timeline";
      hidePrecutStateTextarea(root);
      widget.options.getMinHeight = () => minHeight;
      widget.options.getMaxHeight = () => Math.max(node._precutWidgetHeight || height, minHeight);
      widget.options.getHeight = () => node._precutWidgetHeight || height;
      widget.computeSize = () => [width, node._precutWidgetHeight || height];
      const minNodeHeight = Math.ceil(nodeChromeHeight() + minHeight);
      if (node.size[0] !== width || node.size[1] < minNodeHeight) {
        setNodeSize(width, Math.max(node.size?.[1] || 0, minNodeHeight));
      }
      node.setDirtyCanvas(true, true);
      requestAnimationFrame(() => {
        syncingSize = false;
      });
    }
    node._precutSyncLayout = syncWidgetSize;

    const originalOnResize = node.onResize;
    node.onResize = function () {
      originalOnResize?.apply(this, arguments);
      syncWidgetSize();
      render();
    };

    function persist() {
      writeState(stateWidget, state, node);
      render();
    }

    function duration() {
      return state.duration || (state.frame_count / state.fps);
    }

    function currentFrame() {
      return Math.max(0, Math.min(state.frame_count - 1, Math.round((video.currentTime || 0) * state.fps)));
    }

    function frameToSeconds(frame) {
      return Math.max(0, frame / state.fps);
    }

    function seekFrame(frame) {
      frame = Math.max(0, Math.min(state.frame_count - 1, Math.round(frame)));
      video.currentTime = frameToSeconds(frame);
      render();
    }

    function markIn() {
      const frame = currentFrame();
      state.in_frame = frame;
      if (state.out_frame < frame) state.out_frame = frame;
      persist();
    }

    function markOut() {
      const frame = currentFrame();
      state.out_frame = frame;
      if (state.in_frame > frame) state.in_frame = frame;
      persist();
    }

    function markInAtStart() {
      state.in_frame = 0;
      if (state.out_frame < state.in_frame) state.out_frame = state.in_frame;
      persist();
    }

    function markOutAtEnd() {
      state.out_frame = Math.max(state.in_frame, state.frame_count - 1);
      persist();
    }

    function setProgress(percent, visible = true) {
      progress.classList.toggle("visible", visible);
      progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    function visibleRange() {
      const total = Math.max(1, state.frame_count - 1);
      const visible = Math.max(1, total / zoom);
      const center = zoomCenter * total;
      let start = center - visible / 2;
      let end = center + visible / 2;
      if (start < 0) {
        end -= start;
        start = 0;
      }
      if (end > total) {
        start -= end - total;
        end = total;
      }
      return [Math.max(0, start), Math.min(total, end)];
    }

    function setVisibleRange(start, end) {
      const total = Math.max(1, state.frame_count - 1);
      const minVisible = Math.max(1, Math.round(total / 32));
      start = Math.max(0, Math.min(total - minVisible, start));
      end = Math.max(start + minVisible, Math.min(total, end));
      if (end > total) {
        start = Math.max(0, total - (end - start));
        end = total;
      }
      const visible = Math.max(1, end - start);
      zoom = Math.max(1, Math.min(32, total / visible));
      zoomCenter = Math.max(0, Math.min(1, (start + visible / 2) / total));
    }

    function frameToPct(frame) {
      const [start, end] = visibleRange();
      return Math.max(0, Math.min(100, ((frame - start) / Math.max(1, end - start)) * 100));
    }

    function pctToFrame(percent) {
      const [start, end] = visibleRange();
      return Math.round(start + (percent / 100) * (end - start));
    }

    function frameFromEvent(event) {
      const rect = timeline.getBoundingClientRect();
      const pct = ((event.clientX - rect.left) / rect.width) * 100;
      return Math.max(0, Math.min(state.frame_count - 1, pctToFrame(pct)));
    }

    function nearestHandle(frame) {
      const [start, end] = visibleRange();
      const framesPerPixel = (end - start) / Math.max(1, timeline.getBoundingClientRect().width);
      const threshold = Math.max(2, framesPerPixel * 12);
      const inDistance = Math.abs(frame - state.in_frame);
      const outDistance = Math.abs(frame - state.out_frame);
      if (inDistance <= threshold && inDistance <= outDistance) return "in";
      if (outDistance <= threshold) return "out";
      return null;
    }

    function nearestPlayhead(frame) {
      const [start, end] = visibleRange();
      const framesPerPixel = (end - start) / Math.max(1, timeline.getBoundingClientRect().width);
      const threshold = Math.max(2, framesPerPixel * 10);
      return Math.abs(frame - currentFrame()) <= threshold;
    }

    function overSelectedRange(event, frame) {
      if (frame < state.in_frame || frame > state.out_frame) return false;
      const rect = timeline.getBoundingClientRect();
      const y = event.clientY - rect.top;
      return y >= 28 && y <= rect.height - 18;
    }

    function renderTimecodes() {
      const [start, end] = visibleRange();
      const points = [0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => Math.round(start + (end - start) * p));
      timecodes.innerHTML = points
        .map((frame) => {
          const text = fmtTime(frameToSeconds(frame), state.fps);
          return frame === currentFrame() ? `<strong>${text}</strong>` : `<span>${text}</span>`;
        })
        .join("");
    }

    function renderNavigator() {
      const total = Math.max(1, state.frame_count - 1);
      const [start, end] = visibleRange();
      const left = (start / total) * 100;
      const right = (end / total) * 100;
      navWindow.style.left = `${left}%`;
      navWindow.style.width = `${Math.max(1, right - left)}%`;
      navLeft.style.left = `${left}%`;
      navRight.style.left = `${right}%`;
    }

    function drawWaveform() {
      const rect = waveCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (waveCanvas.width !== width || waveCanvas.height !== height) {
        waveCanvas.width = width;
        waveCanvas.height = height;
      }

      const ctx = waveCanvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(119, 168, 255, 0.9)";
      ctx.lineWidth = Math.max(1, dpr);

      const peaks = waveformPeaks;
      if (!peaks.length) {
        ctx.strokeStyle = "rgba(119, 168, 255, 0.35)";
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }
      const [startFrame, endFrame] = visibleRange();
      const totalFrames = Math.max(1, state.frame_count - 1);
      const startPeak = Math.floor((startFrame / totalFrames) * (peaks.length - 1));
      const endPeak = Math.ceil((endFrame / totalFrames) * (peaks.length - 1));
      const visiblePeaks = peaks.slice(startPeak, Math.max(startPeak + 1, endPeak + 1));
      const mid = height / 2;

      ctx.beginPath();
      for (let x = 0; x < width; x += Math.max(1, Math.floor(2 * dpr))) {
        const index = Math.floor((x / width) * visiblePeaks.length);
        const amp = Math.max(0.015, visiblePeaks[Math.min(visiblePeaks.length - 1, index)] || 0);
        const y = amp * mid * 0.92;
        ctx.moveTo(x + 0.5, mid - y);
        ctx.lineTo(x + 0.5, mid + y);
      }
      ctx.stroke();
    }

    function render() {
      state.in_frame = Math.max(0, Math.min(state.in_frame, state.frame_count - 1));
      state.out_frame = Math.max(state.in_frame, Math.min(state.out_frame, state.frame_count - 1));
      const inPct = frameToPct(state.in_frame);
      const outPct = frameToPct(state.out_frame);
      const headPct = frameToPct(currentFrame());
      const samePoint = state.in_frame === state.out_frame;
      const sameLabel = inPct <= 50
        ? `clamp(0px, ${inPct}%, calc(100% - 40px))`
        : `clamp(0px, calc(${inPct}% - 40px), calc(100% - 40px))`;
      timeline.style.setProperty("--in", `${inPct}%`);
      timeline.style.setProperty("--out", `${outPct}%`);
      timeline.style.setProperty(
        "--in-label",
        samePoint ? sameLabel : `clamp(0px, ${inPct}%, calc(100% - 40px))`
      );
      timeline.style.setProperty(
        "--out-label",
        samePoint ? sameLabel : `clamp(0px, calc(${outPct}% - 40px), calc(100% - 40px))`
      );
      timeline.style.setProperty("--in-label-top", "28px");
      timeline.style.setProperty("--out-label-top", "calc(100% - 50px)");
      timeline.style.setProperty("--playhead", `${headPct}%`);
      readout.textContent = fmtTime((state.out_frame - state.in_frame + 1) / state.fps, state.fps);
      const audioOnly = state.media_type === "audio";
      placeholder.style.display = state.video_url && !audioOnly ? "none" : "flex";
      video.style.opacity = audioOnly ? "0" : "1";
      renderTimecodes();
      renderNavigator();
      requestAnimationFrame(drawWaveform);
    }
    node._precutRender = render;

    function setMetadataFromVideo() {
      const videoDuration = Number.isFinite(video.duration) ? video.duration : 0;
      state.duration = videoDuration;
      state.fps = state.fps || 24;
      state.frame_count = Math.max(1, Math.round(videoDuration * state.fps));
      if (!state.out_frame || state.out_frame >= state.frame_count) {
        state.out_frame = Math.max(0, state.frame_count - 1);
      }
      persist();
    }

    function hydrateVideo() {
      if (!state.video_url) return;
      video.src = api.apiURL(state.video_url);
      video.load();
      loadWaveform();
    }

    async function loadWaveform() {
      if (!state.video_path) {
        waveformPeaks = [];
        render();
        return;
      }
      try {
      const response = await fetch(api.apiURL(`/precut/waveform?path=${encodeURIComponent(state.video_path)}`));
      const result = await response.json();
      waveformPeaks = Array.isArray(result.peaks) ? result.peaks : [];
      } catch {
        waveformPeaks = [];
      }
      render();
    }

    async function uploadVideo(file) {
      root.classList.remove("loaded");
      setProgress(0, true);
      const result = await new Promise((resolve, reject) => {
        const form = new FormData();
        form.append("video", file);
        const request = new XMLHttpRequest();
        request.open("POST", api.apiURL("/precut/upload_video"));
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress((event.loaded / event.total) * 92, true);
        };
        request.onload = () => {
          let payload = {};
          try {
            payload = JSON.parse(request.responseText || "{}");
          } catch {
            payload = {};
          }
          if (request.status >= 200 && request.status < 300) resolve(payload);
          else reject(new Error(payload.error || "Failed to upload media."));
        };
        request.onerror = () => reject(new Error("Failed to upload media."));
        request.send(form);
      });
      setProgress(96, true);
      const mediaType = result.media_type || (AUDIO_EXTENSIONS.test(file.name) ? "audio" : "video");
      state = {
        ...state,
        video_path: result.path,
        video_url: result.url,
        file_name: result.name,
        in_frame: 0,
        out_frame: 0,
        use_inputs: false,
        media_type: mediaType,
      };
      if (mediaType === "audio") {
        setPlaceholder(`Audio loaded: ${result.name}`, "audio");
      }
      video.src = URL.createObjectURL(file);
      video.load();
      await loadWaveform();
      setProgress(100, true);
      setTimeout(() => setProgress(100, false), 650);
      root.classList.add("loaded");
      setTimeout(() => root.classList.remove("loaded"), 1800);
      persist();
    }

    function connectedMediaInputs() {
      const connected = { video: null, audio: null };
      for (const input of node.inputs || []) {
        const name = (input.name || "").toLowerCase();
        if (!["audio", "video"].includes(name)) continue;
        const link = app.graph?.links?.[input.link];
        if (!link) continue;
        const sourceNode = app.graph.getNodeById(link.origin_id);
        if (sourceNode) connected[name] = sourceNode;
      }
      return connected;
    }

    async function registerVideoPath(path) {
      const response = await fetch(api.apiURL("/precut/register_video_path"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load connected video input.");
      return result;
    }

    async function loadFromInputs() {
      root.classList.remove("loaded");
      setProgress(20, true);
      const connected = connectedMediaInputs();
      const sourceNodes = [connected.video, connected.audio].filter(Boolean);
      const videoPath = sourceNodes.map(videoPathFromNode).find(Boolean);
      try {
        if (connected.video && connected.audio) {
          throw new Error("Connect either VIDEO or AUDIO to PRECUT, not both, before using LOAD MEDIA INPUTS.");
        }
        if (videoPath) {
          const result = await registerVideoPath(videoPath);
          const mediaType = result.media_type || (AUDIO_EXTENSIONS.test(result.name || videoPath) ? "audio" : "video");
          state = {
            ...state,
            video_path: result.path,
            video_url: result.url,
            file_name: result.name,
            in_frame: 0,
            out_frame: 0,
            use_inputs: false,
            media_type: mediaType,
          };
          if (mediaType === "audio") {
            setPlaceholder(`Audio loaded: ${result.name}`, "audio");
          }
          hydrateVideo();
          await loadWaveform();
          setProgress(100, true);
          setTimeout(() => setProgress(100, false), 650);
          root.classList.add("loaded");
          setTimeout(() => root.classList.remove("loaded"), 1800);
          persist();
          return;
        }

        state = {
          ...state,
          video_path: "",
          video_url: "",
          file_name: "connected inputs",
          use_inputs: true,
          media_type: "inputs",
        };
        if (sourceNodes.length && state.frame_count <= 1) {
          state.fps = state.fps || 24;
          state.frame_count = state.fps * 60;
          state.in_frame = 0;
          state.out_frame = state.frame_count - 1;
        }
        waveformPeaks = [];
        setPlaceholder(
          "Connected media inputs selected. Audio-only inputs will trim on workflow run.",
          "audio"
        );
        setProgress(100, true);
        setTimeout(() => setProgress(100, false), 650);
        root.classList.add("loaded");
        setTimeout(() => root.classList.remove("loaded"), 1800);
        persist();
      } catch (err) {
        setProgress(0, false);
        setPlaceholder(err.message || String(err));
        render();
      } finally {
        setTimeout(() => setProgress(0, false), 650);
      }
    }

    function togglePlay() {
      if (!state.video_url) return;
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }

    function toggleLoop() {
      const active = !loopBtn.classList.contains("active");
      loopBtn.classList.toggle("active", active);
      if (active && state.video_url) {
        if (currentFrame() < state.in_frame || currentFrame() > state.out_frame) {
          seekFrame(state.in_frame);
        }
        video.play();
      }
    }

    function updatePlayButton() {
      const playing = !video.paused;
      playBtn.innerHTML = playing ? icons.stop : icons.play;
      playBtn.title = playing ? "Stop - Space" : "Play - Space";
    }

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        await uploadVideo(file);
      } catch (err) {
        alert(err.message || String(err));
      } finally {
        fileInput.value = "";
      }
    });

    video.addEventListener("loadedmetadata", setMetadataFromVideo);
    video.addEventListener("timeupdate", () => {
      if (!video.paused && currentFrame() > state.out_frame) {
        if (loopBtn.classList.contains("active")) {
          seekFrame(state.in_frame);
          video.play();
        } else {
          video.pause();
          seekFrame(state.out_frame);
        }
      }
      render();
    });
    video.addEventListener("play", updatePlayButton);
    video.addEventListener("pause", updatePlayButton);

    let timelineResize = null;
    function stopSplitterEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function splitterMetrics() {
      const controlsRect = controls.getBoundingClientRect();
      const styles = getComputedStyle(root);
      const gap = parseFloat(styles.rowGap || styles.gap || "0") || 0;
      const bottomAnchor = controlsRect.top - 2 * gap;
      const maxForCurrentNode = Math.max(
        MIN_TIMELINE_HEIGHT,
        (node._precutWidgetHeight || minimumWidgetHeight()) - fixedWidgetHeight(0) - MIN_VIDEO_HEIGHT
      );
      return {
        bottomAnchor,
        maxTimeline: Math.min(MAX_TIMELINE_HEIGHT, maxForCurrentNode),
      };
    }

    function timelineHeightForSplitterCenter(clientY, metrics = splitterMetrics()) {
      const requested = metrics.bottomAnchor - clientY - SPLITTER_HEIGHT / 2;
      return Math.max(
        MIN_TIMELINE_HEIGHT,
        Math.min(metrics.maxTimeline, requested)
      );
    }
    for (const eventName of ["mousedown", "click", "dblclick", "touchstart", "touchmove"]) {
      splitter.addEventListener(eventName, stopSplitterEvent, true);
    }
    splitter.addEventListener("pointerdown", (event) => {
      const metrics = splitterMetrics();
      timelineResize = {
        pointerId: event.pointerId,
        metrics,
      };
      node._precutTimelineHeight = timelineHeightForSplitterCenter(event.clientY, metrics);
      splitter.classList.add("resizing");
      try {
        splitter.setPointerCapture?.(event.pointerId);
      } catch {}
      syncWidgetSize();
      render();
      stopSplitterEvent(event);
    }, true);
    splitter.addEventListener("pointermove", (event) => {
      if (!timelineResize || timelineResize.pointerId !== event.pointerId) return;
      node._precutTimelineHeight = timelineHeightForSplitterCenter(event.clientY, timelineResize.metrics);
      syncWidgetSize();
      render();
      stopSplitterEvent(event);
    }, true);
    splitter.addEventListener("pointerup", (event) => {
      if (timelineResize?.pointerId === event.pointerId) {
        timelineResize = null;
        splitter.classList.remove("resizing");
        try {
          splitter.releasePointerCapture?.(event.pointerId);
        } catch {}
        syncWidgetSize();
        stopSplitterEvent(event);
      }
    });
    splitter.addEventListener("pointercancel", (event) => {
      timelineResize = null;
      splitter.classList.remove("resizing");
      stopSplitterEvent(event);
    });

    firstBtn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      seekFrame(0);
    });
    lastBtn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      seekFrame(state.frame_count - 1);
    });
    markInBtn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markInAtStart();
    });
    markOutBtn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markOutAtEnd();
    });

    timeline.addEventListener("mousemove", (event) => {
      hoverFrame = frameFromEvent(event);
      if (dragging === "in") {
        state.in_frame = hoverFrame;
        if (state.out_frame < hoverFrame) state.out_frame = hoverFrame;
        persist();
      } else if (dragging === "out") {
        state.out_frame = hoverFrame;
        if (state.in_frame > hoverFrame) state.in_frame = hoverFrame;
        persist();
      } else if (dragging === "playhead") {
        seekFrame(hoverFrame);
      } else if (dragging === "range") {
        const length = state.out_frame - state.in_frame;
        const maxStart = Math.max(0, state.frame_count - 1 - length);
        const start = Math.max(0, Math.min(maxStart, hoverFrame - rangeDragOffset));
        state.in_frame = start;
        state.out_frame = start + length;
        timeline.style.cursor = "grabbing";
        persist();
      } else {
        if (nearestPlayhead(hoverFrame)) {
          timeline.style.cursor = "pointer";
        } else if (nearestHandle(hoverFrame)) {
          timeline.style.cursor = "ew-resize";
        } else if (overSelectedRange(event, hoverFrame)) {
          timeline.style.cursor = "grab";
        } else {
          timeline.style.cursor = "pointer";
        }
      }
    });

    timeline.addEventListener("mousedown", (event) => {
      if (event.target.closest(".precut-navigator")) return;
      hoverFrame = frameFromEvent(event);
      if (nearestPlayhead(hoverFrame)) {
        dragging = "playhead";
        seekFrame(hoverFrame);
      } else {
        dragging = nearestHandle(hoverFrame);
        if (!dragging && overSelectedRange(event, hoverFrame)) {
          dragging = "range";
          rangeDragOffset = hoverFrame - state.in_frame;
          timeline.style.cursor = "grabbing";
        }
        if (!dragging) {
          dragging = "playhead";
          seekFrame(hoverFrame);
        }
      }
      event.preventDefault();
    });
    window.addEventListener("mouseup", () => {
      dragging = null;
      rangeDragOffset = 0;
      navDragging = null;
      navigator.style.cursor = "grab";
    });

    function navFrameFromEvent(event) {
      const rect = navigator.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
      return pct * Math.max(1, state.frame_count - 1);
    }

    navigator.addEventListener("mousedown", (event) => {
      const [start, end] = visibleRange();
      const total = Math.max(1, state.frame_count - 1);
      const frame = navFrameFromEvent(event);
      const visible = end - start;
      if (event.target === navLeft) {
        navDragging = { mode: "left", start, end };
      } else if (event.target === navRight) {
        navDragging = { mode: "right", start, end };
      } else if (frame >= start && frame <= end) {
        navDragging = { mode: "window", start, end, offset: frame - start };
        navigator.style.cursor = "grabbing";
      } else {
        const nextStart = Math.max(0, Math.min(total - visible, frame - visible / 2));
        setVisibleRange(nextStart, nextStart + visible);
        render();
        navDragging = { mode: "window", start: nextStart, end: nextStart + visible, offset: visible / 2 };
        navigator.style.cursor = "grabbing";
      }
      event.preventDefault();
      event.stopPropagation();
    });

    window.addEventListener("mousemove", (event) => {
      if (!navDragging) return;
      const total = Math.max(1, state.frame_count - 1);
      const frame = navFrameFromEvent(event);
      const visible = navDragging.end - navDragging.start;
      if (navDragging.mode === "left") {
        setVisibleRange(Math.min(frame, navDragging.end - 1), navDragging.end);
      } else if (navDragging.mode === "right") {
        setVisibleRange(navDragging.start, Math.max(frame, navDragging.start + 1));
      } else {
        const start = Math.max(0, Math.min(total - visible, frame - navDragging.offset));
        setVisibleRange(start, start + visible);
      }
      render();
    });

    timeline.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const playheadFrame = currentFrame();
        const direction = event.deltaY < 0 ? 1.18 : 1 / 1.18;
        zoom = Math.max(1, Math.min(32, zoom * direction));
        zoomCenter = playheadFrame / Math.max(1, state.frame_count - 1);
        zoomCenter = Math.max(0, Math.min(1, zoomCenter));
        render();
      },
      { passive: false }
    );

    window.addEventListener("keydown", (event) => {
      if (!document.body.contains(root)) return;
      if (!pointerInside && !timeline.matches(":hover")) return;
      const target = event.target;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const key = event.key.toLowerCase();
      const handled = ["i", "o", "arrowdown", "arrowup", "arrowleft", "arrowright"].includes(key) || event.code === "Space";
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }

      if (key === "i") {
        markIn();
      } else if (key === "o") {
        markOut();
      } else if (event.key === "ArrowDown") {
        seekFrame(state.out_frame);
      } else if (event.key === "ArrowUp") {
        seekFrame(state.in_frame);
      } else if (event.key === "ArrowLeft") {
        seekFrame(currentFrame() - 1);
      } else if (event.key === "ArrowRight") {
        seekFrame(currentFrame() + 1);
      } else if (event.code === "Space") {
        togglePlay();
      }
    }, true);

    hydrateVideo();
    syncWidgetSize();
    render();
    new ResizeObserver(() => {
      syncWidgetSize();
      render();
    }).observe(root);
    node.setDirtyCanvas(true, true);
  },
});
