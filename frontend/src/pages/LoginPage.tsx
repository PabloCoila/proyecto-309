import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Boxes,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ReceiptText,
  ShieldCheck,
  User,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BrandLockup, BrandMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/context/session';
import { auth, DEMO_CREDENTIALS, friendlyMessage, getOdooClient } from '@/lib/odoo';

type ConnectionState = { state: 'checking' | 'online' | 'offline'; version?: string };

const FEATURES = [
  { icon: Boxes, title: 'Stock en vivo', text: 'Existencias, ubicaciones y ajustes contra Odoo.' },
  { icon: Users, title: 'Cartera inteligente', text: 'Clientes y ranking de los más frecuentes.' },
  { icon: ReceiptText, title: 'Facturas al instante', text: 'Comprobante PDF con la marca Proyecto 309.' },
] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

export function LoginPage() {
  const { login, status } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const client = getOdooClient();

  const [username, setUsername] = useState<string>(DEMO_CREDENTIALS.login);
  const [password, setPassword] = useState<string>(DEMO_CREDENTIALS.password);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>({ state: 'checking' });

  useEffect(() => {
    let active = true;
    setConnection({ state: 'checking' });
    auth
      .ping(client)
      .then((version) => {
        if (active) setConnection({ state: 'online', version });
      })
      .catch(() => {
        if (active) setConnection({ state: 'offline' });
      });
    return () => {
      active = false;
    };
  }, [client]);

  if (status === 'authenticated') return <Navigate to="/inventario" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ login: username.trim(), password });
      toast.success('Bienvenido a Proyecto 309', 'Sesión iniciada contra Odoo.');
      navigate('/inventario', { replace: true });
    } catch (cause) {
      setError(friendlyMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setUsername(DEMO_CREDENTIALS.login);
    setPassword(DEMO_CREDENTIALS.password);
    setError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* Fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-10%] h-[520px] w-[520px] rounded-full bg-gold-500/[0.09] blur-[130px]" />
        <div className="absolute right-[-10%] top-[30%] h-[420px] w-[420px] rounded-full bg-emerald-500/[0.06] blur-[140px]" />
        <div className="absolute inset-0 bg-grid-fade bg-grid opacity-70" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* Panel de marca */}
        <aside className="hidden flex-col justify-between border-r border-white/[0.05] p-12 lg:flex xl:p-16">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <BrandLockup markSize={44} subtitle="Sistema de inventario y punto de venta" />
          </motion.div>

          <motion.div variants={container} initial="hidden" animate="show" className="max-w-[520px]">
            <motion.p variants={item} className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/[0.07] px-3 py-1 text-[11px] font-medium tracking-wide text-gold-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Arquitectura headless · datos en tu equipo
            </motion.p>

            <motion.h1 variants={item} className="text-balance text-[44px] font-semibold leading-[1.05] tracking-tight text-white xl:text-[54px]">
              Cada unidad, cada venta,
              <span className="gold-text"> bajo control.</span>
            </motion.h1>

            <motion.p variants={item} className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-slate-400">
              Interfaz propia para tu Odoo Community local: inventario en tiempo real, clientes
              recurrentes y facturación con comprobante PDF inmediato.
            </motion.p>

            <motion.ul variants={item} className="mt-10 space-y-4">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-gold-300">
                    <feature.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{feature.title}</p>
                    <p className="text-xs text-slate-500">{feature.text}</p>
                  </div>
                </li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-600"
          >
            <span>Odoo 17</span>
            <span className="h-1 w-1 rounded-full bg-slate-700" />
            <span>React + Vite</span>
            <span className="h-1 w-1 rounded-full bg-slate-700" />
            <span>Local first</span>
          </motion.div>
        </aside>

        {/* Panel de acceso */}
        <main className="flex items-center justify-center px-5 py-10 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px]"
          >
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandLockup markSize={44} subtitle="Inventario & Punto de Venta" />
            </div>

            <div className="surface relative overflow-hidden p-7 sm:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />

              <div className="mb-7">
                <p className="label text-gold-400/80">Acceso al sistema</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white">Inicia sesión</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                  Autenticación real contra la API JSON-RPC de tu Odoo local.
                </p>
              </div>

              {/* Credenciales de prueba */}
              <div className="mb-6 rounded-xl border border-dashed border-gold-500/25 bg-gold-500/[0.05] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold-300/90">
                    Credenciales de prueba
                  </p>
                  <button
                    type="button"
                    onClick={fillDemo}
                    className="rounded-md border border-gold-500/30 px-2 py-1 text-[10.5px] font-medium text-gold-300 transition hover:bg-gold-500/10"
                  >
                    Autocompletar
                  </button>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-3 font-mono text-[12px] text-slate-300">
                  <div>
                    <p className="text-[9.5px] uppercase tracking-wider text-slate-500">Usuario</p>
                    <p>{DEMO_CREDENTIALS.login}</p>
                  </div>
                  <div>
                    <p className="text-[9.5px] uppercase tracking-wider text-slate-500">Contraseña</p>
                    <p>{DEMO_CREDENTIALS.password}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] text-slate-500">
                  Base de datos: <span className="font-mono text-slate-400">{DEMO_CREDENTIALS.db}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                  label="Usuario"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  spellCheck={false}
                  icon={<User className="h-4 w-4" />}
                  disabled={submitting}
                />

                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  icon={<Lock className="h-4 w-4" />}
                  disabled={submitting}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="rounded-md p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {error ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    aria-live="polite"
                    className="rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-3.5 py-2.5 text-xs leading-relaxed text-rose-200"
                  >
                    {error}
                  </motion.div>
                ) : null}

                <Button type="submit" size="lg" full loading={submitting} icon={<ArrowRight className="h-4 w-4" />}>
                  {submitting ? 'Conectando con Odoo…' : 'Entrar a Proyecto 309'}
                </Button>
              </form>

              <div className="mt-6 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-[11px]">
                {connection.state === 'checking' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                    <span className="text-slate-500">Verificando conexión…</span>
                  </>
                ) : connection.state === 'online' ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-slate-400">
                      Odoo <span className="font-mono text-slate-300">{connection.version}</span> · servidor local activo
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-slate-400">
                      Sin respuesta en <span className="font-mono">localhost:8069</span> — inicia Docker
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2.5 text-[11px] text-slate-600">
              <BrandMark size={16} className="opacity-70" />
              <span>Proyecto 309 © {new Date().getFullYear()} · Instalación local</span>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
