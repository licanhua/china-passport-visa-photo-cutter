const DIGITAL_W = 387;
const DIGITAL_H = 516;
const EDITOR_OVERLAY_ALPHA = 0.5;
const MIN_DPI = 150;
const MAX_DPI = 600;
const DEFAULT_DPI = 300;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

const SHEETS = {
  "4x6": { widthIn: 4, heightIn: 6 },
  "5x7": { widthIn: 5, heightIn: 7 }
};

const state = {
  sourceImage: null,
  referenceBaseImage: null,
  referenceGuideImage: null,
  scaleMultiplier: 1,
  offsetX: 0,
  offsetY: 0,
  dpi: DEFAULT_DPI,
  dragging: false,
  dragPointerId: null,
  lastDragClientX: 0,
  lastDragClientY: 0
};

const uploadInput = document.getElementById("uploadInput");
const scaleInput = document.getElementById("scaleInput");
const dpiInput = document.getElementById("dpiInput");
const resetBtn = document.getElementById("resetBtn");

const editorBaseCanvas = document.getElementById("editorBaseCanvas");
const editorBaseCtx = editorBaseCanvas.getContext("2d", { alpha: false });
const editorGuideCanvas = document.getElementById("editorGuideCanvas");
const editorGuideCtx = editorGuideCanvas.getContext("2d", { alpha: false });

const digitalPreviewCanvas = document.getElementById("digitalPreviewCanvas");
const digitalPreviewCtx = digitalPreviewCanvas.getContext("2d", { alpha: false });
const print4PreviewCanvas = document.getElementById("print4PreviewCanvas");
const print4PreviewCtx = print4PreviewCanvas.getContext("2d", { alpha: false });
const print5PreviewCanvas = document.getElementById("print5PreviewCanvas");
const print5PreviewCtx = print5PreviewCanvas.getContext("2d", { alpha: false });

const layout4x6El = document.getElementById("layout4x6");
const layout5x7El = document.getElementById("layout5x7");

const downloadDigitalBtn = document.getElementById("downloadDigitalBtn");
const download4x6Btn = document.getElementById("download4x6Btn");
const download5x7Btn = document.getElementById("download5x7Btn");

const digitalCanvas = document.createElement("canvas");
digitalCanvas.width = DIGITAL_W;
digitalCanvas.height = DIGITAL_H;
const digitalCtx = digitalCanvas.getContext("2d", { alpha: false });

const print4Canvas = document.createElement("canvas");
const print4Ctx = print4Canvas.getContext("2d", { alpha: false });
const print5Canvas = document.createElement("canvas");
const print5Ctx = print5Canvas.getContext("2d", { alpha: false });

let print4LayoutMeta = null;
let print5LayoutMeta = null;

function loadImage(srcPath, { required = true } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (required) {
        reject(new Error(`Failed to load image: ${srcPath}`));
        return;
      }
      resolve(null);
    };
    img.src = srcPath;
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getBaseScale(canvasW, canvasH, imageW, imageH) {
  return Math.max(canvasW / imageW, canvasH / imageH);
}

