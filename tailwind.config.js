/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0e1117',
        surface: '#161b22',
        surfaceHover: '#21262d',
        accent: '#6366f1',
      }
    },
  },
  plugins: [],
}