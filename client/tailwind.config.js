/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",  // 👈 important for Vite + React + TS
  ],
  darkMode: 'class',  // 👈 enable class-based dark mode
  theme: {
    extend: {},
  },
  plugins: [],
};
