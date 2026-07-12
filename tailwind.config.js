// Tailwind v4 — theme extensions only. Content paths live in src/app/globals.css (@source).
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "ui-serif", "Georgia", "serif"],
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #FAF8F6, #DFD1C9, #D1B9B4)",
      },
      animation: {
        "gradient-move": "gradientMove 15s ease infinite",
      },
    },
  },
  darkMode: false,
  plugins: [],
};
