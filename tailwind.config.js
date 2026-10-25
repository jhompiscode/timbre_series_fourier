/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: '#0a0f0d',
          panel: '#0f1714',
          surface: '#14201b',
          border: '#1f332b',
          phosphor: '#00ff9d',
          phosphorDim: '#00b871',
          amber: '#ffb300',
          amberDim: '#cc8f00',
          cyan: '#00e5ff',
          danger: '#ff3d57'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif']
      }
    },
  },
  plugins: [],
}
