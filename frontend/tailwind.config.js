/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // Primary accent: sepia/tobacco — warm, analog, personal
        primary: {
          DEFAULT: '#8B6F47',
          hover: '#7A5F3A',
          light: '#F0E8DC',
          dark: '#2A1F0F',
        },
        // Neutral warm surfaces
        background: {
          light: '#F7F3EE',  // warm paper
          dark: '#141110',   // dark room
        },
        surface: {
          light: '#FCFAF7',
          dark: '#1E1A17',
        },
        border: {
          light: '#E8E0D5',
          dark: '#2E2822',
        },
        // Text — warm-toned, never pure black/white
        text: {
          primary: {
            light: '#1C1714',  // warm near-black ink
            dark: '#EDE8E3',
          },
          secondary: {
            light: '#7A6E64',  // aged ink
            dark: '#8C8078',
          },
          tertiary: {
            light: '#C4B8AD',
            dark: '#4A4038',
          },
        },
        // Semantic colors (kept functional but warm-shifted)
        success: {
          light: '#4A7C59',
          dark: '#6BAF80',
        },
        warning: {
          light: '#8B6F47',
          dark: '#C9A97A',
        },
        error: {
          light: '#9B3A2E',
          dark: '#D97060',
        },
        info: {
          light: '#3D5A80',
          dark: '#7A9CC0',
        },
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Old Standard TT', 'Georgia', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 8px 16px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
      },
    },
  },
  plugins: [],
}
