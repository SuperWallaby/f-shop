// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #FAF8F6, #DFD1C9, #D1B9B4)',
      },
      animation: {
        'gradient-move': 'gradientMove 15s ease infinite',
      },

    },
  },
  darkMode: false,
  plugins: [],
};