function drawCompositedPhoto(ctx, canvasW, canvasH, options = {}) {
  const imageAlpha = options.imageAlpha ?? 1;
  const referenceMode = options.referenceMode ?? "none";

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  if ((referenceMode === "base" || referenceMode === "both") && state.referenceBaseImage) {
    ctx.drawImage(state.referenceBaseImage, 0, 0, canvasW, canvasH);
  }
  if ((referenceMode === "guide" || referenceMode === "both") && state.referenceGuideImage) {
    ctx.drawImage(state.referenceGuideImage, 0, 0, canvasW, canvasH);
  }

  if (state.sourceImage) {
    const image = state.sourceImage;
    const baseScale = getBaseScale(canvasW, canvasH, image.width, image.height);
    const drawScale = baseScale * state.scaleMultiplier;
    const drawW = image.width * drawScale;
    const drawH = image.height * drawScale;

    const offsetScaleX = canvasW / DIGITAL_W;
    const offsetScaleY = canvasH / DIGITAL_H;

    const dx = (canvasW - drawW) / 2 + state.offsetX * offsetScaleX;
    const dy = (canvasH - drawH) / 2 + state.offsetY * offsetScaleY;

    ctx.globalAlpha = imageAlpha;
    ctx.drawImage(image, dx, dy, drawW, drawH);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function computeEvenGridLayout(sheetW, sheetH, photoW, photoH, minGapPx, minMarginPx) {
  const maxCols = Math.max(1, Math.floor((sheetW - minMarginPx * 2 + minGapPx) / (photoW + minGapPx)));
  const maxRows = Math.max(1, Math.floor((sheetH - minMarginPx * 2 + minGapPx) / (photoH + minGapPx)));

  let best = null;

  for (let cols = 1; cols <= maxCols; cols += 1) {
    for (let rows = 1; rows <= maxRows; rows += 1) {
      const usedW = cols * photoW;
      const usedH = rows * photoH;
      if (usedW > sheetW || usedH > sheetH) {
        continue;
      }

      const gapX = (sheetW - usedW) / (cols + 1);
      const gapY = (sheetH - usedH) / (rows + 1);

      if (gapX < minGapPx || gapY < minGapPx || gapX < minMarginPx || gapY < minMarginPx) {
        continue;
      }

      const count = cols * rows;
      const areaFill = (usedW * usedH) / (sheetW * sheetH);

      if (!best || count > best.count || (count === best.count && areaFill > best.areaFill)) {
        best = { cols, rows, count, gapX, gapY, areaFill };
      }
    }
  }

  if (best) {
    return best;
  }

  return { cols: 1, rows: 1, count: 1, gapX: Math.max(minMarginPx, (sheetW - photoW) / 2), gapY: Math.max(minMarginPx, (sheetH - photoH) / 2), areaFill: (photoW * photoH) / (sheetW * sheetH) };
}

function renderPrintSheet(ctx, canvas, sheetKey) {
  const sheet = SHEETS[sheetKey];
  const dpi = clamp(Number(state.dpi) || DEFAULT_DPI, MIN_DPI, MAX_DPI);
  const sheetW = Math.round(sheet.widthIn * dpi);
  const sheetH = Math.round(sheet.heightIn * dpi);

  canvas.width = sheetW;
  canvas.height = sheetH;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheetW, sheetH);

  drawCompositedPhoto(digitalCtx, DIGITAL_W, DIGITAL_H, { imageAlpha: 1 });

  const minGapPx = Math.max(10, Math.round(dpi * 0.08));
  const minMarginPx = Math.max(10, Math.round(dpi * 0.08));
  const layout = computeEvenGridLayout(sheetW, sheetH, DIGITAL_W, DIGITAL_H, minGapPx, minMarginPx);

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const x = layout.gapX + col * (DIGITAL_W + layout.gapX);
      const y = layout.gapY + row * (DIGITAL_H + layout.gapY);
      ctx.drawImage(digitalCanvas, Math.round(x), Math.round(y), DIGITAL_W, DIGITAL_H);
    }
  }

  return {
    cols: layout.cols,
    rows: layout.rows,
    total: layout.count,
    sheetW,
    sheetH,
    dpi
  };
}

function drawPreviewFromSource(targetCtx, targetCanvas, sourceCanvas) {
  const tw = targetCanvas.width;
  const th = targetCanvas.height;

  targetCtx.fillStyle = "#ffffff";
  targetCtx.fillRect(0, 0, tw, th);

  const scale = Math.min(tw / sourceCanvas.width, th / sourceCanvas.height);
  const dw = sourceCanvas.width * scale;
  const dh = sourceCanvas.height * scale;
  const dx = (tw - dw) / 2;
  const dy = (th - dh) / 2;

  targetCtx.drawImage(sourceCanvas, dx, dy, dw, dh);
}

function setActionEnabled(enabled) {
  downloadDigitalBtn.disabled = !enabled;
  download4x6Btn.disabled = !enabled;
  download5x7Btn.disabled = !enabled;
}

function updateLayoutMeta() {
  if (!state.sourceImage) {
    layout4x6El.textContent = "Upload a photo to see layout details.";
    layout5x7El.textContent = "Upload a photo to see layout details.";
    return;
  }

  layout4x6El.textContent = `${print4LayoutMeta.rows} rows x ${print4LayoutMeta.cols} cols = ${print4LayoutMeta.total} photos (${print4LayoutMeta.sheetW}x${print4LayoutMeta.sheetH}px at ${print4LayoutMeta.dpi} DPI)`;
  layout5x7El.textContent = `${print5LayoutMeta.rows} rows x ${print5LayoutMeta.cols} cols = ${print5LayoutMeta.total} photos (${print5LayoutMeta.sheetW}x${print5LayoutMeta.sheetH}px at ${print5LayoutMeta.dpi} DPI)`;
}

function renderAll() {
  drawCompositedPhoto(editorBaseCtx, editorBaseCanvas.width, editorBaseCanvas.height, {
    referenceMode: "base",
    imageAlpha: state.sourceImage ? EDITOR_OVERLAY_ALPHA : 1
  });
  drawCompositedPhoto(editorGuideCtx, editorGuideCanvas.width, editorGuideCanvas.height, {
    referenceMode: "guide",
    imageAlpha: state.sourceImage ? EDITOR_OVERLAY_ALPHA : 1
  });

  if (!state.sourceImage) {
    drawCompositedPhoto(digitalPreviewCtx, digitalPreviewCanvas.width, digitalPreviewCanvas.height, {
      referenceMode: "none",
      imageAlpha: 1
    });

    print4PreviewCtx.fillStyle = "#ffffff";
    print4PreviewCtx.fillRect(0, 0, print4PreviewCanvas.width, print4PreviewCanvas.height);
    print5PreviewCtx.fillStyle = "#ffffff";
    print5PreviewCtx.fillRect(0, 0, print5PreviewCanvas.width, print5PreviewCanvas.height);

    setActionEnabled(false);
    updateLayoutMeta();
    return;
  }

  drawCompositedPhoto(digitalCtx, DIGITAL_W, DIGITAL_H, { referenceMode: "none", imageAlpha: 1 });
  drawPreviewFromSource(digitalPreviewCtx, digitalPreviewCanvas, digitalCanvas);

  print4LayoutMeta = renderPrintSheet(print4Ctx, print4Canvas, "4x6");
  print5LayoutMeta = renderPrintSheet(print5Ctx, print5Canvas, "5x7");

  drawPreviewFromSource(print4PreviewCtx, print4PreviewCanvas, print4Canvas);
  drawPreviewFromSource(print5PreviewCtx, print5PreviewCanvas, print5Canvas);

  setActionEnabled(true);
  updateLayoutMeta();
}

