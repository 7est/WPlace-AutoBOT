(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Dynamic selectors for current UI structure
  const SELECTORS = {
    // Find the first button whose text contains "Paint"
    paintBtn: () => Array.from(document.querySelectorAll('button')).find(b => /Paint/i.test(b.textContent)),
    // Board canvas is the largest canvas element on the page
    canvas: () =>
      Array.from(document.querySelectorAll('canvas')).sort(
        (a, b) => b.width * b.height - a.width * a.height
      )[0],
    // Palette color buttons use id="color-N"
    colorBtn: id => document.getElementById(`color-${id}`)
  };

  const click = el => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  const getCharges = () => {
    const btn = SELECTORS.paintBtn();
    if (!btn) return 0;
    const match = btn.textContent.match(/\((\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const getPaletteMap = () => {
    const map = new Map();
    document.querySelectorAll('button[id^="color-"]').forEach(btn => {
      const rgb = getComputedStyle(btn).backgroundColor
        .match(/\d+/g)
        .slice(0, 3)
        .join(',');
      map.set(rgb, btn.id.replace('color-', ''));
    });
    return map;
  };

  const buildQueueFromOverlay = async () => {
    const overlay = window.overlayManager;
    if (!overlay || !overlay.imageBitmap || !overlay.startCoords) {
      throw new Error('Overlay is not ready');
    }

    const palette = getPaletteMap();
    const { width, height } = overlay.imageBitmap;

    let canvas, ctx;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
    }
    ctx.drawImage(overlay.imageBitmap, 0, 0);

    const { data } = ctx.getImageData(0, 0, width, height);

    const tileSize = overlay.tileSize || 1000;
    const baseX =
      overlay.startCoords.region.x * tileSize + overlay.startCoords.pixel.x;
    const baseY =
      overlay.startCoords.region.y * tileSize + overlay.startCoords.pixel.y;

    window.__overlayBase = { x: baseX, y: baseY };

    const tasks = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a === 0) continue;
        const key = `${data[idx]},${data[idx + 1]},${data[idx + 2]}`;
        const color = palette.get(key);
        if (!color) continue;
        tasks.push({ x: baseX + x, y: baseY + y, color });
      }
    }

    return tasks;
  };

  const ensurePaintUI = async () => {
    if (!document.getElementById('color-1')) {
      const btn = SELECTORS.paintBtn();
      if (!btn) throw new Error('Paint button not found');
      click(btn);
      await sleep(100);
    }
  };

  const paintPixel = async ({ x, y, color }) => {
    await ensurePaintUI();

    const canvas = SELECTORS.canvas();
    if (!canvas) throw new Error('Canvas not found');
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const base = window.__overlayBase || { x: 0, y: 0 };
    const offsetX = (x - base.x) * scaleX;
    const offsetY = (y - base.y) * scaleY;

    canvas.dispatchEvent(
      new MouseEvent('click', {
        clientX: rect.left + offsetX,
        clientY: rect.top + offsetY,
        bubbles: true
      })
    );
    await sleep(50);

    const colorBtn = SELECTORS.colorBtn(color);
    if (!colorBtn) throw new Error('Color button not found');
    click(colorBtn);
    await sleep(50);

    const confirm = SELECTORS.paintBtn();
    click(confirm);
    await sleep(50);
  };

  const run = async queue => {
    const tasks = Array.from(queue);
    while (tasks.length) {
      let charges = getCharges();
      if (charges === 0) {
        const btn = SELECTORS.paintBtn();
        if (btn) click(btn);
        while ((charges = getCharges()) === 0) {
          await sleep(1000);
        }
      }
      const task = tasks.shift();
      await paintPixel(task);
    }
  };

  const start = async queue => {
    const tasks = queue && queue.length ? queue : await buildQueueFromOverlay();
    await run(tasks);
  };

  window.AutoClickPaint = {
    start,
    run,
    buildQueueFromOverlay
  };
})();

