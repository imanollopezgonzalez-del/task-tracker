/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FAF8F5',
          'bg-2': '#F0EDE8',
          'bg-3': '#E8E3DC',
          dark: '#1C1917',
          'dark-2': '#292524',
          'dark-3': '#3C3530',
          orange: '#D97757',
          'orange-dark': '#C4633A',
          'orange-light': '#F8EDE6',
          text: '#1C1917',
          'text-muted': '#78716C',
          'text-light': '#A8A29E',
          border: '#E7E2DA',
          'border-dark': '#D4CEC5',
        },
        priority: {
          urgent: '#DC2626',
          'urgent-bg': '#FEF2F2',
          'urgent-border': '#FECACA',
          important: '#D97757',
          'important-bg': '#FEF3EC',
          'important-border': '#FBD0B7',
          low: '#16A34A',
          'low-bg': '#F0FDF4',
          'low-border': '#BBF7D0',
        },
        task: {
          'not-started': '#94A3B8',
          'not-started-bg': '#F8FAFC',
          'in-progress': '#3B82F6',
          'in-progress-bg': '#EFF6FF',
          'pending-response': '#F59E0B',
          'pending-response-bg': '#FFFBEB',
          'pending-adjustments': '#F97316',
          'pending-adjustments-bg': '#FFF7ED',
          done: '#22C55E',
          'done-bg': '#F0FDF4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
        modal: '0 20px 60px -10px rgba(0,0,0,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
}
