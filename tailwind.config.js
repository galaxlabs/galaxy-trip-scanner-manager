/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
    './api/**/*.{js,ts,jsx,tsx}',
    './tests/**/*.{js,ts,jsx,tsx,mjs}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
