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

const MIN_NODE_WIDTH = 640;
const DEFAULT_NODE_WIDTH = MIN_NODE_WIDTH;
const DEFAULT_NODE_HEIGHT = 700;
const VIDEO_TO_WIDGET_MARGIN = 210;
const MIN_VIDEO_HEIGHT = 0;
const MAX_VIDEO_HEIGHT = 340;
const MIN_TIMELINE_HEIGHT = 96;
const MAX_TIMELINE_HEIGHT = 900;
const DEFAULT_TIMELINE_HEIGHT = 132;
const MAX_ZOOM = 128;
const MIN_NAV_WINDOW_WIDTH = 42;
const NAV_HANDLE_SIZE = 14;
const SHUTTLE_SPEEDS = [1, 2, 4, 8, 16];
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
  fullscreen: `<svg viewBox="0 0 24 24"><path d="M5 5h6v2H7v4H5V5Zm12 2h-4V5h6v6h-2V7ZM7 13v4h4v2H5v-6h2Zm12 0v6h-6v-2h4v-4h2Z"/></svg>`,
  fullscreenExit: `<svg viewBox="0 0 24 24"><path d="M5 11h14v2H5v-2Z"/></svg>`,
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
      --playhead-color: #f2f4f7;
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
      position: relative;
    }
    .precut-ui.loaded {
      box-shadow: inset 0 0 0 1px rgba(123,217,140,.22);
    }
    .precut-ui.fullscreen {
      position: fixed;
      inset: 0;
      z-index: 100000;
      width: 100vw;
      height: 100vh !important;
      min-width: 0;
      border-radius: 0;
      padding: 12px;
      gap: 10px;
      box-shadow: none;
      --precut-video-height: calc(100vh - var(--precut-timeline-height, 220px) - ${CONTROLS_HEIGHT}px - 112px);
      --precut-timeline-height: clamp(150px, 25vh, 300px);
      --precut-widget-height: 100vh;
    }
    .precut-fullscreen-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #0b0c0d;
    }
    .precut-ui:focus,
    .precut-ui:focus-visible {
      outline: none;
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
      user-select: none;
      -webkit-user-select: none;
    }
    .precut-video video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: #090a0b;
      user-select: none;
      -webkit-user-select: none;
      -webkit-user-drag: none;
    }
    .precut-video video::-internal-media-controls-cast-button,
    .precut-video video::-webkit-media-controls-cast-button,
    .precut-video video::-webkit-media-controls-overlay-play-button {
      display: none;
    }
    .precut-preview-speed {
      position: absolute;
      right: 18px;
      bottom: 16px;
      z-index: 8;
      color: rgba(255,255,255,.92);
      font-size: 28px;
      font-weight: 650;
      line-height: 1;
      letter-spacing: 0;
      text-shadow:
        0 1px 2px rgba(0,0,0,.9),
        0 0 4px rgba(0,0,0,.75);
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .precut-preview-speed.visible { opacity: 1; }
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
      user-select: none;
      -webkit-user-select: none;
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
    .precut-timeline::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 28px;
      height: 1px;
      background: rgba(255,255,255,.08);
      box-shadow: 0 1px 0 rgba(0,0,0,.35);
      pointer-events: none;
      z-index: 4;
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
      background: rgba(255,255,255,.018);
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
      left: var(--out-label);
      right: auto;
      top: var(--out-label-top);
    }
    .precut-offscreen-indicator {
      position: absolute;
      top: 50%;
      width: 26px;
      height: 26px;
      display: none;
      align-items: center;
      justify-content: center;
      color: var(--yellow);
      pointer-events: none;
      transform: translateY(-50%);
      z-index: 5;
    }
    .precut-offscreen-indicator.visible {
      display: flex;
    }
    .precut-offscreen-indicator.left {
      left: 8px;
    }
    .precut-offscreen-indicator.right {
      right: 8px;
    }
    .precut-offscreen-indicator svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
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
      border-top: 9px solid var(--playhead-color);
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
      background: linear-gradient(180deg, #ffffff, var(--playhead-color));
      box-shadow: 0 0 8px rgba(242,244,247,.5);
      transform: translateX(-50%);
    }
    .precut-navigator {
      position: absolute;
      left: 18px;
      right: 18px;
      bottom: 0;
      height: 18px;
      box-sizing: border-box;
      overflow: hidden;
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
      min-width: 0;
      top: 0;
      height: 100%;
      box-sizing: border-box;
      border-radius: 999px;
      background: linear-gradient(180deg, #898989, #686868);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), 0 1px 2px rgba(0,0,0,.5);
      z-index: 1;
    }
    .precut-nav-handle {
      position: absolute;
      top: 2px;
      width: ${NAV_HANDLE_SIZE}px;
      height: ${NAV_HANDLE_SIZE}px;
      border: 2px solid #c4cbd4;
      border-radius: 999px;
      background: #202224;
      box-shadow: 0 0 0 1px rgba(0,0,0,.55), 0 1px 4px rgba(0,0,0,.55);
      box-sizing: border-box;
      cursor: ew-resize;
      z-index: 2;
    }
    .precut-nav-handle.left {
      left: 0;
    }
    .precut-nav-handle.right {
      left: 0;
      transform: translateX(-100%);
    }
    .precut-controls {
      display: flex;
      flex: 0 0 ${CONTROLS_HEIGHT}px;
      align-items: center;
      justify-content: center;
      gap: 18px;
      height: ${CONTROLS_HEIGHT}px;
      min-height: ${CONTROLS_HEIGHT}px;
      padding: 5px 7px;
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
      user-select: none;
      -webkit-user-select: none;
    }
    .precut-btn:hover {
      border-color: #5b6269;
      filter: brightness(1.04);
    }
    .precut-btn:focus,
    .precut-btn:focus-visible {
      outline: none;
      box-shadow: none;
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
      flex: 0 0 34px;
      height: 34px;
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
    .precut-video-actions .precut-help {
      min-width: 34px;
      width: 34px;
      flex: 0 0 34px;
      padding: 0;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 850;
    }
    .precut-video-actions .precut-fullscreen {
      min-width: 34px;
      width: 34px;
      flex: 0 0 34px;
      padding: 0;
      border-radius: 999px;
    }
    .precut-shortcuts-panel {
      position: absolute;
      left: 174px;
      top: 48px;
      width: 300px;
      padding: 10px 12px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 7px;
      background: rgba(18,20,22,.96);
      box-shadow: 0 10px 24px rgba(0,0,0,.45);
      color: var(--text);
      font-size: 12px;
      z-index: 20;
      display: none;
      pointer-events: auto;
    }
    .precut-shortcuts-panel.open { display: block; }
    .precut-shortcuts-panel h4 {
      margin: 0 0 8px;
      font-size: 12px;
      color: #f2f4f7;
    }
    .precut-shortcuts-panel div {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 3px 0;
      color: var(--muted);
    }
    .precut-shortcuts-panel kbd {
      color: var(--yellow);
      font: inherit;
      font-weight: 800;
      white-space: nowrap;
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
      width: 154px;
      flex: 0 0 154px;
      height: var(--precut-btn-size);
      display: grid;
      grid-template-columns: 34px 92px;
      grid-template-rows: 1fr 1fr;
      column-gap: 8px;
      row-gap: 0;
      align-items: center;
      padding: 3px 8px;
      border: 1px solid #4b4f55;
      border-radius: 7px;
      color: var(--blue);
      background: #16181a;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      line-height: 1;
      text-align: center;
      overflow: hidden;
      box-sizing: border-box;
      position: relative;
      user-select: none;
    }
    .precut-readout-label {
      min-width: 0;
      color: #aeb5bf;
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
      text-align: left;
    }
    .precut-readout-label::after {
      content: ":";
      float: right;
      color: #7f8791;
      font-weight: 500;
    }
    .precut-readout-line {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      background: rgba(255,255,255,.08);
      pointer-events: none;
    }
    .precut-readout input,
    .precut-range-readout {
      width: 96px;
      justify-self: end;
      min-width: 0;
      color: #b7bec8;
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      text-align: right;
    }
    .precut-readout input {
      border: 0;
      outline: 0;
      padding: 0;
      background: transparent;
      user-select: text;
    }
    .precut-readout .precut-range-readout {
      color: var(--yellow);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
      pointer-events: auto;
    }
    .precut-file { display: none; }
  `;
  document.head.appendChild(style);
}

function fmtTime(seconds, fps = 24) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const nominalFps = Math.max(1, Math.round(Number.isFinite(fps) && fps > 0 ? fps : 24));
  const totalFrames = Math.max(0, Math.round(seconds * (Number.isFinite(fps) && fps > 0 ? fps : nominalFps)));
  const totalSeconds = Math.floor(totalFrames / nominalFps);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const frames = totalFrames % nominalFps;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

function parseTimecode(value, fps = 24) {
  const nominalFps = Math.max(1, Math.round(Number.isFinite(fps) && fps > 0 ? fps : 24));
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parts = raw.split(/[:;\s]+/).filter(Boolean).map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0];
  const [frames = 0, seconds = 0, minutes = 0, hours = 0] = parts.reverse();
  return (((hours * 60 + minutes) * 60 + seconds) * nominalFps) + frames;
}

function formatTimecodeDigits(digits) {
  const padded = String(digits || "").replace(/\D/g, "").slice(0, 8).padStart(8, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}:${padded.slice(6, 8)}`;
}

function normalizeTimecodeInput(value) {
  return formatTimecodeDigits(String(value || "").replace(/\D/g, ""));
}

const TIMECODE_PAIR_STARTS = [0, 3, 6, 9];

function timecodePairFromSelection(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0 && end >= 11) return -1;
  const selectionStart = Math.min(start, end);
  const selectionEnd = Math.max(start, end);
  for (let index = 0; index < TIMECODE_PAIR_STARTS.length; index++) {
    const pairStart = TIMECODE_PAIR_STARTS[index];
    const pairEnd = pairStart + 2;
    if (selectionStart >= pairStart && selectionEnd <= pairEnd && selectionEnd > selectionStart) {
      return index;
    }
  }
  return -1;
}

