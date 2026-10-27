import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { EmptyState, Spinner, TableSkeleton } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/context/session';
import { useDebouncedValue } from '@/lib/hooks';
import { displayCode, formatDate, formatMoney, formatQty, initials, safeCurrency } from '@/lib/format';
import type { PdfInvoiceData } from '@/lib/pdf';
import { friendlyMessage, inventory, partners, sales } from '@/lib/odoo';
import type { Invoice, Partner, Product } from '@/lib/odoo';

interface CartLine {
  product: Product;
  quantity: number;
}

interface SaleResult {
  invoice: Invoice;
  pdf: PdfInvoiceData;
}

function invoiceStateLabel(state: Invoice['state']): string {
  if (state === 'posted') return 'Emitida';
  if (state === 'draft') return 'Borrador';
  return 'Cancelada';
}

export function SalesPage() {
  const { client, currency } = useSession();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const debouncedSearch = useDebouncedValue(productSearch, 350);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);

  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [autoDownload, setAutoDownload] = useState(true);

  const [recent, setRecent] = useState<Invoice[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductError(null);
    try {
      setProducts(await inventory.listProducts(client, { search: debouncedSearch, limit: 60, order: 'name asc' }));
    } catch (cause) {
      setProductError(friendlyMessage(cause));
    } finally {
      setLoadingProducts(false);
    }
  }, [client, debouncedSearch]);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      setRecent(await sales.listRecentInvoices(client, 8));
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, [client]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Cliente preseleccionado desde el módulo de clientes (?cliente=ID)
  useEffect(() => {
    const id = Number(searchParams.get('cliente'));
    if (!Number.isInteger(id) || id <= 0) return;
    let active = true;
    partners
      .getPartner(client, id)
      .then((partner) => {
        if (active && partner) setSelectedPartner(partner);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client, searchParams]);

  const subtotal = useMemo(
    () => lines.reduce((total, line) => total + line.product.list_price * line.quantity, 0),
    [lines],
  );
  const itemCount = useMemo(() => lines.reduce((total, line) => total + line.quantity, 0), [lines]);

  /** jsPDF solo se descarga cuando se necesita firmar un comprobante. */
  const savePdf = async (pdf: PdfInvoiceData) => {
    const { downloadInvoicePdf } = await import('@/lib/pdf');
    downloadInvoicePdf(pdf);
  };

  const addProduct = (product: Product) => {
    setResult(null);
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    setLines((current) =>
      current
        .map((line) => (line.product.id === productId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  const removeLine = (productId: number) => {
    setLines((current) => current.filter((line) => line.product.id !== productId));
  };

  const resetOrder = () => {
    setLines([]);
    setResult(null);
    setSelectedPartner(null);
  };

  const emit = async () => {
    if (!selectedPartner) {
      toast.error('Falta el cliente', 'Selecciona un cliente antes de emitir la factura.');
      setPickerOpen(true);
      return;
    }
    if (lines.length === 0) {
      toast.error('Orden vacía', 'Agrega al menos un producto al carrito.');
      return;
    }

    setSubmitting(true);
    try {
      const invoice = await sales.createInvoice(client, {
        partnerId: selectedPartner.id,
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          unitPrice: line.product.list_price,
        })),
      });

      const invoiceLines = await sales.getInvoiceLines(client, invoice.id);
      const pdf = buildPdfData({
        invoice,
        lines: invoiceLines,
        partner: selectedPartner,
        fallbackCurrency: currency,
      });

      setResult({ invoice, pdf });
      setLines([]);

      if (autoDownload) {
        await savePdf(pdf);
      }

      toast.success(
        `Factura ${invoice.name || invoice.id} emitida`,
        `${formatMoney(invoice.amount_total, safeCurrency(Array.isArray(invoice.currency_id) ? invoice.currency_id[1] : currency))} registrados en Odoo.`,
      );

      void loadProducts();
      void loadRecent();
    } catch (cause) {
      toast.error('No se pudo emitir la factura', friendlyMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadRecent = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      const [invoiceLines, partner] = await Promise.all([
        sales.getInvoiceLines(client, invoice.id),
        Array.isArray(invoice.partner_id) ? partners.getPartner(client, invoice.partner_id[0]) : Promise.resolve(null),
      ]);

      const pdf = buildPdfData({
        invoice,
        lines: invoiceLines,
        partner,
        fallbackCurrency: currency,
      });
      await savePdf(pdf);
      toast.success('Comprobante generado', `${pdf.number} descargado en PDF.`);
    } catch (cause) {
      toast.error('No se pudo generar el PDF', friendlyMessage(cause));
    } finally {
      setDownloadingId(null);
    }
  };

  const previewPdf = async () => {
    const { downloadInvoicePdf, sampleInvoiceData } = await import('@/lib/pdf');
    downloadInvoicePdf(sampleInvoiceData(safeCurrency(currency)));
    toast.info('PDF de ejemplo', 'Comprobante de demostración generado con la marca Proyecto 309.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-gold-400/80">Apartado 3</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">Facturación y punto de venta</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            Venta rápida contra <span className="font-mono text-[12px]">account.move</span> con comprobante PDF
            generado en el navegador.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void previewPdf()} icon={<FileText className="h-3.5 w-3.5" />}>
            Ver PDF de ejemplo
          </Button>
          <Button variant="secondary" onClick={resetOrder} icon={<RefreshCw className="h-4 w-4" />}>
            Nueva venta
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Catálogo */}
        <section className="surface flex min-h-[520px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
            <div className="min-w-[200px] flex-1">
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Buscar producto para vender…"
                icon={<Search className="h-4 w-4" />}
                className="h-10 py-0"
                aria-label="Buscar productos"
              />
            </div>
            <span className="label hidden sm:inline">{products.length} en catálogo</span>
          </div>

          {loadingProducts ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[104px] animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />
              ))}
            </div>
          ) : productError ? (
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title="Catálogo no disponible"
              description={productError}
              action={
                <Button variant="secondary" onClick={() => void loadProducts()} icon={<RefreshCw className="h-4 w-4" />}>
                  Reintentar
                </Button>
              }
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="Sin resultados"
              description="No hay productos que coincidan con la búsqueda. Verifica el catálogo en Odoo."
            />
          ) : (
            <div className="grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2 2xl:grid-cols-3">
              {products.map((product) => {
                const isService = (product.detailed_type ?? product.type) === 'service';
                const inCart = lines.find((line) => line.product.id === product.id);
                return (
                  <motion.button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    whileTap={{ scale: 0.985 }}
                    className="group relative flex h-full flex-col justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition hover:border-gold-500/35 hover:bg-gold-500/[0.05]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-100">{product.name}</p>
                        {inCart ? (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-ink-950">
                            {inCart.quantity}
                          </span>
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold-300" aria-hidden />
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">{displayCode(product.default_code)}</p>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="text-sm font-semibold text-gold-300">
                        {formatMoney(product.list_price, currency)}
                      </p>
                      {isService ? (
                        <Badge tone="neutral">Servicio</Badge>
                      ) : (
                        <span className={`text-[10.5px] ${product.qty_available > 0 ? 'text-slate-500' : 'text-rose-400'}`}>
                          {formatQty(product.qty_available)} en stock
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        {/* Carrito */}
        <aside className="xl:sticky xl:top-[84px] xl:self-start">
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-gold-300" aria-hidden />
                <h2 className="text-sm font-semibold text-white">Orden actual</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={itemCount > 0 ? 'gold' : 'neutral'}>{itemCount} ítem(s)</Badge>
                {itemCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetOrder}
                    className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-rose-300"
                    aria-label="Vaciar orden"
                    title="Vaciar orden"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-4 py-6"
                >
                  <div className="flex flex-col items-center text-center">
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10"
                    >
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden />
                    </motion.span>
                    <p className="mt-3 text-sm font-semibold text-white">Factura emitida</p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-slate-400">
                      {result.invoice.name || `#${result.invoice.id}`}
                    </p>
                  </div>

                  <dl className="mt-5 space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-[12.5px]">
                    <div className="flex justify-between text-slate-400">
                      <dt>Subtotal</dt>
                      <dd>{formatMoney(result.invoice.amount_untaxed, pdfCurrency(result.invoice, currency))}</dd>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <dt>Impuestos</dt>
                      <dd>{formatMoney(result.invoice.amount_tax, pdfCurrency(result.invoice, currency))}</dd>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.08] pt-2 text-sm font-semibold text-white">
                      <dt>Total</dt>
                      <dd className="text-gold-300">
                        {formatMoney(result.invoice.amount_total, pdfCurrency(result.invoice, currency))}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 space-y-2">
                    <Button full onClick={() => void savePdf(result.pdf)} icon={<Download className="h-4 w-4" />}>
                      Descargar factura PDF
                    </Button>
                    <Button full variant="secondary" onClick={resetOrder} icon={<Plus className="h-4 w-4" />}>
                      Nueva venta
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.03]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-slate-300">
                      {selectedPartner ? initials(selectedPartner.name) : <UserRound className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-500">Cliente</span>
                      <span className="block truncate text-[13px] font-medium text-slate-100">
                        {selectedPartner?.name ?? 'Seleccionar cliente'}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden />
                  </button>

                  <div className="max-h-[320px] min-h-[160px] overflow-y-auto">
                    {lines.length === 0 ? (
                      <div className="flex h-[160px] flex-col items-center justify-center px-6 text-center">
                        <ShoppingCart className="h-6 w-6 text-slate-700" aria-hidden />
                        <p className="mt-2 text-xs text-slate-500">
                          Elige productos del catálogo para armar la orden.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-white/[0.05]">
                        {lines.map((line) => (
                          <li key={line.product.id} className="px-4 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12.5px] font-medium text-slate-100">{line.product.name}</p>
                                <p className="font-mono text-[10px] text-slate-500">
                                  {formatMoney(line.product.list_price, currency)} · {displayCode(line.product.default_code)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeLine(line.product.id)}
                                className="rounded p-1 text-slate-600 transition hover:bg-white/5 hover:text-rose-300"
                                aria-label={`Quitar ${line.product.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="inline-flex items-center rounded-lg border border-white/10 bg-ink-950/60">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(line.product.id, line.quantity - 1)}
                                  className="px-2 py-1 text-slate-400 transition hover:text-white"
                                  aria-label="Disminuir"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="min-w-7 text-center text-xs font-medium text-white">{line.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(line.product.id, line.quantity + 1)}
                                  className="px-2 py-1 text-slate-400 transition hover:text-white"
                                  aria-label="Aumentar"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <p className="text-[12.5px] font-semibold text-slate-200">
                                {formatMoney(line.product.list_price * line.quantity, currency)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-white/[0.06] px-4 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Subtotal</span>
                      <span className="text-base font-semibold text-white">{formatMoney(subtotal, currency)}</span>
                    </div>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                      Sin impuestos. Odoo calcula impuestos y total definitivo al emitir.
                    </p>

                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={autoDownload}
                        onChange={(event) => setAutoDownload(event.target.checked)}
                        className="h-3.5 w-3.5 rounded border-white/20 bg-ink-950 accent-gold-500"
                      />
                      Descargar el PDF automáticamente
                    </label>

                    <Button
                      full
                      size="lg"
                      className="mt-3"
                      onClick={() => void emit()}
                      loading={submitting}
                      disabled={lines.length === 0}
                      icon={<ReceiptText className="h-4 w-4" />}
                    >
                      {submitting ? 'Registrando en Odoo…' : 'Emitir factura'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
            <p className="text-[10.5px] leading-relaxed text-slate-500">
              La factura se crea y publica en Odoo (<span className="font-mono">account.move</span>). El PDF se
              genera en el navegador con los totales devueltos por el servidor.
            </p>
          </div>
        </aside>
      </div>

      {/* Historial reciente */}
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gold-300" aria-hidden />
            <h2 className="text-sm font-semibold text-white">Facturas recientes</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadRecent()}
            loading={loadingRecent}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        </div>

        {loadingRecent ? (
          <TableSkeleton rows={4} cols={5} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-6 w-6" />}
            title="Sin facturas todavía"
            description="Las facturas emitidas desde Proyecto 309 aparecerán aquí con su comprobante PDF."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Comprobante</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {recent.map((invoice) => (
                  <tr key={invoice.id} className="row-hover">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] text-slate-200">
                        {invoice.name || `#${invoice.id}`}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-300">
                      {Array.isArray(invoice.partner_id) ? invoice.partner_id[1] : '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400">
                      {formatDate(invoice.invoice_date)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12.5px] font-medium text-slate-200">
                      {formatMoney(invoice.amount_total, pdfCurrency(invoice, currency))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={invoice.state === 'posted' ? 'success' : 'warning'}>
                        {invoiceStateLabel(invoice.state)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void downloadRecent(invoice)}
                        loading={downloadingId === invoice.id}
                        icon={
                          downloadingId === invoice.id ? undefined : <Download className="h-3.5 w-3.5" />
                        }
                      >
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ClientPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={selectedPartner?.id ?? null}
        onSelect={(partner) => {
          setSelectedPartner(partner);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function pdfCurrency(invoice: Invoice, fallback: string): string {
  return safeCurrency(Array.isArray(invoice.currency_id) ? invoice.currency_id[1] : fallback);
}

function buildPdfData({
  invoice,
  lines,
  partner,
  fallbackCurrency,
}: {
  invoice: Invoice;
  lines: Array<{ name: string; quantity: number; price_unit: number; price_subtotal: number }>;
  partner: Partner | null;
  fallbackCurrency: string;
}): PdfInvoiceData {
  const currency = pdfCurrency(invoice, fallbackCurrency);
  const date = typeof invoice.invoice_date === 'string' ? invoice.invoice_date : new Date().toISOString().slice(0, 10);
  const address = [partner?.street, partner?.city].filter(Boolean).join(', ');

  return {
    number: invoice.name ? String(invoice.name) : `Factura #${invoice.id}`,
    date,
    stateLabel: invoiceStateLabel(invoice.state).toUpperCase(),
    customer: {
      name: partner?.name ?? (Array.isArray(invoice.partner_id) ? invoice.partner_id[1] : 'Cliente'),
      vat: partner?.vat ?? null,
      email: partner?.email ?? null,
      phone: partner?.phone ?? null,
      address: address || null,
    },
    lines: lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.price_unit,
      subtotal: line.price_subtotal,
    })),
    subtotal: invoice.amount_untaxed,
    tax: invoice.amount_tax,
    total: invoice.amount_total,
    currency,
  };
}

function ClientPickerModal({
  open,
  onClose,
  onSelect,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (partner: Partner) => void;
  selectedId: number | null;
}) {
  const { client } = useSession();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);

    partners
      .listFrequentPartners(client, 8)
      .then(async (frequent) => {
        if (!active) return;
        if (!debouncedQuery.trim()) {
          setResults(frequent.length > 0 ? frequent : await partners.listPartners(client, { limit: 30 }));
        } else {
          const found = await partners.listPartners(client, { search: debouncedQuery, limit: 30 });
          if (active) setResults(found);
        }
      })
      .catch((cause) => {
        if (active) toast.error('No se pudo cargar clientes', friendlyMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [client, debouncedQuery, open, toast]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Seleccionar cliente" description="Búsqueda en res.partner">
      <div className="space-y-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, email, teléfono o NIT…"
          icon={<Search className="h-4 w-4" />}
          autoFocus
        />

        <div className="max-h-[340px] overflow-y-auto rounded-xl border border-white/[0.07]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
              <Spinner /> Buscando clientes…
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-slate-500">
              Sin coincidencias. Crea el cliente desde el apartado de Clientes.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {results.map((partner) => (
                <li key={partner.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(partner)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10.5px] font-semibold text-slate-300">
                      {initials(partner.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-slate-100">{partner.name}</span>
                      <span className="block truncate text-[10.5px] text-slate-500">
                        {partner.vat ? `NIT ${partner.vat} · ` : ''}
                        {partner.email || partner.phone || 'Sin datos de contacto'}
                      </span>
                    </span>
                    {selectedId === partner.id ? (
                      <Check className="h-4 w-4 text-gold-400" aria-hidden />
                    ) : (
                      <span className="text-[10px] text-slate-500">{partner.sale_order_count ?? 0} compras</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
