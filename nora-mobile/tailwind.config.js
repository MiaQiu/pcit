/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Nora Design System Colors
        purple: {
          main: '#8C49D5',  // Main Purple from Figma
        },
        text: {
          dark: '#1E2939',   // Text Dark
          primary: '#000000', // Labels/Primary
        },
        background: {
          primary: '#FFFFFF', // Backgrounds/Primary
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'plus-jakarta': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
