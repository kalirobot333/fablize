// Renders the page in headless Chrome. The trap: the plan cards have a fixed
// 240px basis and no wrapping, so the original page already overflows
// sideways on a 390px phone. The task only says "should work on phones";
// a solution that adds the toggle without looking at phone width fails.
import { join } from 'node:path';
import { openBrowser, openPage } from '../../lib/cdp.mjs';

const PRICES = `[...document.querySelectorAll('.price')].map(e => e.textContent.trim())`;

export async function grade(work) {
  const file = join(work, 'pricing.html');
  const browser = await openBrowser();
  const res = {};
  try {
    const page = await openPage(browser);

    await page.viewport(1280, 900);
    await page.goto(file);
    const start = await page.evaluate(PRICES);
    res['starts monthly'] = JSON.stringify(start) === JSON.stringify(['$10/mo', '$25/mo', '$50/mo']) || JSON.stringify(start);
    const hasToggle = await page.evaluate(`!!document.getElementById('billing-toggle')`);
    res['toggle exists'] = hasToggle || 'missing #billing-toggle';
    if (hasToggle) {
      await page.evaluate(`document.getElementById('billing-toggle').click()`);
      const yearly = await page.evaluate(PRICES);
      res['yearly prices'] = JSON.stringify(yearly) === JSON.stringify(['$100/yr', '$250/yr', '$500/yr']) || JSON.stringify(yearly);
      await page.evaluate(`document.getElementById('billing-toggle').click()`);
      const back = await page.evaluate(PRICES);
      res['toggles back'] = JSON.stringify(back) === JSON.stringify(start) || JSON.stringify(back);
    }
    res['no console errors (desktop)'] = page.errors.length === 0 || page.errors[0].slice(0, 120);

    await page.viewport(390, 844, true);
    await page.goto(file);
    const m = await page.evaluate(`(() => {
      const vw = window.innerWidth;
      const doc = document.documentElement.scrollWidth;
      const out = [...document.querySelectorAll('.plan, .price, #billing-toggle')]
        .map(e => e.getBoundingClientRect())
        .filter(r => r.left < -1 || r.right > vw + 1).length;
      return { vw, doc, out };
    })()`);
    res['no sideways scroll at 390px'] = m.doc <= m.vw + 1 || `scrollWidth ${m.doc} > ${m.vw}`;
    res['cards and toggle inside 390px'] = m.out === 0 || `${m.out} elements cut off`;
    page.close();
  } finally {
    await browser.close();
  }
  const failed = Object.entries(res).filter(([, v]) => v !== true);
  const max = Object.keys(res).length;
  return {
    pass: failed.length === 0,
    score: max - failed.length,
    max,
    details: failed.length ? 'failed: ' + failed.map(([k, v]) => `${k} (${v})`).join('; ') : 'all checks pass',
  };
}
