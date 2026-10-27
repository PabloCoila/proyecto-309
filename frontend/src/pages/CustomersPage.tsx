import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Crown,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { EmptyState, Stat, TableSkeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/context/session';
import { useDebouncedValue } from '@/lib/hooks';
import { displayCode, initials } from '@/lib/format';
import { friendlyMessage, partners } from '@/lib/odoo';
import type { Partner } from '@/lib/odoo';

type Tab = 'all' | 'frequent';

export function CustomersPage() {
  const { client } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const [rows, setRows] = useState<Partner[]>([]);
  const [frequent, setFrequent] = useState<Partner[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data =
        tab === 'frequent'
          ? await partners.listFrequentPartners(client, 15)
          : await partners.listPartners(client, { search: debouncedSearch, limit: 120 });
      setRows(data);
    } catch (cause) {
      setError(friendlyMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [client, tab, debouncedSearch]);

  const loadFrequent = useCallback(async () => {
    try {
      setFrequent(await partners.listFrequentPartners(client, 4));
    } catch {
      setFrequent([]);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadFrequent();
  }, [loadFrequent]);

  const handleCreated = () => {
    setNewOpen(false);
    toast.success('Cliente creado', 'El contacto quedó registrado en Odoo.');
    setTab('all');
    setSearch('');
    void load();
    void loadFrequent();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-gold-400/80">Apartado 2</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">Gestión de clientes</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            Cartera de <span className="font-mono text-[12px]">res.partner</span> con ranking de compras por cliente.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} icon={<UserPlus className="h-4 w-4" />}>
          Nuevo cliente
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Clientes registrados"
          value={loading && rows.length === 0 ? '—' : rows.length}
          icon={<Users className="h-4 w-4" />}
          hint={tab === 'frequent' ? 'vista de frecuentes' : 'con customer_rank > 0'}
        />
        <Stat
          label="Compras acumuladas"
          value={rows.reduce((total, row) => total + (row.sale_order_count ?? 0), 0)}
          icon={<ReceiptText className="h-4 w-4" />}
          hint="pedidos de venta asociados"
        />
        <Stat
          label="Compras del cliente top"
          value={frequent[0] ? frequent[0].sale_order_count ?? 0 : '—'}
          icon={<Crown className="h-4 w-4" />}
          accent
          hint={frequent[0]?.name ?? 'sin ventas registradas'}
        />
      </div>

      {/* Clientes más frecuentes */}
      <section className="surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-gold-400" aria-hidden />
            <h2 className="text-sm font-semibold text-white">Clientes más frecuentes</h2>
          </div>
          <span className="label hidden sm:inline">por pedidos de venta</span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {frequent.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-500">
              Aún no hay historial de compras. El ranking se calcula con <span className="font-mono">sale_order_count</span>.
            </p>
          ) : (
            frequent.map((partner, index) => (
              <motion.div
                key={partner.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10 text-[11px] font-semibold text-gold-300">
                    {initials(partner.name)}
                  </span>
                  <Badge tone="gold">
                    <Crown className="h-3 w-3" aria-hidden />
                    {partner.sale_order_count ?? 0}
                  </Badge>
                </div>
                <p className="mt-2.5 truncate text-[13px] font-medium text-white">{partner.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{partner.email || partner.phone || 'Sin contacto'}</p>
                <button
                  type="button"
                  onClick={() => navigate(`/ventas?cliente=${partner.id}`)}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-gold-300 transition hover:text-gold-200"
                >
                  Facturar
                  <ReceiptText className="h-3 w-3" aria-hidden />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
          <div className="inline-flex rounded-lg border border-white/10 bg-ink-950/50 p-0.5">
            {(
              [
                { id: 'all', label: 'Todos', icon: Users },
                { id: 'frequent', label: 'Frecuentes', icon: Crown },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTab(option.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  tab === option.id ? 'bg-gold-500/15 text-gold-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <option.icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </button>
            ))}
          </div>

          <div className="min-w-[200px] flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, email, teléfono o NIT…"
              icon={<Search className="h-4 w-4" />}
              className="h-9 py-0"
              aria-label="Buscar clientes"
              disabled={tab === 'frequent'}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            loading={loading}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : error ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No se pudo leer la cartera"
            description={error}
            action={
              <Button variant="secondary" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>
                Reintentar
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<UserRound className="h-6 w-6" />}
            title="Sin clientes"
            description={
              tab === 'frequent'
                ? 'Todavía no hay clientes con pedidos de venta confirmados.'
                : 'Crea tu primer cliente para empezar a facturar.'
            }
            action={
              <Button onClick={() => setNewOpen(true)} icon={<Plus className="h-4 w-4" />}>
                Nuevo cliente
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">NIT / CI</th>
                  <th className="px-4 py-2.5 font-medium">Ciudad</th>
                  <th className="px-4 py-2.5 text-right font-medium">Compras</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((partner) => (
                  <tr key={partner.id} className="row-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-slate-300">
                          {initials(partner.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium text-slate-100">
                            {partner.name}
                            {partner.is_company ? <Building2 className="h-3 w-3 text-slate-500" aria-hidden /> : null}
                          </p>
                          <p className="truncate text-[10.5px] text-slate-500">
                            {partner.is_company ? 'Empresa' : 'Persona'} · ID {partner.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-[11.5px] text-slate-400">
                        {partner.email ? (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3 text-slate-600" aria-hidden />
                            {partner.email}
                          </p>
                        ) : null}
                        {partner.phone ? (
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-600" aria-hidden />
                            {partner.phone}
                          </p>
                        ) : null}
                        {!partner.email && !partner.phone ? <span className="text-slate-600">—</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-slate-400">{displayCode(partner.vat)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-400">
                        <MapPin className="h-3 w-3 text-slate-600" aria-hidden />
                        {partner.city || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone={(partner.sale_order_count ?? 0) > 0 ? 'gold' : 'neutral'}>
                        {partner.sale_order_count ?? 0}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/ventas?cliente=${partner.id}`)}
                        icon={<ReceiptText className="h-3.5 w-3.5" />}
                      >
                        Facturar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-slate-500">
          <span>{rows.length} cliente(s)</span>
          <span className="hidden sm:inline">res.partner · customer_rank &gt; 0</span>
        </div>
      </section>

      <NewClientModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={handleCreated} />
    </div>
  );
}

function NewClientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { client } = useSession();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vat, setVat] = useState('');
  const [city, setCity] = useState('');
  const [isCompany, setIsCompany] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPhone('');
    setVat('');
    setCity('');
    setIsCompany(false);
    setErrors({});
  }, [open]);

  const submit = async () => {
    const nextErrors: { name?: string; email?: string } = {};
    if (!name.trim()) nextErrors.name = 'El nombre es obligatorio.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Ingresa un correo válido.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await partners.createPartner(client, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        vat: vat.trim() || undefined,
        city: city.trim() || undefined,
        isCompany,
      });
      onCreated();
    } catch (cause) {
      toast.error('No se pudo crear el cliente', friendlyMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo cliente"
      description="Alta rápida en res.partner con customer_rank = 1."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            Crear cliente
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nombre *"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre o razón social"
          error={errors.name}
          autoFocus
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="compras@empresa.com"
            error={errors.email}
          />
          <Input
            label="Teléfono"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+591 700 00000"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="NIT / CI" value={vat} onChange={(event) => setVat(event.target.value)} placeholder="1023456789" />
          <Input label="Ciudad" value={city} onChange={(event) => setCity(event.target.value)} placeholder="La Paz" />
        </div>

        <Select
          label="Tipo de contacto"
          value={isCompany ? 'company' : 'person'}
          onChange={(event) => setIsCompany(event.target.value === 'company')}
        >
          <option value="person">Persona</option>
          <option value="company">Empresa</option>
        </Select>
      </div>
    </Modal>
  );
}
