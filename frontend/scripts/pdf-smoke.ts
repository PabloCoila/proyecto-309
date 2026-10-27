/**
 * Smoke test del generador PDF (se ejecuta en Node, sin navegador).
 * Uso: npx esbuild scripts/pdf-smoke.ts --bundle --platform=node --format=esm --outfile=.tmp/pdf-smoke.mjs && node .tmp/pdf-smoke.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildInvoicePdf, sampleInvoiceData } from '../src/lib/pdf';

const output = resolve(process.argv[2] ?? '../docs/factura-ejemplo.pdf');
mkdirSync(dirname(output), { recursive: true });

const sample = sampleInvoiceData('BOB');
const doc = buildInvoicePdf(sample);
const buffer = Buffer.from(doc.output('arraybuffer'));
writeFileSync(output, buffer);

console.log(`PDF: ${output}`);
console.log(`Bytes: ${buffer.byteLength} · Páginas: ${doc.getNumberOfPages()}`);

// Paginación: 70 líneas deben repartirse en varias páginas sin romper cabeceras.
const long = {
  ...sample,
  number: 'INV/2026/00070',
  lines: Array.from({ length: 70 }, (_, index) => ({
    name: `Producto de prueba ${index + 1} con descripción extendida para validar el salto de página`,
    quantity: index + 1,
    unitPrice: 12.5,
    subtotal: 12.5 * (index + 1),
  })),
  subtotal: 7000,
  tax: 910,
  total: 7910,
};

const paginated = buildInvoicePdf(long);
const paginatedBytes = Buffer.from(paginated.output('arraybuffer'));
writeFileSync(resolve('.tmp/paginacion-test.pdf'), paginatedBytes);
console.log(`Paginación: ${paginated.getNumberOfPages()} páginas · ${paginatedBytes.byteLength} bytes`);
