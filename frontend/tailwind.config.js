/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superficies claras. La clave "ink" se conserva para no tocar las
        // clases existentes: antes era el fondo oscuro y ahora es blanco.
        ink: {
          950: '#FFFFFF', // fondo puro
          900: '#FFFFFF', // tarjetas, sidebar y modales
          800: '#F8FAFC', // superficies elevadas
          700: '#F1F5F9',
          600: '#E2E8F0',
        },
        // Marca principal: teal / cian oscuro vibrante.
        // "gold" es el alias histórico de todos los acentos de la app.
        gold: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#0F766E',
          400: '#0D9488',
          500: '#0F766E',
          600: '#115E59',
          700: '#134E4A',
        },
        // Alias de compatibilidad para clases purple-* heredadas.
        purple: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#0F766E',
          400: '#0D9488',
          500: '#0F766E',
          600: '#115E59',
          700: '#134E4A',
        },
        // Secundario: azul petróleo / azul profundo.
        petrol: {
          50: '#F1F5F9',
          100: '#E2E8F0',
          200: '#CBD5E1',
          300: '#94A3B8',
          400: '#64748B',
          500: '#334155',
          600: '#1E3A5F',
          700: '#16304F',
          800: '#0F2742',
          900: '#0B1F33',
          950: '#07182B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 18px 50px -22px rgba(15, 118, 110, 0.35)',
        panel: '0 24px 60px -36px rgba(11, 31, 51, 0.22)',
        card: '0 1px 2px rgba(11, 31, 51, 0.04), 0 14px 34px -26px rgba(11, 31, 51, 0.20)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(circle at 50% 0%, rgba(13,148,136,0.10), rgba(255,255,255,0) 58%), linear-gradient(rgba(11,31,51,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(11,31,51,0.045) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: 'auto, 46px 46px, 46px 46px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