function timecodePairFromCaret(position) {
  if (!Number.isFinite(position)) return 0;
  if (position <= 2) return 0;
  if (position <= 5) return 1;
  if (position <= 8) return 2;
  return 3;
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

function makeButton(className, title, icon, onClick) {
  const btn = document.createElement("button");
  btn.className = `precut-btn ${className || ""}`.trim();
  btn.type = "button";
  btn.title = title;
  btn.innerHTML = icon;
  btn.addEventListener("click", (event) => {
    onClick(event);
    btn.blur();
  });
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
    let timelinePan = null;
    let navDragging = null;
    let previousZoomState = null;
    let waveformPeaks = [];
    let waveformVersion = 0;
    let lastWaveformKey = "";
    let pendingWaveformKey = "";
    let pendingWaveformFrame = 0;
    let waveformDirty = true;
    let lastTimecodesKey = "";
    let pendingRenderFrame = 0;
    let pendingLayoutFrame = 0;
    let pendingLayoutMarkCanvas = false;
    let pointerInside = false;
    let activePrecutDrag = false;
    let fullscreenActive = false;
    let fullscreenParent = null;
    let fullscreenNextSibling = null;
    let fullscreenBackdrop = null;
    let fullscreenBodyOverflow = "";
    let normalRootHeight = "";
    let playheadEditDigits = "";
    let playheadPairEditIndex = -1;
    let playheadPairEditDigits = "";
    let scrubAudioTimer = 0;
    let scrubAudioToken = 0;
    let reverseAudioContext = null;
    let reverseAudioBuffer = null;
    let reverseAudioKey = "";
    let reverseAudioSource = null;
    let reverseAudioToken = 0;
    let reverseAudioLoading = null;
    let shuttleDirection = 0;
    let shuttleStep = 0;
    let reverseFrame = 0;
    let lastArrowJumpKey = "";
    let lastArrowJumpTime = 0;

    function resetPrecutCanvasDrag(event = null, force = false) {
      if (!activePrecutDrag && !force) return;
      const canvas = app.canvas || app.graph?.list_of_graphcanvas?.[0];
      if (!canvas) return;
      const noButtons =
        !event ||
        (event.buttons ?? 0) === 0 ||
        event.type === "mouseup" ||
        event.type === "pointerup" ||
        event.type === "pointercancel" ||
        event.type === "blur";
      if (!force && !noButtons) return;

      if (canvas.node_dragged === node) canvas.node_dragged = null;
      if (canvas.dragging_node === node) canvas.dragging_node = null;
      if (canvas.drag_node === node) canvas.drag_node = null;
      if (noButtons) {
        canvas.pointer_is_down = false;
        canvas.dragging_canvas = false;
        canvas.dragging_rectangle = null;
      }
    }

    const root = document.createElement("div");
    root.className = "precut-ui";
    root.tabIndex = 0;
    root.addEventListener("pointerenter", () => {
      pointerInside = true;
    });
    root.addEventListener("pointerleave", () => {
      pointerInside = false;
    });
    for (const eventName of ["mousedown", "dblclick", "touchstart"]) {
      root.addEventListener(eventName, (event) => {
        if (event.target.closest?.(".litecontextmenu, .comfy-menu, .comfy-modal, .p-contextmenu")) return;
        event.stopPropagation();
      });
    }

    const videoWrap = document.createElement("div");
    videoWrap.className = "precut-video";
    const video = document.createElement("video");
    video.controls = false;
    video.muted = false;
    video.playsInline = true;
    video.disableRemotePlayback = true;
    video.setAttribute("disableRemotePlayback", "");
    video.setAttribute("controlsList", "nodownload noremoteplayback");
    video.setAttribute("x-webkit-airplay", "deny");
    const scrubAudio = document.createElement("audio");
    scrubAudio.preload = "auto";
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
    const speedReadout = document.createElement("div");
    speedReadout.className = "precut-preview-speed";
    const loadedCue = document.createElement("div");
    loadedCue.className = "precut-loaded-cue";
    loadedCue.textContent = "Loaded";
    const videoActions = document.createElement("div");
    videoActions.className = "precut-video-actions";
    videoWrap.append(video, placeholder, videoActions, progress, speedReadout, loadedCue);

    const timeline = document.createElement("div");
    timeline.className = "precut-timeline";
    timeline.innerHTML = `
      <div class="precut-timecodes"></div>
      <div class="precut-selection"></div>
      <canvas class="precut-wave"></canvas>
      <div class="precut-offscreen-indicator left" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M13 6 7 12l6 6"/><path d="M18 6l-6 6 6 6"/></svg>
      </div>
      <div class="precut-offscreen-indicator right" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m11 6 6 6-6 6"/><path d="m6 6 6 6-6 6"/></svg>
      </div>
      <div class="precut-handle in">IN</div>
      <div class="precut-handle out">OUT</div>
      <div class="precut-playhead"></div>
      <div class="precut-navigator">
        <div class="precut-nav-window"></div>
        <div class="precut-nav-handle left"></div>
        <div class="precut-nav-handle right"></div>
      </div>
    `;
    const timecodes = timeline.querySelector(".precut-timecodes");
    const selection = timeline.querySelector(".precut-selection");
    const waveCanvas = timeline.querySelector(".precut-wave");
    const inOffscreenIndicator = timeline.querySelector(".precut-offscreen-indicator.left");
    const outOffscreenIndicator = timeline.querySelector(".precut-offscreen-indicator.right");
    const inHandle = timeline.querySelector(".precut-handle.in");
    const outHandle = timeline.querySelector(".precut-handle.out");
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

    const firstBtn = makeButton("first", "Go to IN - Up arrow. Double-click: go to timeline start.", icons.first, () => seekFrame(state.in_frame, { centerIfOutside: true }));
    const prevBtn = makeButton("prev", "Previous frame - Left arrow", icons.prev, () => seekFrame(currentFrame() - 1, { scrubAudio: true }));
    const playBtn = makeButton("play", "Play / stop - Space", icons.play, () => togglePlay());
    const nextBtn = makeButton("next", "Next frame - Right arrow", icons.next, () => seekFrame(currentFrame() + 1, { scrubAudio: true }));
    const lastBtn = makeButton("last", "Go to OUT - Down arrow. Double-click: go to timeline end.", icons.last, () => seekFrame(state.out_frame, { centerIfOutside: true }));
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
    const helpBtn = makeButton("precut-help", "Shortcuts", "?", () => {
      shortcutsPanel.classList.toggle("open");
    });
    const fullscreenBtn = makeButton("precut-fullscreen", "Fullscreen - F", icons.fullscreen, () => toggleFullscreen());
    const markInBtn = makeButton("mark mark-in", "Mark IN at playhead - I. Double-click: mark IN at first frame.", "IN", () => markIn());
    const markOutBtn = makeButton("mark mark-out", "Mark OUT at playhead - O. Double-click: mark OUT at last frame.", "OUT", () => markOut());
    const readout = document.createElement("div");
    readout.className = "precut-readout";
    const playheadInput = document.createElement("input");
    playheadInput.className = "precut-playhead-timecode";
    playheadInput.type = "text";
    playheadInput.spellcheck = false;
    playheadInput.inputMode = "numeric";
    playheadInput.maxLength = 11;
    playheadInput.title = "Current playhead timecode. Type a timecode and press Enter to jump.";
    const tcLabel = document.createElement("div");
    tcLabel.className = "precut-readout-label";
    tcLabel.textContent = "TC";
    const ioLabel = document.createElement("div");
    ioLabel.className = "precut-readout-label";
    ioLabel.textContent = "I/O";
    const divider = document.createElement("div");
    divider.className = "precut-readout-line";
    const rangeReadout = document.createElement("div");
    rangeReadout.className = "precut-range-readout";
    rangeReadout.title = "Selected IN to OUT duration.";
    readout.append(tcLabel, playheadInput, divider, ioLabel, rangeReadout);
    const loopBtn = makeButton("loop", "Loop IN to OUT - Shift", icons.loop, () => toggleLoop());
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
    const shortcutsPanel = document.createElement("div");
    shortcutsPanel.className = "precut-shortcuts-panel";
    shortcutsPanel.innerHTML = `
      <h4>Shortcuts</h4>
      <div><kbd>Space</kbd><span>Play / stop</span></div>
      <div><kbd>J</kbd><span>Reverse 1x / 2x / 4x / 8x / 16x</span></div>
      <div><kbd>K</kbd><span>Stop shuttle / play</span></div>
      <div><kbd>L</kbd><span>Forward 1x / 2x / 4x / 8x / 16x</span></div>
      <div><kbd>Shift</kbd><span>Loop IN / OUT</span></div>
      <div><kbd>F</kbd><span>Fullscreen</span></div>
      <div><kbd>+</kbd><span>Zoom in at playhead</span></div>
      <div><kbd>-</kbd><span>Zoom out at playhead</span></div>
      <div><kbd>I / O</kbd><span>Mark IN / OUT</span></div>
      <div><kbd>Left / Right</kbd><span>Previous / next frame</span></div>
      <div><kbd>Up / Down</kbd><span>Go to IN / OUT</span></div>
      <div><kbd>Double Up / Down</kbd><span>Timeline start / end</span></div>
    `;

    videoActions.append(loadInputsBtn, loadFileBtn, helpBtn, fullscreenBtn, logo, fileInput);
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
    root.append(videoActions, videoWrap, splitter, timeline, controls, shortcutsPanel);

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

    function timelineHeight() {
      return Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, node._precutTimelineHeight || DEFAULT_TIMELINE_HEIGHT));
    }

    function fixedWidgetHeight(timelineValue = timelineHeight()) {
      return 34 + timelineValue + CONTROLS_HEIGHT + SPLITTER_HEIGHT + 48;
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
    let pendingSizeSync = false;
    function setNodeSize(width, height) {
      if (typeof node.setSize === "function") {
        node.setSize([width, height]);
      } else {
        node.size = [width, height];
      }
    }

    function syncWidgetSize(markCanvas = true) {
      if (syncingSize) {
        pendingSizeSync = true;
        return;
      }
      if (fullscreenActive) {
        const maxTimelineForFullscreen = Math.max(150, window.innerHeight - 260);
        const timelineValue = Math.max(
          MIN_TIMELINE_HEIGHT,
          Math.min(MAX_TIMELINE_HEIGHT, maxTimelineForFullscreen, node._precutTimelineHeight || Math.round(window.innerHeight * 0.25))
        );
        node._precutTimelineHeight = timelineValue;
        root.style.setProperty("--precut-timeline-height", `${timelineValue}px`);
        root.style.setProperty("--precut-video-height", `calc(100vh - ${timelineValue}px - ${CONTROLS_HEIGHT}px - 112px)`);
        root.style.setProperty("--precut-widget-height", "100vh");
        root.style.width = "100vw";
        root.style.height = "100vh";
        markWaveformDirty();
        if (markCanvas) node.setDirtyCanvas(true, true);
        return;
      }
      syncingSize = true;
      try {
        const width = Math.max(MIN_NODE_WIDTH, node.size?.[0] || MIN_NODE_WIDTH);
        const minHeight = minimumWidgetHeight();
        const chromeHeight = nodeChromeHeight();
        const availableHeight = Math.max(0, (node.size?.[1] || 0) - chromeHeight);
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
        waveformDirty = true;
        splitter.classList.remove("collapsed");
        splitter.title = "Drag to resize the timeline";
        widget.options.getMinHeight = () => minHeight;
        widget.options.getMaxHeight = () => Math.max(node._precutWidgetHeight || height, minHeight);
        widget.options.getHeight = () => node._precutWidgetHeight || height;
        widget.computeSize = () => [width, node._precutWidgetHeight || height];
        const minNodeHeight = Math.ceil(chromeHeight + minHeight);
        if (node.size[0] !== width || node.size[1] < minNodeHeight) {
          setNodeSize(width, Math.max(node.size?.[1] || 0, minNodeHeight));
        }
        if (markCanvas) node.setDirtyCanvas(true, true);
      } finally {
        syncingSize = false;
      }
      if (pendingSizeSync) {
        pendingSizeSync = false;
        requestAnimationFrame(() => {
          syncWidgetSize();
          render();
        });
      }
    }
    node._precutSyncLayout = syncWidgetSize;

    function toggleFullscreen(force = null) {
      fullscreenActive = force === null ? !fullscreenActive : Boolean(force);
      if (fullscreenActive) {
        fullscreenParent = root.parentNode;
        fullscreenNextSibling = root.nextSibling;
        fullscreenBodyOverflow = document.body.style.overflow;
        normalRootHeight = root.style.height;
        fullscreenBackdrop = document.createElement("div");
        fullscreenBackdrop.className = "precut-fullscreen-backdrop";
        document.body.append(fullscreenBackdrop, root);
      } else if (fullscreenParent) {
        fullscreenBackdrop?.remove();
        fullscreenBackdrop = null;
        fullscreenParent.insertBefore(root, fullscreenNextSibling);
        fullscreenParent = null;
        fullscreenNextSibling = null;
        root.style.width = "";
        root.style.height = normalRootHeight;
      }
      root.classList.toggle("fullscreen", fullscreenActive);
      fullscreenBtn.innerHTML = fullscreenActive ? icons.fullscreenExit : icons.fullscreen;
      fullscreenBtn.title = fullscreenActive ? "Exit fullscreen - F" : "Fullscreen - F";
      document.body.style.overflow = fullscreenActive ? "hidden" : fullscreenBodyOverflow;
      shortcutsPanel.classList.remove("open");
      syncWidgetSize(false);
      render();
      if (fullscreenActive) {
        root.requestFullscreen?.().catch?.(() => {});
      } else if (document.fullscreenElement === root) {
        document.exitFullscreen?.().catch?.(() => {});
      }
    }

    const originalOnResize = node.onResize;
    node.onResize = function () {
      originalOnResize?.apply(this, arguments);
      syncWidgetSize();
      scheduleRender();
    };

    function persist() {
      writeState(stateWidget, state, node);
      scheduleRender();
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

    function stopShuttle() {
      shuttleDirection = 0;
      shuttleStep = 0;
      reverseFrame += 1;
      stopReverseAudio();
      video.playbackRate = 1;
      video.pause();
      updatePlayButton();
    }

    function centerTimelineOnFrame(frame) {
      const [start, end] = visibleRange();
      const visible = end - start;
      setVisibleRange(frame - visible / 2, frame + visible / 2);
      markWaveformDirty();
    }

    function frameIsVisible(frame) {
      const [start, end] = visibleRange();
      return frame >= start && frame <= end;
    }

    function seekFrame(frame, options = {}) {
      frame = Math.max(0, Math.min(state.frame_count - 1, Math.round(frame)));
      const shouldCenter = options.center || (options.centerIfOutside && !frameIsVisible(frame));
      video.currentTime = frameToSeconds(frame);
      if (shouldCenter) centerTimelineOnFrame(frame);
      else ensurePlayheadVisible();
      render();
      if (options.scrubAudio) playFrameAudio(frame);
    }

    function stopReverseAudio() {
      reverseAudioToken += 1;
      if (!reverseAudioSource) return;
      try {
        reverseAudioSource.stop();
      } catch {}
      reverseAudioSource.disconnect();
      reverseAudioSource = null;
    }

    async function reverseAudioData() {
      const source = video.currentSrc || video.src;
      if (!source || state.media_type === "inputs") return null;
      if (reverseAudioBuffer && reverseAudioKey === source) return reverseAudioBuffer;
      if (reverseAudioLoading && reverseAudioKey === source) return reverseAudioLoading;

      reverseAudioKey = source;
      reverseAudioBuffer = null;
      reverseAudioLoading = (async () => {
        reverseAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(source);
        const data = await response.arrayBuffer();
        const decoded = await reverseAudioContext.decodeAudioData(data.slice(0));
        const reversed = reverseAudioContext.createBuffer(
          decoded.numberOfChannels,
          decoded.length,
          decoded.sampleRate
        );
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          const input = decoded.getChannelData(channel);
          const output = reversed.getChannelData(channel);
          for (let left = 0, right = input.length - 1; right >= 0; left++, right--) {
            output[left] = input[right];
          }
        }
        reverseAudioBuffer = reversed;
        reverseAudioLoading = null;
        return reversed;
      })().catch(() => {
        reverseAudioLoading = null;
        return null;
      });
      return reverseAudioLoading;
    }

    function playReverseAudio(speed, token) {
      stopReverseAudio();
      reverseAudioToken = token;
      const data = reverseAudioData();
      reverseAudioContext?.resume?.();
      data.then((buffer) => {
        if (!buffer || reverseAudioToken !== token || shuttleDirection !== -1) return;
        reverseAudioContext.resume?.();
        const source = reverseAudioContext.createBufferSource();
        const startAt = Math.max(0, Math.min(buffer.duration, buffer.duration - video.currentTime));
        source.buffer = buffer;
        source.playbackRate.value = speed;
        source.connect(reverseAudioContext.destination);
        source.onended = () => {
          if (reverseAudioSource === source) reverseAudioSource = null;
        };
        reverseAudioSource = source;
        try {
          source.start(0, startAt);
        } catch {
          source.disconnect();
          if (reverseAudioSource === source) reverseAudioSource = null;
        }
      });
    }

    function playFrameAudio(frame) {
      if (!state.video_url || !Number.isFinite(video.duration) || state.media_type === "inputs") return;
      const token = scrubAudioToken + 1;
      scrubAudioToken = token;
      clearTimeout(scrubAudioTimer);
      const wasPaused = video.paused;
      const rate = video.playbackRate;
      if (wasPaused) {
        const source = video.currentSrc || video.src;
        if (!source) return;
        const scrubTime = frameToSeconds(frame);
        scrubAudio.pause();
        if (scrubAudio.src !== source) scrubAudio.src = source;
        const stopPausedScrub = () => {
          if (scrubAudioToken !== token) return;
          scrubAudio.pause();
          scrubAudio.currentTime = scrubTime;
          video.pause();
          video.currentTime = scrubTime;
          render();
        };
        const startPausedScrub = () => {
          if (scrubAudioToken !== token) return;
          scrubAudio.currentTime = scrubTime;
          scrubAudio.playbackRate = 1;
          scrubAudio.play().then(() => {
            scrubAudioTimer = setTimeout(stopPausedScrub, Math.max(28, (1.5 / state.fps) * 1000));
          }).catch(() => {
            video.pause();
            video.currentTime = scrubTime;
          });
        };
        if (scrubAudio.readyState < 1) {
          scrubAudio.addEventListener("loadedmetadata", startPausedScrub, { once: true });
          scrubAudio.load();
        } else {
          startPausedScrub();
        }
        return;
      }
      video.playbackRate = 1;
      video.currentTime = frameToSeconds(frame);
      const stopAt = Math.min(duration(), frameToSeconds(frame + 1.5));
      const stop = () => {
        if (scrubAudioToken !== token) return;
        video.pause();
        video.playbackRate = rate || 1;
        video.currentTime = frameToSeconds(frame);
        if (!wasPaused) video.play();
        render();
      };
      video.play().then(() => {
        scrubAudioTimer = setTimeout(stop, Math.max(28, ((stopAt - video.currentTime) * 1000) || 42));
      }).catch(() => {
        video.playbackRate = rate || 1;
      });
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
      const minVisible = Math.max(1, Math.round(total / MAX_ZOOM));
      start = Math.max(0, Math.min(total - minVisible, start));
      end = Math.max(start + minVisible, Math.min(total, end));
      if (end > total) {
        start = Math.max(0, total - (end - start));
        end = total;
      }
      const visible = Math.max(1, end - start);
      zoom = Math.max(1, Math.min(MAX_ZOOM, total / visible));
      zoomCenter = Math.max(0, Math.min(1, (start + visible / 2) / total));
    }

    function panVisibleRangeByFrames(delta) {
      const [start, end] = visibleRange();
      const visible = end - start;
      setVisibleRange(start + delta, start + delta + visible);
      markWaveformDirty();
      scheduleRender();
    }

    function zoomTimeline(direction) {
      const playheadFrame = currentFrame();
      const factor = direction > 0 ? 1.18 : 1 / 1.18;
      zoom = Math.max(1, Math.min(MAX_ZOOM, zoom * factor));
      zoomCenter = Math.max(0, Math.min(1, playheadFrame / Math.max(1, state.frame_count - 1)));
      markWaveformDirty();
      scheduleRender();
    }

    function panTimelineAtEdge(event) {
      const rect = timeline.getBoundingClientRect();
      const [start, end] = visibleRange();
      const visible = end - start;
      const framesPerPixel = visible / Math.max(1, rect.width);
      const edgeSize = Math.max(36, Math.min(120, rect.width * 0.12));
      let pixels = 0;
      if (event.clientX < rect.left + edgeSize) {
        pixels = event.clientX - (rect.left + edgeSize);
      } else if (event.clientX > rect.right - edgeSize) {
        pixels = event.clientX - (rect.right - edgeSize);
      }
      if (!pixels) return;
      setVisibleRange(start + pixels * framesPerPixel, end + pixels * framesPerPixel);
      markWaveformDirty();
    }

    function doublePressArrow(key) {
      const now = performance.now();
      const doubled = lastArrowJumpKey === key && now - lastArrowJumpTime <= 360;
      lastArrowJumpKey = key;
      lastArrowJumpTime = now;
      return doubled;
    }

    function ensurePlayheadVisible() {
      const [start, end] = visibleRange();
      const visible = end - start;
      const head = currentFrame();
      if (head > end) {
        setVisibleRange(head, head + visible);
        markWaveformDirty();
      } else if (head < start) {
        setVisibleRange(head - visible, head);
        markWaveformDirty();
      }
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

    function rectContainsPoint(rect, event) {
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function rangeLabelHit(event) {
      return rectContainsPoint(inHandle.getBoundingClientRect(), event) ||
        rectContainsPoint(outHandle.getBoundingClientRect(), event);
    }

    function nearPlayhead(event) {
      const rect = timeline.getBoundingClientRect();
      const playheadX = rect.left + (frameToPct(currentFrame()) / 100) * rect.width;
      return Math.abs(event.clientX - playheadX) <= 9;
    }

    function nearestRangeEdge(event) {
      if (rangeLabelHit(event)) return null;
      const rect = selection.getBoundingClientRect();
      if (!rectContainsPoint(rect, event)) return null;
      const threshold = 10;
      const inDistance = Math.abs(event.clientX - rect.left);
      const outDistance = Math.abs(event.clientX - rect.right);
      if (inDistance <= threshold && inDistance <= outDistance) return "in";
      if (outDistance <= threshold) return "out";
      return null;
    }

    function inTimecodeZone(event) {
      const rect = timeline.getBoundingClientRect();
      return event.clientY - rect.top <= 42;
    }

    function renderTimecodes() {
      const [start, end] = visibleRange();
      const points = [0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => Math.round(start + (end - start) * p));
      const head = currentFrame();
      const activeEdge = head === points[0] ? "start" : head === points[points.length - 1] ? "end" : "";
      const key = `${points.join(":")}:${activeEdge}:${state.fps}`;
      if (key === lastTimecodesKey) return;
      lastTimecodesKey = key;
      timecodes.innerHTML = points
        .map((frame, index) => {
          const text = fmtTime(frameToSeconds(frame), state.fps);
          const isEdge = index === 0 || index === points.length - 1;
          return isEdge && frame === head ? `<strong>${text}</strong>` : `<span>${text}</span>`;
        })
        .join("");
    }

    function navigatorMetrics() {
      const total = Math.max(1, state.frame_count - 1);
      const [start, end] = visibleRange();
      const track = navigatorTrackMetrics();
      const { trackLeft, trackWidth } = track;
      const visible = Math.max(1, end - start);
      const maxStart = Math.max(0, total - visible);
      const rect = navigatorVisualRange(start, end, total, trackWidth);
      const visualLeft = trackLeft + rect.left;
      const visualWidth = rect.width;
      const maxVisualLeft = rect.maxLeft;
      return { total, start, end, ...track, visualLeft, visualWidth, visible, maxStart, maxVisualLeft };
    }

    function navigatorVisualRange(start, end, total, trackWidth) {
      const visible = Math.max(1, end - start);
      const minWidth = Math.min(MIN_NAV_WINDOW_WIDTH, trackWidth);
      const currentZoom = Math.max(1, Math.min(MAX_ZOOM, total / visible));
      const zoomProgress = MAX_ZOOM <= 1 ? 1 : (currentZoom - 1) / (MAX_ZOOM - 1);
      const width = Math.max(minWidth, trackWidth - (trackWidth - minWidth) * zoomProgress);
      const maxStart = Math.max(0, total - visible);
      const maxLeft = Math.max(0, trackWidth - width);
      const left = thumbLeftFromRangeStart(start, maxStart, maxLeft);
      return { left, width, right: left + width, maxLeft };
    }

    function rangeEndFromVisualRight(start, visualRight, total, trackWidth) {
      const target = Math.max(0, Math.min(trackWidth, visualRight));
      let low = Math.min(total, start + 1);
      let high = total;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        const right = navigatorVisualRange(start, mid, total, trackWidth).right;
        if (right < target) low = mid;
        else high = mid;
      }
      return Math.max(start + 1, Math.min(total, high));
    }

    function rangeStartFromThumbLeftEdge(end, visualLeft, total, trackWidth) {
      const target = Math.max(0, Math.min(trackWidth, visualLeft));
      let low = 0;
      let high = Math.max(0, end - 1);
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        const left = navigatorVisualRange(mid, end, total, trackWidth).left;
        if (left < target) low = mid;
        else high = mid;
      }
      return Math.max(0, Math.min(end - 1, high));
    }

    function navigatorTrackMetrics() {
      const rect = navigator.getBoundingClientRect();
      const borderLeft = navigator.clientLeft || 0;
      const width = Math.max(1, navigator.clientWidth || Math.floor(rect.width));
      const trackLeft = 0;
      const trackWidth = width;
      return { rect, borderLeft, width, trackLeft, trackWidth };
    }

    function navigatorLocalX(event, metrics = navigatorTrackMetrics()) {
      return Math.max(0, Math.min(metrics.width, event.clientX - metrics.rect.left - metrics.borderLeft));
    }

    function thumbLeftFromRangeStart(start, maxStart, maxVisualLeft) {
      if (maxStart <= 0 || maxVisualLeft <= 0) return 0;
      return Math.max(0, Math.min(maxVisualLeft, (start / maxStart) * maxVisualLeft));
    }

    function rangeStartFromThumbLeft(visualLeft, maxStart, maxVisualLeft) {
      if (maxStart <= 0 || maxVisualLeft <= 0) return 0;
      return Math.max(0, Math.min(maxStart, (visualLeft / maxVisualLeft) * maxStart));
    }

    function renderNavigator() {
      const { visualLeft, visualWidth } = navigatorMetrics();
      navWindow.style.left = `${visualLeft}px`;
      navWindow.style.width = `${visualWidth}px`;
      navLeft.style.left = `${visualLeft}px`;
      navRight.style.left = `${visualLeft + visualWidth}px`;
    }

    function toggleTimelineZoom() {
      if (zoom > 1.0001) {
        previousZoomState = { zoom, zoomCenter };
        zoom = 1;
        zoomCenter = 0.5;
      } else if (previousZoomState) {
        zoom = Math.max(1, Math.min(MAX_ZOOM, previousZoomState.zoom));
        zoomCenter = Math.max(0, Math.min(1, previousZoomState.zoomCenter));
        previousZoomState = null;
      }
      render();
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

    function markWaveformDirty() {
      waveformDirty = true;
    }

    function waveformDrawKey() {
      const rect = waveCanvas.getBoundingClientRect();
      const [startFrame, endFrame] = visibleRange();
      return [
        Math.round(rect.width),
        Math.round(rect.height),
        Math.round(startFrame),
        Math.round(endFrame),
        waveformPeaks.length,
        waveformVersion,
      ].join(":");
    }

    function scheduleWaveformDraw(force = false) {
      if (!force && !waveformDirty) return;
      if (pendingWaveformFrame) return;
      pendingWaveformFrame = requestAnimationFrame(() => {
        pendingWaveformFrame = 0;
        const key = waveformDrawKey();
        if (!force && key === lastWaveformKey) {
          waveformDirty = false;
          return;
        }
        pendingWaveformKey = key;
        lastWaveformKey = pendingWaveformKey;
        waveformDirty = false;
        drawWaveform();
      });
    }

    function setWaveformPeaks(peaks) {
      waveformPeaks = Array.isArray(peaks) ? peaks : [];
      waveformVersion += 1;
      markWaveformDirty();
    }

    function scheduleRender() {
      if (pendingRenderFrame) return;
      pendingRenderFrame = requestAnimationFrame(() => {
        pendingRenderFrame = 0;
        render();
      });
    }

    function scheduleLayoutRender(markCanvas = true) {
      pendingLayoutMarkCanvas = pendingLayoutMarkCanvas || markCanvas;
      if (pendingLayoutFrame) return;
      pendingLayoutFrame = requestAnimationFrame(() => {
        const markCanvasNow = pendingLayoutMarkCanvas;
        pendingLayoutFrame = 0;
        pendingLayoutMarkCanvas = false;
        syncWidgetSize(markCanvasNow);
        render();
      });
    }

    function render() {
      state.in_frame = Math.max(0, Math.min(state.in_frame, state.frame_count - 1));
      state.out_frame = Math.max(state.in_frame, Math.min(state.out_frame, state.frame_count - 1));
      const [visibleStart, visibleEnd] = visibleRange();
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
      inOffscreenIndicator.classList.toggle("visible", state.in_frame < visibleStart);
      outOffscreenIndicator.classList.toggle("visible", state.out_frame > visibleEnd);
      if (document.activeElement !== playheadInput) {
        playheadInput.value = fmtTime(frameToSeconds(currentFrame()), state.fps);
      }
      const speed = shuttleDirection ? SHUTTLE_SPEEDS[shuttleStep] : (video.paused ? 1 : video.playbackRate || 1);
      speedReadout.textContent = `${speed}x`;
      speedReadout.classList.toggle("visible", speed > 1);
      rangeReadout.textContent = fmtTime((state.out_frame - state.in_frame + 1) / state.fps, state.fps);
      const audioOnly = state.media_type === "audio";
      placeholder.style.display = state.video_url && !audioOnly ? "none" : "flex";
      video.style.opacity = audioOnly ? "0" : "1";
      renderTimecodes();
      renderNavigator();
      scheduleWaveformDraw();
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
      stopReverseAudio();
      reverseAudioBuffer = null;
      reverseAudioKey = "";
      video.src = api.apiURL(state.video_url);
      video.load();
      loadWaveform();
    }

    async function loadWaveform() {
      if (!state.video_path) {
        setWaveformPeaks([]);
        render();
        return;
      }
      try {
      const response = await fetch(api.apiURL(`/precut/waveform?path=${encodeURIComponent(state.video_path)}`));
      const result = await response.json();
      setWaveformPeaks(result.peaks);
      } catch {
        setWaveformPeaks([]);
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
      stopReverseAudio();
      reverseAudioBuffer = null;
      reverseAudioKey = "";
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
        if (!sourceNodes.length) {
          throw new Error("Connect a VIDEO or AUDIO input before using LOAD MEDIA INPUTS.");
        }
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
        setWaveformPeaks([]);
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
      if (shuttleDirection) {
        stopShuttle();
        return;
      }
      shuttleDirection = 0;
      shuttleStep = 0;
      reverseFrame += 1;
      stopReverseAudio();
      video.playbackRate = 1;
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }

    function shuttleForward() {
      if (!state.video_url) return;
      if (shuttleDirection === 1) {
        shuttleStep = Math.min(SHUTTLE_SPEEDS.length - 1, shuttleStep + 1);
      } else {
        shuttleDirection = 1;
        shuttleStep = 0;
      }
      reverseFrame += 1;
      stopReverseAudio();
      video.playbackRate = SHUTTLE_SPEEDS[shuttleStep];
      video.play();
      updatePlayButton();
      render();
    }

    function shuttleReverse() {
      if (!state.video_url) return;
      if (shuttleDirection === -1) {
        shuttleStep = Math.min(SHUTTLE_SPEEDS.length - 1, shuttleStep + 1);
      } else {
        shuttleDirection = -1;
        shuttleStep = 0;
      }
      video.pause();
      video.playbackRate = 1;
      const speed = SHUTTLE_SPEEDS[shuttleStep];
      const token = reverseFrame + 1;
      reverseFrame = token;
      playReverseAudio(speed, token);
      const minFrameSeconds = 1 / Math.max(1, state.fps || 24);
      const maxStepSeconds = minFrameSeconds * Math.max(1, speed);
      let reverseBaseTime = Math.max(0, video.currentTime);
      let reverseStartTime = performance.now();
      let pendingSeek = false;
      let lastTarget = reverseBaseTime;
      const step = (now = performance.now()) => {
        if (reverseFrame !== token || shuttleDirection !== -1) return;
        if (pendingSeek) return;
        const elapsed = Math.max(0, (now - reverseStartTime) / 1000);
        const target = Math.max(0, reverseBaseTime - elapsed * speed);
        const next = Math.max(0, Math.min(lastTarget - minFrameSeconds, target, video.currentTime - minFrameSeconds));
        if (video.currentTime <= minFrameSeconds || next <= 0) {
          video.currentTime = 0;
          stopShuttle();
          return;
        }
        pendingSeek = true;
        lastTarget = Math.max(0, next);
        let seekFinished = false;
        const finishSeek = () => {
          if (seekFinished) return;
          seekFinished = true;
          if (reverseFrame !== token || shuttleDirection !== -1) return;
          pendingSeek = false;
          ensurePlayheadVisible();
          scheduleRender();
          requestAnimationFrame(step);
        };
        video.addEventListener("seeked", finishSeek, { once: true });
        video.currentTime = lastTarget;
        reverseBaseTime = lastTarget;
        reverseStartTime = now;
        if (Math.abs(video.currentTime - lastTarget) < minFrameSeconds / 2) {
          setTimeout(finishSeek, Math.max(8, Math.min(32, (maxStepSeconds / speed) * 1000)));
        }
      };
      requestAnimationFrame(step);
      updatePlayButton();
      render();
    }

    function toggleLoop() {
      const active = !loopBtn.classList.contains("active");
      loopBtn.classList.toggle("active", active);
      if (active && state.video_url) {
        if (!frameIsVisible(state.in_frame)) {
          centerTimelineOnFrame(state.in_frame);
          scheduleRender();
        }
        if (currentFrame() < state.in_frame || currentFrame() > state.out_frame) {
          seekFrame(state.in_frame, { centerIfOutside: true });
        }
        video.play();
      }
    }

    function updatePlayButton() {
      const playing = !video.paused;
      playBtn.innerHTML = playing ? icons.stop : icons.play;
      playBtn.title = playing ? "Stop - Space" : "Play - Space";
      scheduleRender();
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
      if (!video.paused && loopBtn.classList.contains("active")) {
        if (currentFrame() > state.out_frame) {
          seekFrame(state.in_frame, { centerIfOutside: true });
          video.play();
        }
      }
      ensurePlayheadVisible();
      scheduleRender();
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
      const maxForCurrentNode = fullscreenActive
        ? Math.max(MIN_TIMELINE_HEIGHT, window.innerHeight - 260)
        : Math.max(
            MIN_TIMELINE_HEIGHT,
            (node._precutWidgetHeight || minimumWidgetHeight()) - fixedWidgetHeight(0) - MIN_VIDEO_HEIGHT
          );
      return {
        maxTimeline: Math.min(MAX_TIMELINE_HEIGHT, maxForCurrentNode),
      };
    }

    function timelineHeightFromDrag(clientY, drag) {
      const requested = drag.startTimelineHeight - (clientY - drag.startClientY);
      return Math.max(
        MIN_TIMELINE_HEIGHT,
        Math.min(drag.metrics.maxTimeline, requested)
      );
    }
    for (const eventName of ["mousedown", "click", "dblclick", "touchstart", "touchmove"]) {
      splitter.addEventListener(eventName, stopSplitterEvent, true);
    }
    splitter.addEventListener("pointerdown", (event) => {
      const metrics = splitterMetrics();
      activePrecutDrag = true;
      timelineResize = {
        pointerId: event.pointerId,
        metrics,
        startClientY: event.clientY,
        startTimelineHeight: timelineHeight(),
      };
      splitter.classList.add("resizing");
      try {
        splitter.setPointerCapture?.(event.pointerId);
      } catch {}
      stopSplitterEvent(event);
    }, true);
    splitter.addEventListener("pointermove", (event) => {
      if (!timelineResize || timelineResize.pointerId !== event.pointerId) return;
      node._precutTimelineHeight = timelineHeightFromDrag(event.clientY, timelineResize);
      markWaveformDirty();
      syncWidgetSize(false);
      render();
      stopSplitterEvent(event);
    }, true);
    splitter.addEventListener("pointerup", (event) => {
      if (timelineResize?.pointerId === event.pointerId) {
        timelineResize = null;
        activePrecutDrag = false;
        splitter.classList.remove("resizing");
        try {
          splitter.releasePointerCapture?.(event.pointerId);
        } catch {}
        syncWidgetSize(false);
        stopSplitterEvent(event);
      }
    });
    splitter.addEventListener("pointercancel", (event) => {
      timelineResize = null;
      activePrecutDrag = false;
      splitter.classList.remove("resizing");
      stopSplitterEvent(event);
    });

    firstBtn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      seekFrame(0, { centerIfOutside: true });
    });
    lastBtn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      seekFrame(state.frame_count - 1, { centerIfOutside: true });
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

    function snapPlayheadTimecodeSelection() {
      if (document.activeElement !== playheadInput) return;
      const start = playheadInput.selectionStart ?? 0;
      const end = playheadInput.selectionEnd ?? start;
      if (start === 0 && end >= playheadInput.value.length) return;
      const pairIndex = start === end
        ? timecodePairFromCaret(start)
        : Math.max(0, timecodePairFromSelection(start, end));
      const pairStart = TIMECODE_PAIR_STARTS[pairIndex >= 0 ? pairIndex : timecodePairFromCaret(start)];
      if (start === pairStart && end === pairStart + 2) return;
      playheadInput.setSelectionRange(pairStart, pairStart + 2);
    }

    playheadInput.addEventListener("keydown", (event) => {
      if (/^\d$/.test(event.key)) {
        const allSelected = playheadInput.selectionStart === 0 && playheadInput.selectionEnd >= playheadInput.value.length;
        const pairIndex = timecodePairFromSelection(playheadInput.selectionStart, playheadInput.selectionEnd);
        if (!allSelected && pairIndex >= 0) {
          if (playheadPairEditIndex !== pairIndex) {
            playheadPairEditIndex = pairIndex;
            playheadPairEditDigits = "";
          }
          playheadPairEditDigits = (playheadPairEditDigits + event.key).slice(-2);
          const digits = playheadInput.value.replace(/\D/g, "").padStart(8, "0").slice(0, 8).split("");
          const pairValue = playheadPairEditDigits.length === 1 ? `0${playheadPairEditDigits}` : playheadPairEditDigits;
          digits[pairIndex * 2] = pairValue[0];
          digits[pairIndex * 2 + 1] = pairValue[1];
          playheadInput.value = formatTimecodeDigits(digits.join(""));
          if (playheadPairEditDigits.length >= 2) {
            playheadPairEditIndex = -1;
            playheadPairEditDigits = "";
            const nextPair = Math.min(TIMECODE_PAIR_STARTS.length - 1, pairIndex + 1);
            const nextStart = TIMECODE_PAIR_STARTS[nextPair];
            playheadInput.setSelectionRange(nextStart, nextStart + 2);
          } else {
            const start = TIMECODE_PAIR_STARTS[pairIndex];
            playheadInput.setSelectionRange(start, start + 2);
          }
        } else {
          playheadPairEditIndex = -1;
          playheadPairEditDigits = "";
          playheadEditDigits = (playheadEditDigits + event.key).slice(0, 8);
          playheadInput.value = formatTimecodeDigits(playheadEditDigits);
          playheadInput.setSelectionRange(playheadInput.value.length, playheadInput.value.length);
        }
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === "Backspace") {
        playheadPairEditIndex = -1;
        playheadPairEditDigits = "";
        playheadEditDigits = playheadEditDigits.slice(0, -1);
        playheadInput.value = formatTimecodeDigits(playheadEditDigits);
        playheadInput.setSelectionRange(playheadInput.value.length, playheadInput.value.length);
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === "Enter") {
        const frame = parseTimecode(playheadInput.value, state.fps);
        if (frame !== null) seekFrame(frame, { center: true });
        playheadInput.blur();
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === "Escape") {
        playheadInput.value = fmtTime(frameToSeconds(currentFrame()), state.fps);
        playheadInput.blur();
        event.preventDefault();
        event.stopPropagation();
      }
    });
    playheadInput.addEventListener("input", () => {
      playheadPairEditIndex = -1;
      playheadPairEditDigits = "";
      playheadEditDigits = playheadInput.value.replace(/\D/g, "").slice(0, 8);
      playheadInput.value = formatTimecodeDigits(playheadEditDigits);
      playheadInput.setSelectionRange(playheadInput.value.length, playheadInput.value.length);
    });
    playheadInput.addEventListener("mousedown", (event) => event.stopPropagation());
    playheadInput.addEventListener("mouseup", () => setTimeout(snapPlayheadTimecodeSelection, 0));
    playheadInput.addEventListener("click", () => setTimeout(snapPlayheadTimecodeSelection, 0));
    playheadInput.addEventListener("select", () => setTimeout(snapPlayheadTimecodeSelection, 0));
    playheadInput.addEventListener("keyup", (event) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        snapPlayheadTimecodeSelection();
      }
    });
    playheadInput.addEventListener("focus", () => {
      playheadEditDigits = "";
      playheadPairEditIndex = -1;
      playheadPairEditDigits = "";
      playheadInput.select();
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
        panTimelineAtEdge(event);
        hoverFrame = frameFromEvent(event);
        seekFrame(hoverFrame);
      } else if (dragging === "range") {
        const length = state.out_frame - state.in_frame;
        const maxStart = Math.max(0, state.frame_count - 1 - length);
        const start = Math.max(0, Math.min(maxStart, hoverFrame - rangeDragOffset));
        state.in_frame = start;
        state.out_frame = start + length;
        timeline.style.cursor = "move";
        persist();
      } else if (dragging === "timeline-pan" && timelinePan) {
        const rect = timeline.getBoundingClientRect();
        const framesPerPixel = (timelinePan.end - timelinePan.start) / Math.max(1, rect.width);
        const delta = (event.clientX - timelinePan.clientX) * framesPerPixel;
        setVisibleRange(timelinePan.start - delta, timelinePan.end - delta);
        markWaveformDirty();
        timeline.style.cursor = "grabbing";
        scheduleRender();
      } else {
        if (rangeLabelHit(event)) {
          timeline.style.cursor = "move";
        } else if (nearPlayhead(event)) {
          timeline.style.cursor = "crosshair";
        } else if (inTimecodeZone(event)) {
          timeline.style.cursor = "crosshair";
        } else if (nearestRangeEdge(event)) {
          timeline.style.cursor = "ew-resize";
        } else {
          timeline.style.cursor = "grab";
        }
      }
    });

    timeline.addEventListener("mousedown", (event) => {
      if (event.target.closest(".precut-navigator")) return;
      activePrecutDrag = true;
      hoverFrame = frameFromEvent(event);
      if (rangeLabelHit(event)) {
        dragging = "range";
        rangeDragOffset = hoverFrame - state.in_frame;
        timeline.style.cursor = "move";
      } else if (nearPlayhead(event) || inTimecodeZone(event)) {
        dragging = "playhead";
        seekFrame(hoverFrame);
      } else {
        dragging = nearestRangeEdge(event);
        if (dragging) {
          timeline.style.cursor = "ew-resize";
        } else {
          const [start, end] = visibleRange();
          dragging = "timeline-pan";
          timelinePan = { clientX: event.clientX, start, end };
          timeline.style.cursor = "grabbing";
        }
      }
      event.preventDefault();
    });
    window.addEventListener("mouseup", () => {
      const wasActive = activePrecutDrag;
      dragging = null;
      rangeDragOffset = 0;
      timelinePan = null;
      navDragging = null;
      activePrecutDrag = false;
      navigator.style.cursor = "grab";
      if (wasActive) resetPrecutCanvasDrag(null, true);
    });
    window.addEventListener("pointerup", (event) => {
      if (activePrecutDrag) resetPrecutCanvasDrag(event, true);
    }, true);
    window.addEventListener("pointercancel", (event) => {
      if (activePrecutDrag) resetPrecutCanvasDrag(event, true);
      activePrecutDrag = false;
    }, true);
    window.addEventListener("blur", (event) => {
      if (activePrecutDrag) resetPrecutCanvasDrag(event, true);
      activePrecutDrag = false;
    }, true);
    window.addEventListener("mousemove", (event) => resetPrecutCanvasDrag(event), true);

    function navFrameFromEvent(event) {
      const metrics = navigatorTrackMetrics();
      return navFrameFromLocalX(navigatorLocalX(event, metrics), metrics);
    }

    function navFrameFromLocalX(localX, metrics = navigatorTrackMetrics()) {
      const pct = Math.max(0, Math.min(1, (localX - metrics.trackLeft) / metrics.trackWidth));
      return pct * Math.max(1, state.frame_count - 1);
    }

    navigator.addEventListener("mousedown", (event) => {
      if (event.detail > 1) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      activePrecutDrag = true;
      const metrics = navigatorMetrics();
      const { start, end, total, trackLeft, visualLeft, visualWidth, maxStart, maxVisualLeft } = metrics;
      const frame = navFrameFromEvent(event);
      const visible = end - start;
      const localX = navigatorLocalX(event, metrics);
      const overVisualWindow = localX >= visualLeft && localX <= visualLeft + visualWidth;
      if (event.target === navLeft) {
        navDragging = {
          mode: "left",
          start,
          end,
          pointerOffsetPx: localX - visualLeft,
        };
      } else if (event.target === navRight) {
        navDragging = {
          mode: "right",
          start,
          end,
          pointerOffsetPx: localX - (visualLeft + visualWidth),
        };
      } else if (overVisualWindow) {
        navDragging = {
          mode: "window",
          start,
          end,
          visualLeft,
          visualWidth,
          pointerOffsetPx: localX - visualLeft,
        };
        navigator.style.cursor = "grabbing";
      } else {
        const nextStart = Math.max(0, Math.min(total - visible, frame - visible / 2));
        setVisibleRange(nextStart, nextStart + visible);
        markWaveformDirty();
        scheduleRender();
        const nextVisualLeft = trackLeft + thumbLeftFromRangeStart(nextStart, maxStart, maxVisualLeft);
        navDragging = {
          mode: "window",
          start: nextStart,
          end: nextStart + visible,
          visualWidth,
          pointerOffsetPx: Math.max(0, Math.min(visualWidth, localX - nextVisualLeft)),
        };
        navigator.style.cursor = "grabbing";
      }
      event.preventDefault();
      event.stopPropagation();
    });

    navigator.addEventListener("dblclick", (event) => {
      toggleTimelineZoom();
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    });

    window.addEventListener("mousemove", (event) => {
      if (!navDragging) return;
      const total = Math.max(1, state.frame_count - 1);
      const visible = navDragging.end - navDragging.start;
      if (navDragging.mode === "left") {
        const metrics = navigatorTrackMetrics();
        const edge = navigatorLocalX(event, metrics) - navDragging.pointerOffsetPx - metrics.trackLeft;
        const start = rangeStartFromThumbLeftEdge(navDragging.end, edge, total, metrics.trackWidth);
        setVisibleRange(start, navDragging.end);
      } else if (navDragging.mode === "right") {
        const metrics = navigatorTrackMetrics();
        const edge = navigatorLocalX(event, metrics) - navDragging.pointerOffsetPx - metrics.trackLeft;
        const end = rangeEndFromVisualRight(navDragging.start, edge, total, metrics.trackWidth);
        setVisibleRange(navDragging.start, end);
      } else {
        const metrics = navigatorTrackMetrics();
        const { trackLeft, trackWidth } = metrics;
        const localX = navigatorLocalX(event, metrics);
        const maxVisualLeft = Math.max(0, trackWidth - navDragging.visualWidth);
        const visualOffset = Math.max(0, Math.min(maxVisualLeft, localX - trackLeft - navDragging.pointerOffsetPx));
        const maxStart = Math.max(0, total - visible);
        const start = rangeStartFromThumbLeft(visualOffset, maxStart, maxVisualLeft);
        setVisibleRange(start, start + visible);
      }
      markWaveformDirty();
      scheduleRender();
    });

    timeline.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        zoomTimeline(event.deltaY < 0 ? 1 : -1);
      },
      { passive: false }
    );

    window.addEventListener("keydown", (event) => {
      if (!document.body.contains(root)) return;
      if (!pointerInside && !timeline.matches(":hover")) return;
      const target = event.target;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const key = event.key.toLowerCase();
      const handled = ["i", "o", "f", "j", "k", "l", "+", "=", "-", "_", "shift", "escape", "arrowdown", "arrowup", "arrowleft", "arrowright"].includes(key) || event.code === "Space";
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }

      if (key === "i") {
        markIn();
      } else if (key === "o") {
        markOut();
      } else if (key === "f") {
        toggleFullscreen(!fullscreenActive);
      } else if (event.key === "Escape" && fullscreenActive) {
        toggleFullscreen(false);
      } else if (event.key === "Shift" && !event.repeat) {
        toggleLoop();
      } else if (event.key === "ArrowDown") {
        seekFrame(doublePressArrow("down") ? state.frame_count - 1 : state.out_frame, { centerIfOutside: true });
      } else if (event.key === "ArrowUp") {
        seekFrame(doublePressArrow("up") ? 0 : state.in_frame, { centerIfOutside: true });
      } else if (event.key === "ArrowLeft") {
        lastArrowJumpKey = "";
        seekFrame(currentFrame() - 1, { scrubAudio: true });
      } else if (event.key === "ArrowRight") {
        lastArrowJumpKey = "";
        seekFrame(currentFrame() + 1, { scrubAudio: true });
      } else if (event.code === "Space") {
        togglePlay();
      } else if (key === "+" || key === "=") {
        zoomTimeline(1);
      } else if (key === "-" || key === "_") {
        zoomTimeline(-1);
      } else if (key === "j") {
        shuttleReverse();
      } else if (key === "k") {
        togglePlay();
      } else if (key === "l") {
        shuttleForward();
      }
    }, true);

    hydrateVideo();
    syncWidgetSize();
    render();
    new ResizeObserver(() => {
      syncWidgetSize();
      markWaveformDirty();
      scheduleRender();
    }).observe(root);
    window.addEventListener("resize", () => {
      if (!fullscreenActive) return;
      syncWidgetSize(false);
      scheduleRender();
    });
    document.addEventListener("fullscreenchange", () => {
      if (fullscreenActive && document.fullscreenElement !== root) {
        toggleFullscreen(false);
      }
    });
    node.setDirtyCanvas(true, true);
  },
});
