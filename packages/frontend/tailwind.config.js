/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1e293b', // slate-800
        'surface-raised': '#334155', // slate-700
        border: '#475569', // slate-600
        accent: '#22d3ee', // cyan-400
        'text-primary': '#f1f5f9', // slate-100
        'text-muted': '#94a3b8',   // slate-400
      },
      spacing: {
        page: '1.5rem', // p-6 / gap-6
        card: '1rem',   // p-4 / gap-4
        section: '1.5rem',
      },
      boxShadow: {
        card: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', // shadow-lg
        modal: '0 25px 50px -12px rgb(0 0 0 / 0.25)', // shadow-2xl
      },
    },
  },
  plugins: [],
};
