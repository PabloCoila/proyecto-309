/**
 * E2E real: navegador contra la app y contra Odoo (sin mocks).
 * Requiere: Odoo en :8069 con la base proyecto309, plan contable BO y
 * productos KB-309/MON-27/CAB-2M; dev server de Vite en :5173.
 *
 * Uso: node scripts/e2e-real.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const ODOO = process.env.ODOO_URL ?? 'http://localhost:8069';
const DB = process.env.ODOO_DB ?? 'proyecto309';
const USER = process.env.ODOO_USER ?? 'admin';
const PASSWORD = process.env.ODOO_PASSWORD ?? 'admin';
const EDGE =
  process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = resolve('../docs/real');
mkdirSync(OUT, { recursive: true });

async function rpc(service, method, args) {
  const response = await fetch(`${ODOO}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params: { service, method, args } }),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(JSON.stringify(payload.error));
  return payload.result;
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

async function dismissToasts() {
  const buttons = page.getByRole('button', { name: 'Descartar' });
  for (let guard = 0; guard < 4; guard += 1) {
    if ((await buttons.count()) === 0) return;
    await buttons.first().click().catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function shot(name) {
  await dismissToasts();
  await page.screenshot({ path: resolve(OUT, name) });
}

try {
  // 1. Login real contra Odoo
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByText(/servidor local activo/).waitFor({ timeout: 15000 });
  await shot('01-login.png');

  await page.getByRole('button', { name: /Entrar a Proyecto 309/ }).click();
  await page.waitForURL('**/inventario');
  await page.getByText(/Teclado mec/).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);

  // 2. Ajuste de stock desde la app (entrada al almacén)
  await page.getByRole('button', { name: /Ajustar stock de Teclado mec/ }).click();
  await page.getByRole('heading', { name: 'Ajuste de inventario' }).waitFor();
  await page.getByLabel('Nueva cantidad').fill('12');
  await page.getByRole('button', { name: 'Guardar ajuste' }).click();
  await page.getByText('Stock actualizado').waitFor({ timeout: 20000 });
  await page.getByRole('heading', { name: 'Ajuste de inventario' }).waitFor({ state: 'detached' });
  await page.waitForTimeout(800);
  await shot('02-inventario.png');

  // 3. Alta de cliente desde la app
  await page.getByRole('link', { name: /Clientes/ }).click();
  await page.waitForURL('**/clientes');
  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
  await page.getByRole('heading', { name: 'Nuevo cliente' }).waitFor();
  await page.getByLabel('Nombre *').fill('Cliente Demo 309');
  await page.getByLabel('Email').fill('demo@proyecto309.local');
  await page.getByLabel('Teléfono').fill('+591 700 30900');
  await page.getByLabel('NIT / CI').fill('900309001');
  await page.getByLabel('Ciudad').fill('La Paz');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  await page.getByText('Cliente creado').waitFor({ timeout: 20000 });
  await page.getByText('Cliente Demo 309').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  await shot('03-clientes.png');

  // 4. Venta: producto + cliente + emisión en Odoo
  await page.getByRole('link', { name: /Facturación/ }).click();
  await page.waitForURL('**/ventas');
  await page.getByRole('button', { name: /Teclado mec/ }).first().click();
  await page.getByRole('button', { name: /Monitor 27/ }).first().click();
  await dismissToasts();
  await page.getByRole('button', { name: /Seleccionar cliente/ }).click();
  await page.getByRole('button', { name: /Cliente Demo 309/ }).click();
  await page.waitForTimeout(400);
  await shot('04-venta.png');

  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: /Emitir factura/ }).click();
  await page.getByText('Factura emitida').waitFor({ timeout: 30000 });
  const invoiceName = (await page.locator('aside').getByText(/^INV\//).first().textContent())?.trim();
  await page.waitForTimeout(600);
  await shot('05-factura.png');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Descargar factura PDF/ }).click(),
  ]);
  const pdfPath = resolve('../docs/factura-real.pdf');
  await download.saveAs(pdfPath);

  // 5. Verificación directa en Odoo
  const uid = await rpc('common', 'login', [DB, USER, PASSWORD]);
  const [invoice] = await rpc('object', 'execute_kw', [
    DB,
    uid,
    PASSWORD,
    'account.move',
    'search_read',
    [[['move_type', '=', 'out_invoice'], ['name', '=', invoiceName]]],
    { fields: ['name', 'state', 'amount_untaxed', 'amount_tax', 'amount_total', 'partner_id', 'invoice_date'], limit: 1 },
  ]);
  const quants = await rpc('object', 'execute_kw', [
    DB,
    uid,
    PASSWORD,
    'stock.quant',
    'search_read',
    [[['product_id.default_code', '=', 'KB-309'], ['location_id.usage', '=', 'internal']]],
    { fields: ['quantity', 'location_id'] },
  ]);
  const [partner] = await rpc('object', 'execute_kw', [
    DB,
    uid,
    PASSWORD,
    'res.partner',
    'search_read',
    [[['name', '=', 'Cliente Demo 309']]],
    { fields: ['name', 'vat', 'email', 'sale_order_count'], limit: 1 },
  ]);

  const report = {
    invoice,
    stockKB309: quants.reduce((total, quant) => total + quant.quantity, 0),
    partner,
    pdf: pdfPath,
    invoiceName,
    consoleErrors,
  };
  writeFileSync(resolve(OUT, 'result.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(JSON.stringify(report, null, 2));

  if (!invoice || invoice.state !== 'posted') throw new Error('La factura no quedó publicada en Odoo');
  if (report.stockKB309 !== 12) throw new Error(`Stock inesperado: ${report.stockKB309}`);
  if (consoleErrors.length > 0) throw new Error(`Errores de consola: ${consoleErrors.join(' | ')}`);
  console.log('E2E REAL OK');
} catch (error) {
  await dismissToasts().catch(() => {});
  await page.screenshot({ path: resolve(OUT, '99-error.png') }).catch(() => {});
  console.error('E2E FALLÓ:', error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
