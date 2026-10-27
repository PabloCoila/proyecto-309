/**
 * Smoke test de UI (sin Odoo): intercepta JSON-RPC con datos de ejemplo,
 * recorre login → inventario → clientes → venta → PDF y guarda capturas.
 *
 * Uso: node scripts/ui-smoke.mjs
 * Requiere: npm run dev -- --port 5183 (o BASE_URL apuntando al dev server).
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5183';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = resolve('../docs/ui');
mkdirSync(OUT, { recursive: true });

const products = [
  { id: 11, name: 'Teclado mecánico Pro 309', default_code: 'KB-309', barcode: false, qty_available: 24, free_qty: 20, virtual_available: 24, uom_id: [1, 'Unidades'], categ_id: [1, 'Periféricos'], list_price: 420, standard_price: 260, detailed_type: 'product', type: 'product' },
  { id: 12, name: 'Monitor 27" 165 Hz', default_code: 'MON-27', barcode: '7891234567890', qty_available: 8, free_qty: 6, virtual_available: 8, uom_id: [1, 'Unidades'], categ_id: [1, 'Periféricos'], list_price: 2150, standard_price: 1500, detailed_type: 'product', type: 'product' },
  { id: 13, name: 'Cable USB-C trenzado 2 m', default_code: 'CAB-2M', barcode: false, qty_available: 120, free_qty: 120, virtual_available: 120, uom_id: [1, 'Unidades'], categ_id: [2, 'Accesorios'], list_price: 85, standard_price: 40, detailed_type: 'product', type: 'product' },
  { id: 14, name: 'Mouse inalámbrico silencioso', default_code: 'MOU-01', barcode: false, qty_available: 0, free_qty: 0, virtual_available: 0, uom_id: [1, 'Unidades'], categ_id: [1, 'Periféricos'], list_price: 190, standard_price: 95, detailed_type: 'product', type: 'product' },
  { id: 15, name: 'Dock USB-C 12 en 1', default_code: 'DCK-12', barcode: false, qty_available: 5, free_qty: 5, virtual_available: 5, uom_id: [1, 'Unidades'], categ_id: [2, 'Accesorios'], list_price: 780, standard_price: 520, detailed_type: 'product', type: 'product' },
  { id: 16, name: 'Servicio de instalación', default_code: 'SRV-INS', barcode: false, qty_available: 0, free_qty: 0, virtual_available: 0, uom_id: [1, 'Unidades'], categ_id: [3, 'Servicios'], list_price: 150, standard_price: 0, detailed_type: 'service', type: 'service' },
];

const locations = [
  { id: 1, complete_name: 'WH/Stock', usage: 'internal', location_id: [4, 'WH'], warehouse_id: [1, 'WH'] },
  { id: 2, complete_name: 'WH/Input', usage: 'internal', location_id: [4, 'WH'], warehouse_id: [1, 'WH'] },
  { id: 3, complete_name: 'WH/Output', usage: 'internal', location_id: [4, 'WH'], warehouse_id: [1, 'WH'] },
];

const partners = [
  { id: 1, name: 'Comercial Andina S.R.L.', email: 'compras@andina.example', phone: '+591 712 34567', mobile: false, vat: '1023456789', street: 'Av. 6 de Agosto #309', city: 'La Paz', country_id: [1, 'Bolivia'], customer_rank: 1, sale_order_count: 14, is_company: true },
  { id: 2, name: 'Estudio Norte', email: 'hola@estudionorte.example', phone: '+591 700 11122', mobile: false, vat: '9876543', street: 'Calle 21 #45', city: 'Santa Cruz', country_id: [1, 'Bolivia'], customer_rank: 1, sale_order_count: 9, is_company: true },
  { id: 3, name: 'María Fernanda Quispe', email: 'mafer@example.com', phone: '+591 705 44332', mobile: false, vat: '6543210', street: 'Zona Sur, Calle 8', city: 'La Paz', country_id: [1, 'Bolivia'], customer_rank: 1, sale_order_count: 7, is_company: false },
  { id: 4, name: 'Tecnología del Sur', email: 'ventas@tdelsur.example', phone: '+591 733 88990', mobile: false, vat: '5566778', street: 'Av. Monseñor Rivero', city: 'Santa Cruz', country_id: [1, 'Bolivia'], customer_rank: 1, sale_order_count: 5, is_company: true },
  { id: 5, name: 'Distribuidora Illimani', email: 'contacto@illimani.example', phone: '+591 719 22663', mobile: false, vat: '3344556', street: 'El Alto, Av. Juan Pablo II', city: 'El Alto', country_id: [1, 'Bolivia'], customer_rank: 1, sale_order_count: 3, is_company: true },
];

const recent = [
  { id: 91, name: 'INV/2026/00012', state: 'posted', amount_untaxed: 3245, amount_tax: 421.85, amount_total: 3666.85, invoice_date: '2026-10-26', partner_id: [1, 'Comercial Andina S.R.L.'], currency_id: [1, 'BOB'] },
  { id: 90, name: 'INV/2026/00011', state: 'posted', amount_untaxed: 2150, amount_tax: 279.5, amount_total: 2429.5, invoice_date: '2026-10-24', partner_id: [2, 'Estudio Norte'], currency_id: [1, 'BOB'] },
  { id: 89, name: 'INV/2026/00010', state: 'draft', amount_untaxed: 840, amount_tax: 109.2, amount_total: 949.2, invoice_date: '2026-10-23', partner_id: [3, 'María Fernanda Quispe'], currency_id: [1, 'BOB'] },
];

const user = { id: 7, name: 'WinterOS', login: 'admin', lang: 'es_ES', company_id: [1, 'Proyecto 309'] };
const company = { id: 1, name: 'Proyecto 309', currency_id: [1, 'BOB'] };

let created = null;

function termsFromDomain(domain = []) {
  return (Array.isArray(domain) ? domain : [])
    .filter((leaf) => Array.isArray(leaf) && leaf[1] === 'ilike')
    .map((leaf) => String(leaf[2]).toLowerCase());
}

function filterByTerms(rows, fields, domain) {
  const terms = termsFromDomain(domain);
  if (terms.length === 0) return rows;
  return rows.filter((row) => terms.some((term) => fields.some((field) => String(row[field] ?? '').toLowerCase().includes(term))));
}

function invoiceLines(invoiceId) {
  const lines = created?.id === invoiceId ? created.lines : [
    { id: 501, name: 'Monitor 27" 165 Hz', quantity: 1, price_unit: 2150, price_subtotal: 2150 },
    { id: 502, name: 'Teclado mecánico Pro 309', quantity: 2, price_unit: 420, price_subtotal: 840 },
    { id: 503, name: 'Cable USB-C trenzado 2 m', quantity: 3, price_unit: 85, price_subtotal: 255 },
  ];
  return lines;
}

function executeKw(model, method, args, kwargs) {
  switch (`${model}.${method}`) {
    case 'res.users.read':
      return [user];
    case 'res.company.search_read':
      return [{ id: 1 }];
    case 'res.company.read':
      return [company];
    case 'product.product.search_read': {
      const rows = filterByTerms(products, ['name', 'default_code', 'barcode'], kwargs?.domain);
      return rows.slice(0, kwargs?.limit ?? 80);
    }
    case 'product.product.search_count':
      return 6;
    case 'stock.location.search_read':
      return locations;
    case 'stock.location.search_count':
      return 3;
    case 'stock.quant.search_count':
      return 18;
    case 'stock.quant.search_read': {
      if (!Array.isArray(kwargs?.fields) || !kwargs.fields.includes('quantity')) return [];
      const productId = (kwargs.domain ?? []).find((leaf) => Array.isArray(leaf) && leaf[0] === 'product_id')?.[2];
      const product = products.find((row) => row.id === productId) ?? products[0];
      return [{ id: 700 + product.id, product_id: [product.id, product.name], location_id: [1, 'WH/Stock'], quantity: product.qty_available, reserved_quantity: 4 }];
    }
    case 'res.partner.search_read': {
      const rows = filterByTerms(partners, ['name', 'email', 'phone', 'vat'], kwargs?.domain);
      return rows.slice(0, kwargs?.limit ?? 100);
    }
    case 'res.partner.read': {
      const id = args?.[0]?.[0];
      const row = partners.find((partner) => partner.id === id);
      return row ? [row] : [];
    }
    case 'res.partner.create':
      return 99;
    case 'account.move.search_read':
      return recent;
    case 'account.move.create':
      return created ? created.id : 99;
    case 'account.move.read': {
      const id = args?.[0]?.[0];
      if (created && created.id === id) {
        return [{
          id: created.id,
          name: created.name,
          state: 'posted',
          amount_untaxed: created.subtotal,
          amount_tax: created.tax,
          amount_total: created.total,
          invoice_date: '2026-10-27',
          partner_id: [created.partnerId, partners.find((partner) => partner.id === created.partnerId)?.name ?? 'Cliente'],
          currency_id: [1, 'BOB'],
        }];
      }
      return recent.filter((invoice) => invoice.id === id);
    }
    case 'account.move.action_post':
      return true;
    case 'account.move.line.search_read': {
      const id = (kwargs?.domain ?? []).find((leaf) => Array.isArray(leaf) && leaf[0] === 'move_id')?.[2];
      return invoiceLines(id).map((line) => ({ ...line, id: line.id ?? 600 }));
    }
    default:
      return true;
  }
}

function rpcHandler(service, method, args, kwargs) {
  if (service === 'common' && method === 'version') {
    return { server_version: '17.0', server_version_info: [17, 0, 0, 'final', 0, ''], server_serie: '17.0', protocol_version: 1 };
  }
  if (service === 'common' && method === 'login') {
    return 7;
  }
  if (service === 'object' && method === 'execute_kw') {
    return executeKw(args[3], args[4], args[5], args[6]);
  }
  return null;
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

await context.route('**/*jsonrpc*', async (route) => {
  const request = route.request();
  let payload = {};
  try {
    payload = JSON.parse(request.postData() ?? '{}');
  } catch {
    payload = {};
  }
  const params = payload.params ?? {};
  const args = params.args ?? [];
  let result = null;

  if (args[3] === 'account.move' && args[4] === 'create') {
    const values = args[5]?.[0] ?? {};
    const lines = (values.invoice_line_ids ?? []).map((line, index) => {
      const valuesLine = line?.[2] ?? {};
      return {
        id: 900 + index,
        name: products.find((product) => product.id === valuesLine.product_id)?.name ?? 'Producto',
        quantity: valuesLine.quantity ?? 0,
        price_unit: valuesLine.price_unit ?? 0,
        price_subtotal: (valuesLine.quantity ?? 0) * (valuesLine.price_unit ?? 0),
      };
    });
    const subtotal = lines.reduce((total, line) => total + line.price_subtotal, 0);
    const tax = Math.round(subtotal * 0.13 * 100) / 100;
    created = {
      id: 99,
      name: 'INV/2026/00099',
      partnerId: values.partner_id,
      lines,
      subtotal,
      tax,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  }

  result = rpcHandler(params.service, params.method, args, params.service === 'object' ? args[6] : undefined);

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ jsonrpc: '2.0', id: payload.id ?? 1, result }),
  });
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await dismissToasts();
await page.screenshot({ path: resolve(OUT, '01-login.png') });

