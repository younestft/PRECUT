import { app } from "../../scripts/app.js";

const MIN_NODE_WIDTH = 520;
const MIN_VIDEO_HEIGHT = 120;
const MAX_VIDEO_HEIGHT = 340;
const VIDEO_TO_WIDGET_MARGIN = 210;
const MIN_TIMELINE_HEIGHT = 96;
const MAX_TIMELINE_HEIGHT = 300;
const DEFAULT_TIMELINE_HEIGHT = 132;
const CONTROLS_HEIGHT = 58;
const SPLITTER_HEIGHT = 8;
const NODE_BOTTOM_PADDING = 8;

function installStyleFix() {
  if (document.getElementById("precut-layout-fix-style")) return;
  const style = document.createElement("style");
  style.id = "precut-layout-fix-style";
  style.textContent = `
    .precut-ui {
      --precut-btn-size: clamp(34px, 7cqw, 54px);
      min-width: 430px !important;
      height: var(--precut-widget-height, auto) !important;
      container-type: inline-size !important;
      gap: 8px !important;
      padding: 8px !important;
    }
    .precut-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(6px, 1.4cqw, 14px);
    }
    .precut-placeholder svg {
      width: clamp(42px, 10cqw, 118px) !important;
      height: clamp(42px, 10cqw, 118px) !important;
    }
    .precut-placeholder.audio svg {
      width: clamp(64px, 14cqw, 150px) !important;
      height: clamp(64px, 14cqw, 150px) !important;
    }
    .precut-video {
      flex: 1 1 auto !important;
      min-height: 100px !important;
      height: var(--precut-video-height, 240px) !important;
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
      height: var(--precut-timeline-height, ${DEFAULT_TIMELINE_HEIGHT}px) !important;
      flex: 0 0 var(--precut-timeline-height, ${DEFAULT_TIMELINE_HEIGHT}px) !important;
    }
    .precut-wave {
      top: 36px !important;
      bottom: 30px !important;
      height: calc(100% - 72px) !important;
    }
    .precut-selection,
    .precut-playhead {
      bottom: 30px !important;
    }
    .precut-navigator {
      bottom: 5px !important;
    }
    .precut-controls {
      min-height: ${CONTROLS_HEIGHT}px !important;
      padding: 6px !important;
      flex: 0 0 auto !important;
    }
    .precut-control-group { gap: clamp(5px, 1vw, 10px) !important; }
    .precut-marker-controls { margin-right: clamp(8px, 2vw, 24px) !important; }
    .precut-right-controls { margin-left: clamp(8px, 2vw, 24px) !important; }
    .precut-btn {
      width: var(--precut-btn-size) !important;
      height: var(--precut-btn-size) !important;
      aspect-ratio: 1 / 1 !important;
      display: grid !important;
      place-items: center !important;
      text-align: center !important;
      line-height: 1 !important;
      overflow: hidden !important;
      flex: 0 0 auto !important;
    }
    .precut-video-actions .precut-btn {
      width: auto !important;
      height: 34px !important;
      min-width: clamp(122px, 24cqw, 156px) !important;
      white-space: nowrap !important;
    }
    .precut-logo { min-width: 150px !important; }
    .precut-logo-text {
      display: inline !important;
      font-size: clamp(18px, 3.4cqw, 23px) !important;
    }
    .precut-readout {
      width: clamp(104px, 18cqw, 150px) !important;
      height: var(--precut-btn-size) !important;
      display: grid !important;
      place-items: center !important;
      font-size: clamp(12px, 2.5cqw, 17px) !important;
      line-height: 1 !important;
      text-align: center !important;
      overflow: hidden !important;
      flex: 0 0 auto !important;
    }
    .precut-handle.out {
      left: auto !important;
      right: calc(100% - var(--out)) !important;
    }
    @container (max-width: 560px) {
      .precut-ui { gap: 7px !important; padding: 8px !important; }
      .precut-video-actions { gap: 6px !important; }
      .precut-video-actions .precut-btn {
        min-width: 156px !important;
        width: 156px !important;
        padding: 0 8px !important;
        font-size: 10px !important;
      }
      .precut-ui { --precut-btn-size: 40px !important; }
      .precut-logo {
        min-width: 150px !important;
        gap: 6px !important;
      }
      .precut-logo-mark { width: 48px !important; }
      .precut-logo-text {
        display: inline !important;
        font-size: 18px !important;
      }
      .precut-control-group { gap: 4px !important; }
      .precut-marker-controls { margin-right: 6px !important; }
      .precut-right-controls { margin-left: 6px !important; }
      .precut-btn.mark { font-size: 8.5px !important; }
      .precut-readout {
        width: 104px !important;
        font-size: 13px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function chromeHeight(node, widget) {
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

function timelineHeight(node) {
  return Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, node._precutTimelineHeight || DEFAULT_TIMELINE_HEIGHT));
}

function fixedWidgetHeight(node) {
  return 34 + timelineHeight(node) + CONTROLS_HEIGHT + SPLITTER_HEIGHT + 46;
}

function minimumWidgetHeight(node) {
  const width = Math.max(MIN_NODE_WIDTH, node.size?.[0] || MIN_NODE_WIDTH);
  const defaultVideoHeight = Math.max(
    MIN_VIDEO_HEIGHT,
    Math.min(MAX_VIDEO_HEIGHT, Math.round((width - VIDEO_TO_WIDGET_MARGIN) * 9 / 16))
  );
  return defaultVideoHeight + fixedWidgetHeight(node);
}

function findPrecutRoot(node) {
  return node._precutWidget?.element || node._precutWidget?.inputEl || null;
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

function ensureSplitter(node, root, timeline) {
  let splitter = root.querySelector(".precut-splitter");
  if (!splitter) {
    splitter = document.createElement("div");
    splitter.className = "precut-splitter";
    splitter.title = "Drag to resize the timeline";
    root.insertBefore(splitter, timeline);
  }
  if (splitter._precutSplitterInstalled) return splitter;
  splitter._precutSplitterInstalled = true;
  let drag = null;
  const timelineHeightForSplitterCenter = (clientY, pointerOffset = 0) => {
    const rootRect = root.getBoundingClientRect();
    const controls = root.querySelector(".precut-controls");
    const controlsRect = controls?.getBoundingClientRect();
    if (!controlsRect) return timelineHeight(node);
    const styles = getComputedStyle(root);
    const gap = parseFloat(styles.rowGap || styles.gap || "0") || 0;
    const splitterCenter = Math.max(
      rootRect.top,
      Math.min(controlsRect.top - 2 * gap - MIN_TIMELINE_HEIGHT - SPLITTER_HEIGHT / 2, clientY - pointerOffset)
    );
    const bottomAnchor = controlsRect.top - 2 * gap;
    return Math.max(
      MIN_TIMELINE_HEIGHT,
      Math.min(MAX_TIMELINE_HEIGHT, bottomAnchor - splitterCenter - SPLITTER_HEIGHT / 2)
    );
  };
  splitter.addEventListener("pointerdown", (event) => {
    const splitterRect = splitter.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      pointerOffset: event.clientY - (splitterRect.top + splitterRect.height / 2),
    };
    splitter.classList.add("resizing");
    try {
      splitter.setPointerCapture?.(event.pointerId);
    } catch {}
    event.preventDefault();
    event.stopPropagation();
  });
  splitter.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    node._precutTimelineHeight = timelineHeightForSplitterCenter(event.clientY, drag.pointerOffset);
    node._precutSyncLayout?.();
    node._precutRender?.();
    event.preventDefault();
  });
  const end = (event) => {
    if (drag?.pointerId === event.pointerId) {
      drag = null;
      splitter.classList.remove("resizing");
      try {
        splitter.releasePointerCapture?.(event.pointerId);
      } catch {}
      node._precutSyncLayout?.();
    }
  };
  splitter.addEventListener("pointerup", end);
  splitter.addEventListener("pointercancel", end);
  return splitter;
}

function repairNodeLayout(node) {
  const widget = node._precutWidget;
  const root = findPrecutRoot(node);
  if (!widget || !root) return false;
  const timeline = root.querySelector(".precut-timeline");
  if (!timeline) return false;
  hidePrecutStateTextarea(root);
  ensureSplitter(node, root, timeline);

  const sync = () => {
    const width = Math.max(MIN_NODE_WIDTH, node.size?.[0] || MIN_NODE_WIDTH);
    const minHeight = minimumWidgetHeight(node);
    const chrome = chromeHeight(node, widget);
    const availableHeight = Math.max(0, (node.size?.[1] || 0) - chrome);
    const height = Math.max(minHeight, availableHeight);
    const videoHeight = Math.max(MIN_VIDEO_HEIGHT, height - fixedWidgetHeight(node));
    const minNodeHeight = Math.ceil(chrome + minHeight);

    node.resizable = true;
    node._precutWidgetHeight = height;
    root.style.minWidth = "430px";
    root.style.setProperty("--precut-video-height", `${videoHeight}px`);
    root.style.setProperty("--precut-timeline-height", `${timelineHeight(node)}px`);
    root.style.setProperty("--precut-widget-height", `${height}px`);
    root.style.height = `${height}px`;
    timeline.style.setProperty("--out-label-top", "calc(100% - 50px)");
    hidePrecutStateTextarea(root);
    const placeholder = root.querySelector(".precut-placeholder");
    if (placeholder && placeholder.style.display === "grid") placeholder.style.display = "flex";

    widget.options ||= {};
    widget.options.getMinHeight = () => minHeight;
    widget.options.getMaxHeight = () => Math.max(node._precutWidgetHeight || height, minHeight);
    widget.options.getHeight = () => node._precutWidgetHeight || height;
    widget.computeSize = () => [width, node._precutWidgetHeight || height];

    if (node.size[0] !== width || node.size[1] < minNodeHeight) {
      const next = [width, Math.max(node.size?.[1] || 0, minNodeHeight)];
      if (typeof node.setSize === "function") node.setSize(next);
      else node.size = next;
    }
    node._precutRender?.();
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
  };

  node.onResize = function () {
    sync();
    requestAnimationFrame(sync);
  };
  node._precutSyncLayout = sync;

  if (!node._precutLayoutFixObserver) {
    node._precutLayoutFixObserver = new ResizeObserver(() => requestAnimationFrame(sync));
    node._precutLayoutFixObserver.observe(root);
  }

  sync();
  requestAnimationFrame(sync);
  return true;
}

function repairAllPrecutNodes() {
  installStyleFix();
  for (const node of app.graph?._nodes || []) {
    if (node?.comfyClass === "PRECUT") repairNodeLayout(node);
  }
}

app.registerExtension({
  name: "PRECUT.LayoutFix",
  setup() {
    installStyleFix();
    setInterval(repairAllPrecutNodes, 500);
    requestAnimationFrame(repairAllPrecutNodes);
  },
  async nodeCreated(node) {
    if (node.comfyClass !== "PRECUT") return;
    installStyleFix();
    node.resizable = true;
    let attempts = 0;
    const tryRepair = () => {
      attempts += 1;
      if (!repairNodeLayout(node) && attempts < 80) requestAnimationFrame(tryRepair);
    };
    requestAnimationFrame(tryRepair);
  },
});
