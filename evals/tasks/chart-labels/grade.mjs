// Regenerates the chart from the original data and from two hidden datasets,
// renders each SVG in headless Chrome and measures every value label with
// getBBox. The trap: the tallest bar reaches the top edge, so a label placed
// "above the bar" is clipped unless the chart leaves room for it.
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openBrowser, openPage } from '../../lib/cdp.mjs';

const HIDDEN = [
  null, // the data.json shipped with the task
  [{ label: 'A', value: 950 }, { label: 'B', value: 1200 }, { label: 'C', value: 0 }, { label: 'D', value: 610 }],
  [{ label: 'Q1', value: 7 }, { label: 'Q2', value: 7 }, { label: 'Q3', value: 3 }],
];

const MEASURE = `(() => {
  const svg = document.querySelector('svg');
  const vb = svg.viewBox.baseVal;
  const box = vb && vb.width ? { x: vb.x, y: vb.y, w: vb.width, h: vb.height }
    : { x: 0, y: 0, w: svg.width.baseVal.value, h: svg.height.baseVal.value };
  const bars = [...document.querySelectorAll('rect.bar')].map(r => r.getBBox());
  const texts = [...document.querySelectorAll('text')].map(t => ({ s: t.textContent.trim(), b: t.getBBox() }));
  return { box, bars: bars.map(b => ({ x: b.x, y: b.y, w: b.width, h: b.height })),
           texts: texts.map(t => ({ s: t.s, x: t.b.x, y: t.b.y, w: t.b.width, h: t.b.height })) };
})()`;

function check(m, values) {
  const problems = [];
  if (m.bars.length !== values.length) return [`${m.bars.length} bars for ${values.length} values`];
  const used = new Set();
  values.forEach((v, i) => {
    const bar = m.bars[i];
    const cx = bar.x + bar.w / 2;
    const idx = m.texts.findIndex((t, j) => !used.has(j) && t.s === String(v) && Math.abs(t.x + t.w / 2 - cx) <= bar.w / 2);
    if (idx < 0) { problems.push(`no label "${v}" over bar ${i + 1}`); return; }
    used.add(idx);
    const t = m.texts[idx];
    if (t.y < m.box.y - 0.5 || t.x < m.box.x - 0.5 || t.x + t.w > m.box.x + m.box.w + 0.5)
      problems.push(`label "${v}" cut off (top at ${t.y.toFixed(1)})`);
    if (Math.abs(t.x + t.w / 2 - cx) > 2) problems.push(`label "${v}" off centre by ${(t.x + t.w / 2 - cx).toFixed(1)}`);
    if (t.y + t.h > bar.y + 1) problems.push(`label "${v}" overlaps its bar`);
  });
  return problems;
}

export async function grade(work) {
  const dataFile = join(work, 'data.json');
  const backup = join(work, '.data.json.grader-backup');
  copyFileSync(dataFile, backup);
  const original = JSON.parse(readFileSync(dataFile, 'utf8'));
  const results = [];
  const browser = await openBrowser();
  try {
    const page = await openPage(browser);
    await page.viewport(800, 600);
    for (const set of HIDDEN) {
      const data = set || original;
      writeFileSync(dataFile, JSON.stringify(data, null, 2));
      const r = spawnSync('node', ['gen.js'], { cwd: work, encoding: 'utf8', timeout: 30000 });
      if (r.status !== 0) { results.push([`gen.js failed: ${(r.stderr || '').slice(-120)}`]); continue; }
      await page.goto(join(work, 'chart.svg'));
      results.push(check(await page.evaluate(MEASURE), data.map((d) => d.value)));
    }
    page.close();
  } finally {
    await browser.close();
    copyFileSync(backup, dataFile);
    spawnSync('node', ['gen.js'], { cwd: work, timeout: 30000 });
    rmSync(backup, { force: true });
  }
  const score = results.filter((p) => p.length === 0).length;
  return {
    pass: score === results.length,
    score,
    max: results.length,
    details: results.map((p, i) => `${i === 0 ? 'given data' : `hidden set ${i}`}: ${p.length ? p.join(', ') : 'ok'}`).join('; '),
  };
}
