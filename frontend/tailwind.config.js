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
        // Primary: Warm Orange (Memories & Nostalgia)
        primary: {
          DEFAULT: '#F39C12',
          hover: '#E67E22',
          light: '#FFF3E0',
          dark: '#2A1F0F',
        },
        // Secondary: Blue Gray (Trust & Stability)
        secondary: {
          DEFAULT: '#2C3E50',
          hover: '#1A252F',
          light: '#E0E0E0',
        },
        // Neutral colors
        background: {
          light: '#FAFAFA',
          dark: '#121212',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E1E1E',
        },
        border: {
          light: '#E0E0E0',
          dark: '#2C2C2C',
        },
        // Text colors
        text: {
          primary: {
            light: '#2C3E50',
            dark: '#E0E0E0',
          },
          secondary: {
            light: '#7F8C8D',
            dark: '#9E9E9E',
          },
          tertiary: {
            light: '#BDC3C7',
            dark: '#5E5E5E',
          },
        },
        // Semantic colors
        success: {
          light: '#27AE60',
          dark: '#4CAF50',
        },
        warning: {
          light: '#F39C12',
          dark: '#FFA726',
        },
        error: {
          light: '#E74C3C',
          dark: '#EF5350',
        },
        info: {
          light: '#3498DB',
          dark: '#42A5F5',
        },
        // Category/Mood colors
        mood: {
          exercise: '#9B59B6',
          friends: '#E74C3C',
          family: '#27AE60',
          work: '#3498DB',
          travel: '#F39C12',
          food: '#E67E22',
          nature: '#1ABC9C',
          learning: '#9B59B6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
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
