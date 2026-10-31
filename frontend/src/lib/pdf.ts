/**
 * Factura PDF de "Neru" generada 100% en el cliente (jsPDF).
 * Diseño: cabecera oscura con marca, bloque de cliente, tabla de ítems,
 * totales calculados por Odoo y pie con paginación.
 */
import { jsPDF } from 'jspdf';
// Build ESM: el entry CJS expone `default` dentro de un objeto y rompe el interop.
import autoTable from 'jspdf-autotable/es';
import { formatDate, formatMoney, formatQty } from './format';

export interface PdfInvoiceLine {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PdfInvoiceData {
  number: string;
  date: string;
  stateLabel?: string;
  customer: {
    name: string;
    vat?: string | false | null;
    email?: string | false | null;
    phone?: string | false | null;
    address?: string | false | null;
  };
  lines: PdfInvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  note?: string | false | null;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const INK: [number, number, number] = [11, 31, 51]; // azul petróleo
const TEAL: [number, number, number] = [15, 118, 110]; // teal de marca
const TEAL_SOFT: [number, number, number] = [153, 246, 228];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];

/**
 * Geometría del icono de billetera de la marca en una caja 64×64.
 * Espejo de `WALLET_GEOMETRY` en `src/components/Logo.tsx`.
 */
const WALLET = {
  body: { x: 3, y: 19, w: 50, h: 39, r: 8.5 },
  card: [
    [16.9, 15.6],
    [43.5, 7.0],
    [47.2, 18.4],
    [20.6, 27.0],
  ] as const,
  cardLines: [
    [
      [21.0, 17.0],
      [41.0, 10.6],
    ],
    [
      [22.5, 19.9],
      [41.7, 13.7],
    ],
  ] as const,
  clasp: { x: 46, y: 28, w: 15, h: 17, r: 6 },
  claspDot: { cx: 53.5, cy: 36.5, r: 2.7 },
  coins: [
    [
      [6, 46],
      [16, 41],
      [25, 46],
      [25, 52],
      [16, 57],
      [6, 52],
    ],
    [
      [25, 49],
      [31, 46],
      [37, 49],
      [37, 54],
      [31, 57],
      [25, 54],
    ],
  ] as const,
  coinRidges: [
    [
      [6, 46],
      [16, 51],
      [25, 46],
    ],
    [
      [25, 49],
      [31, 52],
      [37, 49],
    ],
  ] as const,
};

/** Traza un polígono/polilínea de la geometría de la billetera (caja 64×64) escalada. */
function walletPath(
  doc: jsPDF,
  points: ReadonlyArray<readonly [number, number]>,
  originX: number,
  originY: number,
  k: number,
  style: 'FD' | 'S',
  closed: boolean,
): void {
  const [start] = points;
  const deltas = points
    .slice(1)
    .map(([px, py], index): [number, number] => {
      const [qx, qy] = points[index];
      return [(px - qx) * k, (py - qy) * k];
    });
  doc.lines(deltas, originX + start[0] * k, originY + start[1] * k, [1, 1], style, closed);
}

/**
 * Icono de billetera de Neru (línea blanca) para las cabeceras del PDF.
 * Se dibuja sobre el fondo oscuro usando el color de tinta como relleno de recorte.
 */
function drawWalletMark(doc: jsPDF, x: number, y: number, size: number): void {
  const k = size / 64;

  doc.setLineJoin('round');
  doc.setLineCap('round');
  doc.setLineWidth(Math.max(0.22, size * 0.052));
  doc.setDrawColor(255, 255, 255);

  // Cuerpo de la billetera
  doc.roundedRect(
    x + WALLET.body.x * k,
    y + WALLET.body.y * k,
    WALLET.body.w * k,
    WALLET.body.h * k,
    WALLET.body.r * k,
    WALLET.body.r * k,
    'S',
  );

  // Monedas apiladas (relleno de tinta para recortar el borde del cuerpo)
  doc.setFillColor(...INK);
  for (const coin of WALLET.coins) walletPath(doc, coin, x, y, k, 'FD', true);
  for (const ridge of WALLET.coinRidges) walletPath(doc, ridge, x, y, k, 'S', false);

  // Tarjeta asomando por arriba
  walletPath(doc, WALLET.card, x, y, k, 'FD', true);
  for (const line of WALLET.cardLines) walletPath(doc, line, x, y, k, 'S', false);

  // Cierre lateral con botón
  doc.roundedRect(
    x + WALLET.clasp.x * k,
    y + WALLET.clasp.y * k,
    WALLET.clasp.w * k,
    WALLET.clasp.h * k,
    WALLET.clasp.r * k,
    WALLET.clasp.r * k,
    'FD',
  );
  doc.setFillColor(255, 255, 255);
  doc.circle(x + WALLET.claspDot.cx * k, y + WALLET.claspDot.cy * k, WALLET.claspDot.r * k, 'F');
}

/** Intl usa espacios especiales; la fuente WinAnsi de jsPDF solo entiende ASCII. */
function pdfText(value: string): string {
  return value.replace(/[\u00A0\u202F\u2009]/g, ' ');
}

function money(value: number, currency: string): string {
  return pdfText(formatMoney(value, currency));
}

function drawBrandHeader(doc: jsPDF, data: PdfInvoiceData): void {
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 44, 'F');