function resetTransform() {
  state.scaleMultiplier = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  scaleInput.value = String(state.scaleMultiplier);
}

function handleUpload(file) {
  if (!file || !file.type.startsWith("image/")) {
    window.alert("Please upload a valid image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.sourceImage = img;
      resetTransform();
      renderAll();
    };
    img.onerror = () => {
      window.alert("Could not decode image. Please try another file.");
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

function downloadCanvasAsJpeg(canvas, filename, quality = 0.92) {
  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, "image/jpeg", quality);
}

uploadInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  handleUpload(file);
});

scaleInput.addEventListener("input", () => {
  state.scaleMultiplier = clamp(Number(scaleInput.value), MIN_SCALE, MAX_SCALE);
  renderAll();
});

dpiInput.addEventListener("change", () => {
  const value = clamp(Number(dpiInput.value) || DEFAULT_DPI, MIN_DPI, MAX_DPI);
  state.dpi = value;
  dpiInput.value = String(value);
  renderAll();
});

resetBtn.addEventListener("click", () => {
  if (!state.sourceImage) {
    return;
  }
  resetTransform();
  renderAll();
});

function attachEditorInteractions(canvas) {
  canvas.addEventListener("pointerdown", (event) => {
    if (!state.sourceImage) {
      return;
    }
    state.dragging = true;
    state.dragPointerId = event.pointerId;
    state.lastDragClientX = event.clientX;
    state.lastDragClientY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging || state.dragPointerId !== event.pointerId || !state.sourceImage) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dxPx = event.clientX - state.lastDragClientX;
    const dyPx = event.clientY - state.lastDragClientY;

    const scaleToDigitalX = DIGITAL_W / rect.width;
    const scaleToDigitalY = DIGITAL_H / rect.height;

    state.offsetX += dxPx * scaleToDigitalX;
    state.offsetY += dyPx * scaleToDigitalY;

    state.lastDragClientX = event.clientX;
    state.lastDragClientY = event.clientY;

    renderAll();
  });

  function stopDragging(event) {
    if (!state.dragging || state.dragPointerId !== event.pointerId) {
      return;
    }
    state.dragging = false;
    canvas.classList.remove("dragging");
    canvas.releasePointerCapture(event.pointerId);
  }

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!state.sourceImage) {
        return;
      }
      event.preventDefault();
      const step = event.deltaY > 0 ? -0.04 : 0.04;
      state.scaleMultiplier = clamp(state.scaleMultiplier + step, MIN_SCALE, MAX_SCALE);
      scaleInput.value = String(state.scaleMultiplier);
      renderAll();
    },
    { passive: false }
  );
}

attachEditorInteractions(editorBaseCanvas);
attachEditorInteractions(editorGuideCanvas);

downloadDigitalBtn.addEventListener("click", () => {
  if (!state.sourceImage) {
    return;
  }
  drawCompositedPhoto(digitalCtx, DIGITAL_W, DIGITAL_H, { referenceMode: "none", imageAlpha: 1 });
  downloadCanvasAsJpeg(digitalCanvas, "photo-digital-387x516.jpg");
});

download4x6Btn.addEventListener("click", () => {
  if (!state.sourceImage) {
    return;
  }
  renderPrintSheet(print4Ctx, print4Canvas, "4x6");
  downloadCanvasAsJpeg(print4Canvas, `photo-print-4x6-${state.dpi}dpi.jpg`);
});

download5x7Btn.addEventListener("click", () => {
  if (!state.sourceImage) {
    return;
  }
  renderPrintSheet(print5Ctx, print5Canvas, "5x7");
  downloadCanvasAsJpeg(print5Canvas, `photo-print-5x7-${state.dpi}dpi.jpg`);
});

async function init() {
  try {
    const [base, guide] = await Promise.all([
      loadImage("assets/references.png", { required: false }),
      loadImage("assets/reference-chinese-photo-guide.svg", { required: false })
    ]);
    state.referenceBaseImage = base;
    state.referenceGuideImage = guide;
  } catch (error) {
    console.error(error);
  }

  state.dpi = DEFAULT_DPI;
  renderAll();
}

init();