await page.getByRole('button', { name: /Entrar a Proyecto 309/ }).click();
await page.waitForURL('**/inventario');
await page.getByText('Teclado mecánico Pro 309').first().waitFor();
await page.waitForTimeout(500);
await dismissToasts();
await page.screenshot({ path: resolve(OUT, '02-inventario.png') });

// Restauración de sesión tras recargar (sessionStorage + login silencioso)
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Teclado mecánico Pro 309').first().waitFor();

await page.getByRole('button', { name: /Ajustar stock de Teclado/ }).click();
await page.getByRole('heading', { name: 'Ajuste de inventario' }).waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(OUT, '07-ajuste-stock.png') });
await page.getByRole('button', { name: 'Cancelar' }).click();
await page.waitForTimeout(300);

await page.getByRole('link', { name: /Clientes/ }).click();
await page.waitForURL('**/clientes');
await page.getByText('Comercial Andina S.R.L.').first().waitFor();
await page.waitForTimeout(600);
await dismissToasts();
await page.screenshot({ path: resolve(OUT, '03-clientes.png') });

await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
await page.getByRole('heading', { name: 'Nuevo cliente' }).waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(OUT, '08-nuevo-cliente.png') });
await page.getByRole('button', { name: 'Cancelar' }).click();
await page.waitForTimeout(300);

