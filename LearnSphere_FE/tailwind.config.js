/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      colors: {
        surface: '#0d131f',
        surfaceLow: '#161c28',
        surfaceContainer: '#1a202c',
        surfaceHigh: '#242a37',
        surfaceHighest: '#2f3542',
        outline: '#8b90a0',
        outlineVariant: '#414754',
        primary: '#adc7ff',
        primaryStrong: '#4a8eff',
        secondary: '#ffc080',
        tertiary: '#24dfba',
        error: '#ffb4ab',
        onPrimary: '#002e68',
        onSurface: '#dde2f4',
        onSurfaceVariant: '#c1c6d7',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(173, 199, 255, 0.12), 0 24px 60px rgba(0, 0, 0, 0.35)',
        card: '0 18px 42px rgba(0, 0, 0, 0.22)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
