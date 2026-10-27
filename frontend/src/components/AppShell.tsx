import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, Building2, LogOut, Menu, ReceiptText, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { BrandLockup } from '@/components/Logo';
import { useSession } from '@/context/session';
import { initials, todayLong } from '@/lib/format';

const NAV = [
  {
    to: '/inventario',
    label: 'Inventario',
    description: 'Stock, productos y almacenes',
    icon: Boxes,
  },
  {
    to: '/clientes',
    label: 'Clientes',
    description: 'Cartera y clientes frecuentes',
    icon: Users,
  },
  {
    to: '/ventas',
    label: 'Facturación',
    description: 'Punto de venta y comprobantes',
    icon: ReceiptText,
  },
] as const;

function SidebarContent({ onNavigate, idPrefix }: { onNavigate?: () => void; idPrefix: string }) {
  const { user, logout, client } = useSession();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <BrandLockup markSize={40} />
      </div>

      <div className="px-5">
        <p className="label">Operación</p>
      </div>

      <nav className="mt-3 flex-1 space-y-1 px-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
                isActive ? 'text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <motion.span
                    layoutId={`${idPrefix}-nav-active`}
                    className="absolute inset-0 rounded-xl border border-gold-500/25 bg-gradient-to-r from-gold-500/[0.14] to-transparent"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                ) : null}
                <span
                  className={clsx(
                    'relative mt-0.5 rounded-lg border p-1.5 transition-colors',
                    isActive
                      ? 'border-gold-500/30 bg-gold-500/10 text-gold-300'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 group-hover:text-slate-200',
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="relative min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-[11px] text-slate-500">{item.description}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-[11px] font-semibold text-gold-300">
            {initials(user?.name ?? 'Proyecto 309')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{user?.name ?? 'Operador'}</p>
            <p className="flex items-center gap-1 truncate text-[10.5px] text-slate-500">
              <Building2 className="h-3 w-3 shrink-0" aria-hidden />
              {client.db}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
          Proyecto 309 · v1.0 — Odoo Community (JSON-RPC)
        </p>
      </div>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, company, currency } = useSession();

  const active = NAV.find((item) => location.pathname.startsWith(item.to)) ?? NAV[0];

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-ink-950">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-white/[0.06] bg-ink-900/50 backdrop-blur-xl lg:block">
        <SidebarContent idPrefix="desktop" />
      </aside>

      {/* Drawer móvil */}
      <AnimatePresence>
        {drawerOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="relative flex h-full w-[272px] flex-col border-r border-white/10 bg-ink-900"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent idPrefix="mobile" onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-slate-300 lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold text-white">{active.label}</h1>
                <span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500 sm:inline">
                  {currency}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-500">{active.description}</p>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 md:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-medium text-emerald-300">Odoo conectado</span>
            </div>

            <div className="hidden text-right lg:block">
              <p className="text-[11px] font-medium text-slate-300">{company?.name ?? 'Proyecto 309'}</p>
              <p className="text-[10px] text-slate-500">{todayLong()}</p>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-gold-300">
              {initials(user?.name ?? 'P309')}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
