"use strict";

function pixelPolygon(context, points, color, mirror = false) {
  context.fillStyle = color;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) {
        context.fillRect(x, y, 1, 1);
        if (mirror) context.fillRect(63 - x, y, 1, 1);
      }
    }
  }
}

function drawCopperwing(context, pigments, remaining) {
  const shape = (points, color, mirror) => pixelPolygon(context, points, color, mirror);
  context.fillStyle = "#101923";
  context.fillRect(0, 0, 64, 64);
  shape([[6,12],[16,5],[48,5],[58,12],[58,40],[50,51],[32,60],[14,51],[6,40]], "#9f634a");
  shape([[8,14],[17,7],[47,7],[56,14],[56,39],[49,49],[32,58],[15,49],[8,39]], "#263d53");
  shape([[10,15],[17,9],[47,9],[54,15],[54,38],[47,48],[32,56],[17,48],[10,38]], "#182938");
  shape([[10,13],[15,11],[17,16],[15,23],[12,20],[14,27],[11,29]], "#3f886b", true);
  shape([[15,45],[20,42],[22,47],[27,46],[29,53],[19,49]], "#3f886b", true);
  shape([[32,31],[26,18],[17,11],[15,14],[15,23],[18,32],[26,37]], "#593d55", true);
  shape([[31,32],[25,20],[17,14],[17,22],[19,29],[24,34],[28,33]], "#b76355", true);
  shape([[29,31],[22,18],[18,17],[19,24],[25,31]], "#ee9f6d", true);
  shape([[27,29],[23,22],[21,20],[22,26]], "#f6d092", true);
  shape([[31,30],[25,34],[20,38],[18,45],[23,48],[28,45],[32,38]], "#57405d", true);
  shape([[31,33],[24,36],[21,42],[24,45],[29,43],[31,38]], "#bc6d65", true);
  shape([[29,36],[24,39],[24,42],[28,40]], "#f0b072", true);
  shape([[29,28],[32,25],[35,28],[34,39],[32,44],[30,39]], "#e3ac78");
  shape([[31,29],[33,29],[33,37],[32,40],[31,37]], "#fbdfad");
  shape([[31,26],[29,22],[27,21],[27,19],[30,20],[32,25]], "#d1ac88", true);
  for (const [x, y] of [[22,9],[32,12],[41,10],[12,33],[51,35],[29,49],[36,50]]) {
    context.fillStyle = "#e7c897";
    context.fillRect(x, y, 1, 1);
  }
  for (const [key, pigment] of Object.entries(pigments)) {
    const paid = pigment.patches.length - remaining[key];
    pigment.patches.forEach(([x, y], index) => {
      context.fillStyle = index < paid ? pigment.color : "#1e2332";
      context.fillRect(x, y, 4, 4);
      if (index >= paid) {
        context.fillStyle = "#38445a";
        context.fillRect(x + 1, y + 1, 2, 2);
      }
    });
  }
}

function drawPlayableMural(context, mural, pigments, filledPixels, selectedPixel = null, showGuide = true) {
  const { width, height } = context.canvas;
  const size = mural.gridSize;
  const empty = "#101923";
  const xEdge = x => Math.round(x * width / size);
  const yEdge = y => Math.round(y * height / size);
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = mural.backing ?? empty;
  context.fillRect(0, 0, width, height);
  for (const [target, pixels] of Object.entries(mural.needs)) {
    for (const [x, y] of pixels) {
      const placed = filledPixels[y * size + x];
      if (!placed && !showGuide) continue;
      const x0 = xEdge(x), y0 = yEdge(y);
      const w = xEdge(x + 1) - x0, h = yEdge(y + 1) - y0;
      if (!placed) {
        // Original playing board: target ink at 35 percent on dark slate.
        context.fillStyle = empty;
        context.fillRect(x0, y0, w, h);
        context.globalAlpha = 0.35;
      }
      context.fillStyle = pigments[placed ?? target].color;
      context.fillRect(x0, y0, w, h);
      context.globalAlpha = 1;
    }
  }
  if (Number.isInteger(selectedPixel) && selectedPixel >= 0 && selectedPixel < size * size) {
    const x = selectedPixel % size, y = Math.floor(selectedPixel / size);
    const x0 = xEdge(x), y0 = yEdge(y);
    const w = xEdge(x + 1) - x0, h = yEdge(y + 1) - y0;
    const line = Math.max(1, Math.floor(Math.min(w, h) / 8));
    context.strokeStyle = "#fff2ba";
    context.lineWidth = line;
    context.strokeRect(x0 + line / 2, y0 + line / 2, w - line, h - line);
    if (Math.min(w, h) > line * 3) {
      context.strokeStyle = "#292530";
      context.strokeRect(x0 + 1.5 * line, y0 + 1.5 * line, w - line * 3, h - line * 3);
    }
  }
  context.restore();
}
