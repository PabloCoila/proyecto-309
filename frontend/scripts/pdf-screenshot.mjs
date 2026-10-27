/**
 * Captura el PDF en el visor de Edge (headful: el visor PDF no existe en headless).
 * Uso: node scripts/pdf-screenshot.mjs [archivo.pdf] [salida.png]
 */
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const input = resolve(process.argv[2] ?? '../docs/factura-ejemplo.pdf');
const output = resolve(process.argv[3] ?? '../docs/ui/pdf-preview.png');

const browser = await chromium.launch({
  executablePath:
    process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: false,
});
const page = await browser.newPage({ viewport: { width: 900, height: 1273 } });
await page.goto(pathToFileURL(input).href + '#toolbar=0&navpanes=0&view=FitH');
await page.waitForTimeout(3000);
await page.screenshot({ path: output });
await browser.close();
console.log(`Captura: ${output}`);
