import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  Boxes,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Warehouse,
} from 'lucide-react';
import { Badge } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { EmptyState, Spinner, Stat, TableSkeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/context/session';
import { useDebouncedValue } from '@/lib/hooks';
import { displayCode, formatMoney, formatQty, shortLocation } from '@/lib/format';
import { friendlyMessage, inventory } from '@/lib/odoo';
import type { Product, StockLocation } from '@/lib/odoo';

interface Summary {
  products: number;
  locations: number;
  quants: number;
}

export function InventoryPage() {
  const { client, currency } = useSession();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [onlyStock, setOnlyStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  const fetchProducts = useCallback(
    async (notify = false) => {
      setLoading(true);
      setError(null);
      try {
        const data = await inventory.listProducts(client, {
          search: debouncedSearch,
          onlyWithStock: onlyStock,
          limit: 120,
        });
        setProducts(data);
      } catch (cause) {
        setError(friendlyMessage(cause));
      } finally {
        setLoading(false);
        if (notify) setRefreshing(false);
      }
    },
    [client, debouncedSearch, onlyStock],
  );

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    let active = true;
    Promise.all([
      inventory.listStockLocations(client),
      inventory.getInventorySummary(client),
    ])
      .then(([locationRows, stats]) => {
        if (!active) return;
        setLocations(locationRows);
        setSummary(stats);
      })
      .catch(() => {
        /* el listado de productos ya muestra el error de conexión */
      });
    return () => {
      active = false;
    };
  }, [client]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProducts(true),
      inventory
        .getInventorySummary(client)
        .then(setSummary)
        .catch(() => undefined),
    ]);
    setRefreshing(false);
  };

  const handleAdjusted = (productName: string) => {
    toast.success('Stock actualizado', `${productName} se sincronizó con Odoo.`);
    setSelected(null);
    void refreshAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-gold-400/80">Apartado 1</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">Inventario y almacén</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            Existencias a mano, ubicaciones internas y ajustes registrados directamente en Odoo.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void refreshAll()}
          loading={refreshing}
          icon={<RefreshCw className="h-4 w-4" />}
        >
          Actualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Productos almacenables"
          value={summary ? summary.products : '—'}
          icon={<Package className="h-4 w-4" />}
          hint="product.product · tipo almacenable"
        />
        <Stat
          label="Referencias con stock"
          value={summary ? summary.quants : '—'}
          icon={<Boxes className="h-4 w-4" />}
          hint="quants con cantidad distinta de cero"
        />
        <Stat
          label="Ubicaciones internas"
          value={summary ? summary.locations : '—'}
          icon={<Warehouse className="h-4 w-4" />}
          accent
          hint="stock.location"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
            <div className="min-w-[200px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, referencia o código de barras…"
                icon={<Search className="h-4 w-4" />}
                className="h-10 py-0"
                aria-label="Buscar productos"
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={onlyStock}
              onClick={() => setOnlyStock((current) => !current)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 transition hover:border-white/20"
            >
              <span
                className={`relative h-4 w-7 rounded-full transition-colors ${onlyStock ? 'bg-gold-500' : 'bg-white/15'}`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${onlyStock ? 'left-3.5' : 'left-0.5'}`}
                />
              </span>
              Solo con stock
            </button>
          </div>

          {loading ? (
            <TableSkeleton rows={7} cols={5} />
          ) : error ? (
            <EmptyState
              icon={<Boxes className="h-6 w-6" />}
              title="No se pudo leer el inventario"
              description={error}
              action={
                <Button variant="secondary" onClick={() => void fetchProducts()} icon={<RefreshCw className="h-4 w-4" />}>
                  Reintentar
                </Button>
              }
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="Sin productos para mostrar"
              description="Crea productos en Odoo o ajusta la búsqueda. Los productos de tipo servicio no aparecen en inventario."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-3 py-2.5 font-medium">Producto</th>
                    <th className="px-3 py-2.5 font-medium">Categoría</th>
                    <th className="px-3 py-2.5 text-right font-medium">En mano</th>
                    <th className="px-3 py-2.5 text-right font-medium">Disponible</th>
                    <th className="px-3 py-2.5 text-right font-medium">Precio</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {products.map((product) => {
                    const category = Array.isArray(product.categ_id) ? product.categ_id[1] : 'Sin categoría';
                    const uom = Array.isArray(product.uom_id) ? product.uom_id[1] : 'u.';
                    const hasStock = product.qty_available > 0;

                    return (
                      <motion.tr
                        key={product.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="row-hover"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gold-300">
                              <Package className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 max-w-[220px]">
                              <p className="truncate font-medium text-slate-100">{product.name}</p>
                              <p className="truncate font-mono text-[10.5px] text-slate-500">
                                {displayCode(product.default_code)}
                                {product.barcode ? ` · ${product.barcode}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge>{category}</Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-semibold ${hasStock ? 'text-slate-100' : 'text-slate-500'}`}>
                            {formatQty(product.qty_available)}
                          </span>
                          <span className="ml-1 text-[10.5px] text-slate-500">{uom}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Badge tone={product.free_qty > 0 ? 'success' : 'danger'}>
                            {formatQty(product.free_qty)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-300">
                          {formatMoney(product.list_price, currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelected(product)}
                            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                            className="w-8 px-0"
                            aria-label={`Ajustar stock de ${product.name}`}
                            title="Ajustar stock"
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-slate-500">
            <span>{products.length} producto(s)</span>
            <span className="hidden sm:inline">Cantidades leídas de stock.quant · Odoo</span>
          </div>
        </section>

        <div className="space-y-5">
          <section className="surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Ubicaciones</h2>
              <span className="label">Internas</span>
            </div>
            <div className="mt-3 space-y-2">
              {locations.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-slate-500">
                  {loading ? 'Cargando almacenes…' : 'Sin ubicaciones internas en Odoo.'}
                </p>
              ) : (
                locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">{shortLocation(location.complete_name)}</p>
                      <p className="truncate font-mono text-[10px] text-slate-500">{location.complete_name}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="surface border-gold-500/15 p-4">
            <div className="flex items-center gap-2 text-gold-300">
              <ArrowDownToLine className="h-4 w-4" aria-hidden />
              <h2 className="text-sm font-semibold">Entradas y ajustes</h2>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-400">
              Cada ajuste fija la cantidad exacta en la ubicación elegida y se aplica como inventario
              físico (<span className="font-mono text-[10.5px] text-slate-300">action_apply_inventory</span>).
              Odoo registra el movimiento y actualiza la existencia a mano.
            </p>
          </section>
        </div>
      </div>

      <AdjustStockModal
        product={selected}
        locations={locations}
        currency={currency}
        onClose={() => setSelected(null)}
        onDone={handleAdjusted}
      />
    </div>
  );
}

function AdjustStockModal({
  product,
  locations,
  currency,
  onClose,
  onDone,
}: {
  product: Product | null;
  locations: StockLocation[];
  currency: string;
  onClose: () => void;
  onDone: (productName: string) => void;
}) {
  const { client } = useSession();
  const toast = useToast();

  const [locationId, setLocationId] = useState<number>(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [value, setValue] = useState('0');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setLocationId(locations[0]?.id ?? 0);
  }, [product, locations]);

  useEffect(() => {
    if (!product || !locationId) return;
    let active = true;
    setLoading(true);
    setCurrent(null);

    inventory
      .listQuants(client, product.id)
      .then((quants) => {
        if (!active) return;
        const match = quants.find((quant) => Array.isArray(quant.location_id) && quant.location_id[0] === locationId);
        const quantity = match?.quantity ?? 0;
        setCurrent(quantity);
        setValue(String(quantity));
      })
      .catch((cause) => {
        if (active) toast.error('No se pudo leer la ubicación', friendlyMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [client, product, locationId, toast]);

  const numericValue = Number.parseFloat(value);
  const delta = current !== null && Number.isFinite(numericValue) ? numericValue - current : 0;

  const nudge = (amount: number) => {
    const base = Number.isFinite(numericValue) ? numericValue : 0;
    setValue(String(Math.max(0, base + amount)));
  };

  const submit = async () => {
    if (!product) return;
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast.error('Cantidad inválida', 'Ingresa un número mayor o igual a cero.');
      return;
    }

    setSaving(true);
    try {
      await inventory.setStockQuantity(client, {
        productId: product.id,
        locationId,
        quantity: numericValue,
      });
      onDone(product.name);
    } catch (cause) {
      toast.error('No se pudo ajustar el stock', friendlyMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title="Ajuste de inventario"
      description="Fija la cantidad exacta del producto en la ubicación seleccionada."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={saving} disabled={loading || !locationId}>
            Guardar ajuste
          </Button>
        </>
      }
    >
      {product ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-300">
              <Package className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{product.name}</p>
              <p className="font-mono text-[11px] text-slate-500">
                {displayCode(product.default_code)} · precio {formatMoney(product.list_price, currency)}
              </p>
            </div>
          </div>

          <Select
            label="Ubicación"
            value={locationId}
            onChange={(event) => setLocationId(Number(event.target.value))}
            disabled={locations.length === 0}
          >
            {locations.length === 0 ? <option value={0}>Sin ubicaciones</option> : null}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.complete_name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
              <p className="label">Cantidad actual</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {loading ? <Spinner /> : formatQty(current ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-gold-500/20 bg-gold-500/[0.06] px-3.5 py-3">
              <p className="label text-gold-300/80">Diferencia</p>
              <p className="mt-1 text-lg font-semibold text-gold-300">
                {delta > 0 ? '+' : ''}
                {formatQty(delta)}
              </p>
            </div>
          </div>

          <div>
            <Input
              label="Nueva cantidad"
              type="number"
              min={0}
              step="1"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={loading}
              className="font-mono text-base"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => nudge(-5)} icon={<Minus className="h-3 w-3" />}>
                5
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nudge(-1)} icon={<Minus className="h-3 w-3" />}>
                1
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nudge(1)} icon={<Plus className="h-3 w-3" />}>
                1
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nudge(5)} icon={<Plus className="h-3 w-3" />}>
                5
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setValue('0')}>
                Poner en 0
              </Button>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            El ajuste se contabiliza en Odoo como inventario físico. Si el producto tiene movimientos
            pendientes, revisa las reservas antes de continuar.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
