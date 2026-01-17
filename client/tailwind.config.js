/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui'],
        display: ['"Fraunces"', 'serif'],
      },
      colors: {
        ink: '#0f172a',
        sand: '#f6efe6',
        dune: '#e8d8c3',
        tide: '#0b5f8a',
        coral: '#e66b4f',
        leaf: '#1f6f3f',
      },
      boxShadow: {
        float: '0 24px 60px -30px rgba(15, 23, 42, 0.4)',
      },
    },
  },
  plugins: [],
};
