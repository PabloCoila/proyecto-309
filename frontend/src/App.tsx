import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { BrandMark } from '@/components/Logo';
import { useSession } from '@/context/session';
import { LoginPage } from '@/pages/LoginPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { SalesPage } from '@/pages/SalesPage';

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950">
      <motion.div
        animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandMark size={56} />
      </motion.div>
      <div className="text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-slate-400">Proyecto 309</p>
        <p className="mt-1 text-[11px] text-slate-600">Restaurando sesión con Odoo…</p>
      </div>
    </div>
  );
}

function ProtectedShell() {
  const { status } = useSession();
  if (status === 'restoring') return <Splash />;
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
