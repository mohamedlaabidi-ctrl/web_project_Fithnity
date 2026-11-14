import { writeFile } from 'node:fs/promises';

const apiUrl = process.env.API_URL || 'http://localhost:3000/api';
await writeFile(
  new URL('../public/config.js', import.meta.url),
  `window.__THNIYTI_API_URL__ = ${JSON.stringify(apiUrl)};\n`,
);
