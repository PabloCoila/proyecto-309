import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { BrandMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/context/session';
import { DEMO_AUTOFILL, DEMO_CREDENTIALS, friendlyMessage } from '@/lib/odoo';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const LETTERS = ['N', 'E', 'R', 'U'];

export function LoginPage() {
  const { login, status } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const [username, setUsername] = useState<string>(DEMO_AUTOFILL ? DEMO_CREDENTIALS.login : '');
  const [password, setPassword] = useState<string>(DEMO_AUTOFILL ? DEMO_CREDENTIALS.password : '');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      toast.success('Bienvenido a Neru', 'Sesión iniciada contra Odoo.');
      navigate('/inventario', { replace: true });
    } catch (cause) {
      setError(friendlyMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-10">
      {/* Fondo animado */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-[-18%] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-gold-200 blur-[150px]"
        />
        <motion.div
          animate={{ scale: [1, 1.14, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          className="absolute bottom-[-22%] right-[-10%] h-[480px] w-[480px] rounded-full bg-petrol-200 blur-[160px]"
        />
        <div className="absolute inset-0 bg-grid-fade bg-grid opacity-70" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-[430px]"
      >
        {/* Marca animada */}
        <motion.div variants={item} className="mb-8 flex flex-col items-center text-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-5"
          >
            <BrandMark size={64} />
          </motion.div>

          <div className="flex items-end justify-center gap-1">
            {LETTERS.map((letter, index) => (
              <motion.span
                key={letter}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={`text-[52px] font-black leading-none tracking-tighter ${
                  index % 2 === 0 ? 'text-petrol-900' : 'text-gold-500'
                }`}
              >
                {letter}
              </motion.span>
            ))}
          </div>

          <motion.p variants={item} className="mt-3 text-[11px] uppercase tracking-[0.32em] text-slate-500">
            Inventario & Punto de Venta
          </motion.p>
        </motion.div>

        {/* Tarjeta de acceso */}
        <motion.div variants={item} className="surface relative overflow-hidden p-7 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent" />

          <div className="mb-6 text-center">
            <h1 className="text-[22px] font-semibold tracking-tight text-petrol-900">Inicia sesión</h1>
            <p className="mt-1 text-[13px] text-slate-500">Accede a tu sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <motion.div variants={item}>
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
            </motion.div>

            <motion.div variants={item}>
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
                    className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </motion.div>

            {error ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-700"
              >
                {error}
              </motion.div>
            ) : null}

            <motion.div variants={item}>
              <Button type="submit" size="lg" full loading={submitting} icon={<ArrowRight className="h-4 w-4" />}>
                {submitting ? 'Conectando…' : 'Entrar'}
              </Button>
            </motion.div>
          </form>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500"
        >
          <BrandMark size={14} className="opacity-70" />
          <span>Neru © {new Date().getFullYear()}</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