  // Marca: icono de billetera de Neru
  drawWalletMark(doc, MARGIN, 12.5, 17);

  // Wordmark
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setCharSpace(0.5);
  doc.text('NERU', MARGIN + 21.5, 21);
  doc.setCharSpace(0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...TEAL_SOFT);
  doc.setCharSpace(1.1);
  doc.text('INVENTARIO & PUNTO DE VENTA', MARGIN + 21.5, 26.4);
  doc.setCharSpace(0);

  // Bloque derecho: comprobante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...TEAL_SOFT);
  doc.setCharSpace(2.2);
  doc.text('FACTURA', PAGE_W - MARGIN, 17, { align: 'right' });
  doc.setCharSpace(0);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(pdfText(data.number || 'BORRADOR'), PAGE_W - MARGIN, 24.6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(168, 177, 192);
  doc.text(pdfText(`${formatDate(data.date)}  ·  ${data.currency}`), PAGE_W - MARGIN, 30.4, { align: 'right' });

  // Línea teal inferior
  doc.setFillColor(...TEAL);
  doc.rect(0, 43.4, PAGE_W, 0.6, 'F');
}

function drawContinuationHeader(doc: jsPDF, data: PdfInvoiceData): void {
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 18, 'F');
  drawWalletMark(doc, MARGIN, 4.5, 9);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('NERU', MARGIN + 12, 9.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(168, 177, 192);
  doc.text(pdfText(`Factura ${data.number}`), PAGE_W - MARGIN, 9.6, { align: 'right' });
}

function drawCustomerAndMeta(doc: jsPDF, data: PdfInvoiceData): number {
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...TEAL);
  doc.setCharSpace(1.4);
  doc.text('FACTURAR A', MARGIN, y);
  doc.setCharSpace(0);

  y += 7;
  doc.setTextColor(...INK);
  doc.setFontSize(12);
  const nameLines = doc.splitTextToSize(pdfText(data.customer.name || 'Cliente sin nombre'), 102) as string[];
  doc.text(nameLines.slice(0, 2), MARGIN, y);
  y += nameLines.length > 1 ? 11 : 6.5;

  const details: string[] = [];
  if (data.customer.vat) details.push(`NIT / CI: ${data.customer.vat}`);
  if (data.customer.address) details.push(data.customer.address);
  const contact = [data.customer.phone, data.customer.email].filter(Boolean).join('  ·  ');
  if (contact) details.push(contact);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...MUTED);
  for (const line of details.slice(0, 3)) {
    const wrapped = doc.splitTextToSize(pdfText(line), 102) as string[];
    doc.text(wrapped.slice(0, 2), MARGIN, y);
    y += wrapped.length > 1 ? 8.4 : 4.6;
  }

  // Caja de metadatos
  const boxX = 130;
  const boxW = PAGE_W - MARGIN - boxX;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, 52, boxW, 25, 2.5, 2.5, 'S');

  const rows: Array<[string, string]> = [
    ['FECHA', pdfText(formatDate(data.date))],
    ['MONEDA', data.currency],
    ['ESTADO', data.stateLabel ?? 'EMITIDA'],
  ];

  let rowY = 58.6;
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.setCharSpace(0.6);
    doc.text(label, boxX + 5, rowY);
    doc.setCharSpace(0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...INK);
    doc.text(value, boxX + boxW - 5, rowY, { align: 'right' });
    rowY += 6.2;
  }

  return Math.max(y, 80) + 8;
}

function drawTotals(doc: jsPDF, data: PdfInvoiceData, startY: number): number {
  const boxW = 76;
  const boxX = PAGE_W - MARGIN - boxW;
  let y = startY;

  const row = (label: string, value: string, bold = false): void => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(...(bold ? INK : MUTED));
    doc.text(label, boxX + 2, y);
    doc.setTextColor(...INK);
    doc.text(value, boxX + boxW - 2, y, { align: 'right' });
    y += 6.4;
  };

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(boxX, startY - 5.4, boxX + boxW, startY - 5.4);

  row('Subtotal', money(data.subtotal, data.currency));
  row('Impuestos', money(data.tax, data.currency));

  y += 1.2;
  const bandH = 13;
  doc.setFillColor(...INK);
  doc.roundedRect(boxX, y - 3.6, boxW, bandH, 2.4, 2.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...TEAL_SOFT);
  doc.setCharSpace(1.2);
  doc.text('TOTAL', boxX + 5, y + 4.2);
  doc.setCharSpace(0);
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text(money(data.total, data.currency), boxX + boxW - 5, y + 4.4, { align: 'right' });

  return y + bandH;
}

