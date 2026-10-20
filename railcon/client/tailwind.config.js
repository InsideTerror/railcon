/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        rail: {
          bg: '#0a0a0a',
          panel: '#111111',
          border: '#2a2a2a',
          borderBright: '#3a3a3a',
          text: '#ffffff',
          textMuted: '#888888',
          textDim: '#555555',
          gold: '#ffd700',
          goldDim: '#ccaa00',
          green: '#00cc44',
          greenDim: '#009933',
          yellow: '#ffaa00',
          red: '#ff3333',
          redDim: '#cc2222',
          blue: '#0088ff',
          blueDim: '#0066cc'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        ui: ['"Inter"', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'xs': ['0.7rem', { lineHeight: '1rem' }],
        'sm': ['0.8rem', { lineHeight: '1.2rem' }],
        'base': ['0.9rem', { lineHeight: '1.4rem' }],
        'lg': ['1.1rem', { lineHeight: '1.6rem' }],
        'xl': ['1.3rem', { lineHeight: '1.8rem' }],
        '2xl': ['1.6rem', { lineHeight: '2.2rem' }],
        '3xl': ['2rem', { lineHeight: '2.6rem' }],
        '4xl': ['2.5rem', { lineHeight: '3rem' }],
        '5xl': ['3.5rem', { lineHeight: '4rem' }]
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem'
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.3)',
        'glow-green': '0 0 15px rgba(0, 204, 68, 0.4)',
        'glow-red': '0 0 15px rgba(255, 51, 51, 0.4)',
        'inner-glow': 'inset 0 0 20px rgba(255, 215, 0, 0.1)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1s step-end infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out'
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
};
