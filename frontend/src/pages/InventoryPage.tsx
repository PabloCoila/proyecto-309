import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
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
import { Thumb } from '@/components/ui/Thumb';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/context/session';
import { useSearch } from '@/lib/hooks';
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
  const [alerts, setAlerts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState('');
  const [onlyStock, setOnlyStock] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [newProductOpen, setNewProductOpen] = useState(false);

  const { data: searchedProducts, loading: searchLoading, error: searchError } = useSearch(
    useCallback(async (_signal, query) => {
      return inventory.listProducts(client, {
        search: query,
        onlyWithStock: onlyStock,
        stockableOnly: true,
        limit: 120,
      });
    }, [client, onlyStock]),
    search,
    300,
  );

  // Usar productos buscados o mantener los últimos si no hay búsqueda
  const displayProducts = search.trim() ? (searchedProducts ?? []) : products;

  const fetchProducts = useCallback(
    async (notify = false) => {
      try {
        const data = await inventory.listProducts(client, {
          onlyWithStock: onlyStock,
          stockableOnly: true,
          limit: 120,
        });
        setProducts(data);
      } catch (cause) {
        // No mostrar error si es solo carga inicial
      }
      if (notify) setRefreshing(false);
    },
    [client, onlyStock],
  );

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const loadAlerts = useCallback(async () => {
    try {
      // shortcut: tope de 20 alertas; si el catálogo crece, paginar o enlazar al listado filtrado.
      const data = await inventory.listProducts(client, {
        maxFreeQty: 5,
        stockableOnly: true,
        limit: 20,
      });
      setAlerts([...data].sort((a, b) => a.free_qty - b.free_qty));
    } catch {
      /* el listado principal ya muestra el error de conexión */
    }
  }, [client]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

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
      loadAlerts(),
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

  const handleProductCreated = () => {
    setNewProductOpen(false);
    toast.success('Producto creado', 'El producto quedó registrado en Odoo.');
    void refreshAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-petrol-900">Inventario y almacén</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setNewProductOpen(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            Agregar producto
          </Button>
          <Button
            variant="secondary"
            onClick={() => void refreshAll()}
            loading={refreshing}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Productos almacenables"
          value={summary ? summary.products : '—'}
          icon={<Package className="h-4 w-4" />}
        />
        <Stat
          label="Referencias con stock"
          value={summary ? summary.quants : '—'}
          icon={<Boxes className="h-4 w-4" />}
        />
        <Stat
          label="Ubicaciones internas"
          value={summary ? summary.locations : '—'}
          icon={<Warehouse className="h-4 w-4" />}
          accent
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3.5">
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
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300"
            >
              <span
                className={`relative h-4 w-7 rounded-full transition-colors ${onlyStock ? 'bg-gold-500' : 'bg-slate-200'}`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${onlyStock ? 'left-3.5' : 'left-0.5'}`}
                />
              </span>
              Solo con stock
            </button>
          </div>

          {search.trim() && searchLoading ? (
            <TableSkeleton rows={7} cols={5} />
          ) : search.trim() && searchError ? (
            <EmptyState
              icon={<Boxes className="h-6 w-6" />}
              title="Error en la búsqueda"
              description={friendlyMessage(searchError)}
              action={
                <Button variant="secondary" onClick={() => setSearch(search)} icon={<RefreshCw className="h-4 w-4" />}>
                  Reintentar
                </Button>
              }
            />
          ) : displayProducts.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={search.trim() ? 'Sin coincidencias' : 'Sin productos para mostrar'}
              description={search.trim()
                ? 'No se encontraron productos con ese criterio.'
                : 'Crea productos en Odoo o ajusta la búsqueda. Los productos de tipo servicio no aparecen en inventario.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-2.5 font-medium">Producto</th>
                    <th className="px-3 py-2.5 font-medium">Categoría</th>
                    <th className="px-3 py-2.5 text-right font-medium">En mano</th>
                    <th className="px-3 py-2.5 text-right font-medium">Disponible</th>
                    <th className="px-3 py-2.5 text-right font-medium">Precio</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayProducts.map((product) => {
                    const category = Array.isArray(product.categ_id) ? product.categ_id[1] : 'Sin categoría';
                    const uom = Array.isArray(product.uom_id) ? product.uom_id[1] : 'u.';
                    const hasStock = product.qty_available > 0;

                    return (
                      <motion.tr
                        key={product.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="row-hover"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb
                              base64={product.image_128}
                              className="h-9 w-9"
                              fallback={<Package className="h-4 w-4" aria-hidden />}
                            />
                            <div className="min-w-0 max-w-[220px]">
                              <p className="truncate font-medium text-slate-900">{product.name}</p>
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
                          <span className={`font-semibold ${hasStock ? 'text-slate-900' : 'text-slate-500'}`}>
                            {formatQty(product.qty_available)}
                          </span>
                          <span className="ml-1 text-[10.5px] text-slate-500">{uom}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Badge tone={product.free_qty <= 0 ? 'danger' : product.free_qty <= 5 ? 'warning' : 'success'}>
                            {formatQty(product.free_qty)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">
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

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-500">
            <span>{displayProducts.length} producto(s)</span>
          </div>
        </section>

        <div className="space-y-5">
          <section className="surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Ubicaciones</h2>
            </div>
            <div className="mt-3 space-y-2">
              {locations.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-500">
                  Sin ubicaciones internas en Odoo.
                </p>
              ) : (
                locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{shortLocation(location.complete_name)}</p>
                      <p className="truncate font-mono text-[10px] text-slate-500">{location.complete_name}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                Alertas
              </h2>
              {alerts.length > 0 ? (
                <Badge tone="warning">{alerts.length === 20 ? '20+' : alerts.length}</Badge>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {alerts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-4 text-center text-[11px] text-emerald-700">
                  Sin productos con stock bajo.
                </p>
              ) : (
                alerts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition hover:border-amber-300"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{item.name}</p>
                      <p className="truncate font-mono text-[10px] text-amber-700">
                        disponible {formatQty(item.free_qty)} · mínimo 5
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
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

      <NewProductModal
        open={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        onDone={handleProductCreated}
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
  const [price, setPrice] = useState('0');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setLocationId(locations[0]?.id ?? 0);
  }, [product, locations]);

  useEffect(() => {
    if (product) setPrice(String(product.list_price));
  }, [product]);

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
  const numericPrice = Number.parseFloat(price);
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
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      toast.error('Precio inválido', 'Ingresa un precio mayor o igual a cero.');
      return;
    }

    setSaving(true);
    try {
      await inventory.setStockQuantity(client, {
        productId: product.id,
        locationId,
        quantity: numericValue,
      });
    } catch (cause) {
      toast.error('No se pudo ajustar el stock', friendlyMessage(cause));
      setSaving(false);
      return;
    }

    if (Math.abs(numericPrice - product.list_price) > 0.001) {
      try {
        await inventory.setProductPrice(client, product.id, numericPrice);
      } catch (cause) {
        toast.error('Stock ajustado, pero el precio no se actualizó', friendlyMessage(cause));
      }
    }

    setSaving(false);
    onDone(product.name);
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
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-300">
              <Package className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="label">Cantidad actual</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">
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

          <Input
            label="Precio de venta"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            disabled={loading}
            hint={`Se guarda en el catálogo de Odoo (${currency}).`}
            className="font-mono text-base"
          />

          <p className="text-[11px] leading-relaxed text-slate-500">
            El ajuste se contabiliza en Odoo como inventario físico. Si el producto tiene movimientos
            pendientes, revisa las reservas antes de continuar.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

function NewProductModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { client } = useSession();
  const toast = useToast();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<'product' | 'consu' | 'service'>('product');
  const [size, setSize] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName('');
    setCode('');
    setType('product');
    setSize('');
    setDescription('');
    setPrice('');
    setErrors({});
  }, [open]);

  const submit = async () => {
    const nextErrors: { name?: string; price?: string } = {};
    if (!name.trim()) nextErrors.name = 'El nombre es obligatorio.';
    const priceNum = Number.parseFloat(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      nextErrors.price = 'Ingresa un precio válido (mayor o igual a 0).';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await inventory.createProduct(client, {
        name: name.trim(),
        default_code: code.trim() || undefined,
        detailed_type: type,
        size: size.trim() || undefined,
        description: description.trim() || undefined,
        list_price: priceNum,
      });
      onDone();
    } catch (cause) {
      toast.error('No se pudo crear el producto', friendlyMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo producto"
      description="Registra un producto en el catálogo de Odoo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            Guardar producto
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nombre *"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre del producto"
          error={errors.name}
          autoFocus
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Etiqueta / código interno"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Ej. KB-001"
          />
          <Select label="Tipo de producto" value={type} onChange={(event) => setType(event.target.value as any)}>
            <option value="product">Almacenable</option>
            <option value="consu">Consumible</option>
            <option value="service">Servicio</option>
          </Select>
        </div>

        <Input
          label="Tamaño"
          value={size}
          onChange={(event) => setSize(event.target.value)}
          placeholder="Ej. 27 pulgadas, 2 m, talla M"
        />

        <Input
          label="Descripción"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Detalles del producto"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Precio unitario *"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
            error={errors.price}
          />
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          El producto se crea en <span className="font-mono text-[10.5px] text-slate-700">product.template</span> y
          quedará disponible para vender desde el módulo de Facturación.
        </p>
      </div>
    </Modal>
  );
}
