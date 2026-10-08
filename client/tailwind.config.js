/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        },
        trade: {
          up: '#22c55e',
          down: '#ef4444',
          warning: '#f59e0b',
          blue: '#3b82f6'
        },
        dark: {
          bg: '#0b0e14',
          card: '#151922',
          surface: '#1c2230',
          border: '#2a324b'
        }
      },
      fontFamily: {
        mono: ['SF Mono', 'Fira Code', 'Roboto Mono', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
};