await page.getByRole('link', { name: /Facturación/ }).click();
await page.waitForURL('**/ventas');
await page.getByRole('button', { name: /Teclado mecánico Pro 309/ }).waitFor();
await page.getByRole('button', { name: /Teclado mecánico Pro 309/ }).click();
await page.getByRole('button', { name: /Monitor 27/ }).first().click();
await page.getByRole('button', { name: /Cable USB-C/ }).first().click();
await page.getByText('Seleccionar cliente').click();
await page.getByRole('button', { name: /Comercial Andina/ }).click();
await page.waitForTimeout(500);
await dismissToasts();
await page.screenshot({ path: resolve(OUT, '04-ventas-carrito.png') });

await page.getByRole('checkbox').uncheck();
await page.getByRole('button', { name: /Emitir factura/ }).click();
await page.getByText('Factura emitida').waitFor();
await page.waitForTimeout(700);
await dismissToasts();
await page.screenshot({ path: resolve(OUT, '05-venta-ok.png') });

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Descargar factura PDF/ }).click(),
]);
await download.saveAs(resolve('../docs/factura-ejemplo.pdf'));

const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: resolve(OUT, '06-login-movil.png') });

await browser.close();

if (consoleErrors.length > 0) {
  console.error('Errores de consola:\n' + consoleErrors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('UI smoke OK · capturas en docs/ui · PDF en docs/factura-ejemplo.pdf');
}
