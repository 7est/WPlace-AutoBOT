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

  const run = async (queue) => {
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

  window.AutoClickPaint = {
    start: run
  };
})();

