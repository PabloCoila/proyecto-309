/**
 * Factura PDF de "Proyecto 309" generada 100% en el cliente (jsPDF).
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
const INK: [number, number, number] = [12, 17, 24];
const GOLD: [number, number, number] = [216, 180, 95];
const GOLD_SOFT: [number, number, number] = [240, 220, 172];
const MUTED: [number, number, number] = [104, 113, 128];
const LINE: [number, number, number] = [231, 235, 241];

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

  // Marca: tile dorado con "309"
  doc.setFillColor(...GOLD);
  doc.roundedRect(MARGIN, 12.5, 17, 17, 4.5, 4.5, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('309', MARGIN + 8.5, 22.4, { align: 'center' });

  // Wordmark
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setCharSpace(0.5);
  doc.text('PROYECTO 309', MARGIN + 21.5, 21);
  doc.setCharSpace(0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...GOLD_SOFT);
  doc.setCharSpace(1.1);
  doc.text('INVENTARIO & PUNTO DE VENTA', MARGIN + 21.5, 26.4);
  doc.setCharSpace(0);

  // Bloque derecho: comprobante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...GOLD);
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

  // Línea dorada inferior
  doc.setFillColor(...GOLD);
  doc.rect(0, 43.4, PAGE_W, 0.6, 'F');
}

function drawContinuationHeader(doc: jsPDF, data: PdfInvoiceData): void {
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 18, 'F');
  doc.setFillColor(...GOLD);
  doc.roundedRect(MARGIN, 4.5, 9, 9, 2.4, 2.4, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('309', MARGIN + 4.5, 10.4, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('PROYECTO 309', MARGIN + 12, 9.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(168, 177, 192);
  doc.text(pdfText(`Factura ${data.number}`), PAGE_W - MARGIN, 9.6, { align: 'right' });
}

function drawCustomerAndMeta(doc: jsPDF, data: PdfInvoiceData): number {
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...GOLD);
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
  doc.setTextColor(...GOLD);
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
  doc.setTextColor(...GOLD);
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
    doc.setTextColor(...GOLD);
    doc.setCharSpace(0.8);
    doc.text('PROYECTO 309', MARGIN, PAGE_H - 16.5);
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
      textColor: GOLD_SOFT,
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
  return `Proyecto309-Factura-${clean}.pdf`;
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
    number: 'INV/2026/0309',
    date,
    stateLabel: 'EMITIDA',
    customer: {
      name: 'Comercial Andina S.R.L.',
      vat: '1023456789',
      email: 'compras@andina.example',
      phone: '+591 712 34567',
      address: 'Av. 6 de Agosto #309, La Paz',
    },
    lines: [
      { name: 'Teclado mecánico Pro 309', quantity: 2, unitPrice: 420, subtotal: 840 },
      { name: 'Monitor 27" 165 Hz', quantity: 1, unitPrice: 2150, subtotal: 2150 },
      { name: 'Cable USB-C trenzado 2 m', quantity: 3, unitPrice: 85, subtotal: 255 },
    ],
    subtotal: 3245,
    tax: 422.85,
    total: 3667.85,
    currency,
    note: 'Gracias por su compra. Documento de demostración generado por Proyecto 309.',
  };
}
