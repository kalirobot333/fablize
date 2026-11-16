// Writes chart.svg from data.json. Run: node gen.js
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

const W = 480;
const H = 240;
const AXIS = 24; // space for day names at the bottom
const GAP = 16;
const barW = (W - GAP * (data.length + 1)) / data.length;
const max = Math.max(...data.map((d) => d.value));
const scale = (H - AXIS) / max;

const parts = [];
data.forEach((d, i) => {
  const x = GAP + i * (barW + GAP);
  const h = d.value * scale;
  const y = H - AXIS - h;
  parts.push(`<rect class="bar" x="${x}" y="${y}" width="${barW}" height="${h}" fill="#4c6ef5"/>`);
  parts.push(`<text class="axis" x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#555">${d.label}</text>`);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif">
<rect width="${W}" height="${H}" fill="#fff"/>
${parts.join('\n')}
</svg>
`;
fs.writeFileSync(path.join(__dirname, 'chart.svg'), svg);
console.log(`wrote chart.svg (${data.length} bars)`);
