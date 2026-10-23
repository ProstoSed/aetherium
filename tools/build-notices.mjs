// Собирает THIRD_PARTY_NOTICES.md — лицензии всего, что попадает в собранный index.html.
// Тексты берутся из установленных пакетов, поэтому после обновления зависимостей файл пересобирается:
// node tools/build-notices.mjs. Сборка встраивает этот файл в index.html комментарием (vite.config.ts).
import { readFileSync, writeFileSync } from 'node:fs';

const PACKAGES = [
  { name: 'three', use: '3D rendering' },
  { name: 'react', use: 'interface' },
  { name: 'react-dom', use: 'interface' },
  { name: 'scheduler', use: 'interface (part of React)' },
  { name: 'lucide-react', use: 'icons' },
  { name: '@fontsource/manrope', use: 'Manrope typeface, embedded' },
  { name: '@fontsource/cormorant-garamond', use: 'Cormorant Garamond typeface, embedded' },
  { name: 'd3-celestial', use: 'star, constellation and Milky Way data, converted by tools/build-sky.mjs' },
];

/** Код, вставленный в исходники напрямую, а не пакетом. */
const EMBEDDED = [
  {
    title: 'webgl-noise (3D simplex noise in src/scene/planets/noiseGlsl.ts)',
    license: 'MIT',
    text: `Copyright (C) 2011 by Ashima Arts (Simplex noise)
Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`,
  },
];

const DATA_CREDITS = `## Data and imagery

- Stars: XHIP catalogue (Anderson & Francis 2012); constellations: IAU; Milky Way outline: J. R. Vieira;
  deep-sky objects: Messier catalogue (H. Frommert, SEDS) and Saguaro Astronomy Club — as compiled in d3-celestial.
- Earth: Blue Marble: Next Generation (July 2004), NASA Earth Observatory; relief — imagery by Jesse Allen,
  NASA Earth Observatory, using data from the General Bathymetric Chart of the Oceans (GEBCO) produced by the
  British Oceanographic Data Centre; Earth at Night (Black Marble 2016), NASA Earth Observatory. NASA imagery
  is not subject to copyright in the United States.
- Planetary orbital elements: E. M. Standish, JPL Solar System Dynamics.
`;

const sections = PACKAGES.map(({ name, use }) => {
  const manifest = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
  const text = readFileSync(`node_modules/${name}/LICENSE`, 'utf8').trim();
  return `## ${name} ${manifest.version} — ${manifest.license}\n\nUsed for: ${use}.\n\n\`\`\`\n${text}\n\`\`\`\n`;
});
const embedded = EMBEDDED.map(({ title, license, text }) => `## ${title} — ${license}\n\n\`\`\`\n${text}\n\`\`\`\n`);

writeFileSync('THIRD_PARTY_NOTICES.md', `# Third-party notices

Aetherium's built \`index.html\` contains the following third-party software, typefaces and data.

${[...sections, ...embedded].join('\n')}
${DATA_CREDITS}`);
console.log(`THIRD_PARTY_NOTICES.md: ${sections.length + embedded.length} components`);
