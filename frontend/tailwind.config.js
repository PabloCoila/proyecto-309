/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070A0F',
          900: '#0C1118',
          800: '#111826',
          700: '#182132',
          600: '#223047',
        },
        gold: {
          200: '#F7EDD3',
          300: '#F0DCAC',
          400: '#E4C77E',
          500: '#D8B45F',
          600: '#B8933F',
          700: '#8F7030',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 18px 50px -20px rgba(216, 180, 95, 0.45)',
        panel: '0 30px 80px -40px rgba(0, 0, 0, 0.9)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(7,10,15,0) 0%, rgba(7,10,15,0.6) 55%, #070A0F 100%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: 'auto, 46px 46px, 46px 46px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};