function drawNotes(doc: jsPDF, note: string, top: number, maxY: number): number {
  const width = 92;
  const wrapped = doc.splitTextToSize(pdfText(note), width) as string[];
  if (wrapped.length === 0) return top;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...TEAL);
  doc.setCharSpace(1.2);
  doc.text('NOTAS', MARGIN, top);
  doc.setCharSpace(0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  const maxLines = Math.max(0, Math.floor((maxY - top - 5) / 4.2));
  const visible = wrapped.slice(0, maxLines);
  doc.text(visible, MARGIN, top + 5);
  return top + 5 + visible.length * 4.2;
}

/** Cierre de página: agradecimiento y firma, anclados sobre el pie. */
function drawClosing(doc: jsPDF, y: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(...INK);
  doc.text('Gracias por su compra.', MARGIN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text('Conserve este comprobante para cualquier consulta o reclamo.', MARGIN, y + 4.6);

  const right = PAGE_W - MARGIN;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(right - 52, y + 8, right, y + 8);
  doc.setFontSize(6.8);
  doc.text('Firma autorizada', right - 26, y + 12, { align: 'center' });
}

function drawFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 22, PAGE_W - MARGIN, PAGE_H - 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...TEAL);
    doc.setCharSpace(0.8);
    doc.text('NERU', MARGIN, PAGE_H - 16.5);
    doc.setCharSpace(0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text('Comprobante generado localmente · Inventario & Punto de Venta', MARGIN + 34, PAGE_H - 16.5);
    doc.text(`Página ${page} de ${total}`, PAGE_W - MARGIN, PAGE_H - 16.5, { align: 'right' });
  }
}

export function buildInvoicePdf(data: PdfInvoiceData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  drawBrandHeader(doc, data);
  const tableTop = drawCustomerAndMeta(doc, data);

  autoTable(doc, {
    startY: tableTop,
    margin: { left: MARGIN, right: MARGIN, top: 24 },
    theme: 'plain',
    head: [
      [
        { content: 'DESCRIPCIÓN', styles: { halign: 'left' } },
        { content: 'CANT.', styles: { halign: 'right' } },
        { content: 'P. UNITARIO', styles: { halign: 'right' } },
        { content: 'IMPORTE', styles: { halign: 'right' } },
      ],
    ],
    body: data.lines.map((line) => [
      pdfText(line.name),
      pdfText(formatQty(line.quantity)),
      money(line.unitPrice, data.currency),
      money(line.subtotal, data.currency),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8.6,
      textColor: [32, 38, 48],
      cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 },
      lineColor: LINE,
      lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
    },
    headStyles: {
      fillColor: INK,
      textColor: TEAL_SOFT,
      fontSize: 7.2,
      fontStyle: 'bold',
      cellPadding: { top: 3.6, bottom: 3.6, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 96 },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) drawContinuationHeader(doc, data);
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? tableTop;

  let y = finalY + 12;
  if (y + 46 > PAGE_H - 26) {
    doc.addPage();
    drawContinuationHeader(doc, data);
    y = 32;
  }

  const totalsBottom = drawTotals(doc, data, y);
  const notesBottom = data.note ? drawNotes(doc, data.note, y, PAGE_H - 62) : y;

  if (Math.max(totalsBottom, notesBottom) < PAGE_H - 60) {
    drawClosing(doc, PAGE_H - 52);
  }

  drawFooters(doc);
  return doc;
}

export function invoicePdfFileName(number: string): string {
  const clean = (number || 'borrador').replace(/[^\w-]+/g, '-');
  return `Neru-Factura-${clean}.pdf`;
}

/** Genera y descarga el comprobante; devuelve el nombre del archivo. */
export function downloadInvoicePdf(data: PdfInvoiceData): string {
  const doc = buildInvoicePdf(data);
  const fileName = invoicePdfFileName(data.number);
  doc.save(fileName);
  return fileName;
}

/** Datos de ejemplo para previsualizar el diseño sin Odoo (modo demo). */
export function sampleInvoiceData(currency = 'BOB'): PdfInvoiceData {
  const date = new Date().toISOString().slice(0, 10);
  return {
    number: 'INV/2026/0001',
    date,
    stateLabel: 'EMITIDA',
    customer: {
      name: 'Comercial Andina S.R.L.',
      vat: '1023456789',
      email: 'compras@andina.example',
      phone: '+591 712 34567',
      address: 'Av. 6 de Agosto #30, La Paz',
    },
    lines: [
      { name: 'Teclado mecánico Pro', quantity: 2, unitPrice: 420, subtotal: 840 },
      { name: 'Monitor 27" 165 Hz', quantity: 1, unitPrice: 2150, subtotal: 2150 },
      { name: 'Cable USB-C trenzado 2 m', quantity: 3, unitPrice: 85, subtotal: 255 },
    ],
    subtotal: 3245,
    tax: 422.85,
    total: 3667.85,
    currency,
    note: 'Gracias por su compra. Documento de demostración generado por Neru.',
  };
}
