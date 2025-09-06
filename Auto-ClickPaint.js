(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const SELECTORS = {
    paintBtn: 'button[aria-label="Paint"]',
    canvas: 'canvas',
    colorBtn: id => `button[data-color="${id}"]`,
    charges: 'button[aria-label="Paint"] span.charges'
  };

  const click = el => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  const getCharges = () => {
    const el = document.querySelector(SELECTORS.charges);
    if (!el) return 0;
    const match = el.textContent.trim().match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const getPaletteMap = () => {
    const map = new Map();
    document.querySelectorAll('button[data-color]').forEach(btn => {
      const rgb = getComputedStyle(btn).backgroundColor.match(/\d+/g).slice(0, 3).join(',');
      map.set(rgb, btn.dataset.color);
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
    const baseX = overlay.startCoords.region.x * tileSize + overlay.startCoords.pixel.x;
    const baseY = overlay.startCoords.region.y * tileSize + overlay.startCoords.pixel.y;

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

  const paintPixel = async ({ x, y, color }) => {
    const btn = document.querySelector(SELECTORS.paintBtn);
    if (!btn) throw new Error('Paint button not found');
    click(btn);
    await sleep(50);

    const canvas = document.querySelector(SELECTORS.canvas);
    if (!canvas) throw new Error('Canvas not found');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent('click', {
        clientX: rect.left + x,
        clientY: rect.top + y,
        bubbles: true
      })
    );
    await sleep(50);

    const colorBtn = document.querySelector(SELECTORS.colorBtn(color));
    if (!colorBtn) throw new Error('Color button not found');
    click(colorBtn);
    await sleep(50);
  };

  const run = async queue => {
    const tasks = Array.from(queue);
    while (tasks.length) {
      let charges = getCharges();
      if (charges === 0) {
        const btn = document.querySelector(SELECTORS.paintBtn);
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

