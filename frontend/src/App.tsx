import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { BrandMark } from '@/components/Logo';
import { useSession } from '@/context/session';
import { LoginPage } from '@/pages/LoginPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { SalesPage } from '@/pages/SalesPage';

function Splash({ onRetry }: { onRetry?: () => void }) {
  const showRetry = Boolean(onRetry);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950 px-4">
      <motion.div
        animate={showRetry ? undefined : { scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandMark size={56} />
      </motion.div>
      <div className="text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-petrol-900">Neru</p>
        <p className="mt-1 text-[11px] text-slate-600">
          {showRetry ? 'No se pudo conectar con Odoo' : 'Restaurando sesión con Odoo…'}
        </p>
        {showRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-2 text-sm font-medium text-gold-700 transition hover:bg-gold-500/20"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Reintentar conexión
          </button>
        )}
      </div>
    </div>
  );
}

function ProtectedShell() {
  const { status, client } = useSession();
  const [retrying, setRetrying] = useState(false);

  if (status === 'restoring') {
    const handleRetry = async () => {
      setRetrying(true);
      try {
        // Intentar login silencioso de nuevo usando credenciales guardadas
        const { loadSession } = await import('@/lib/odoo/session');
        const { auth } = await import('@/lib/odoo');
        const { getCompanyInfo } = await import('@/lib/odoo/services/company');
        const stored = loadSession();
        if (stored) {
          await client.login(stored.login, stored.password);
          const currentUser = await auth.getCurrentUser(client, client.uid ?? stored.uid);
          await getCompanyInfo(client, Array.isArray(currentUser.company_id) ? currentUser.company_id[0] : null);
          // El contexto se actualiza solo via useSession
        }
      } catch {
        // El useEffect de session.tsx manejará el estado
      } finally {
        setRetrying(false);
      }
    };
    return <Splash onRetry={retrying ? undefined : handleRetry} />;
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/inventario" element={<InventoryPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/ventas" element={<SalesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/inventario" replace />} />
    </Routes>
  );
}
