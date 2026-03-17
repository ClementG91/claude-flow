import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        claude: {
          50: '#fef7ee',
          100: '#fdedd3',
          200: '#fad6a5',
          300: '#f7b96d',
          400: '#f39333',
          500: '#f0760c',
          600: '#e15d07',
          700: '#ba4508',
          800: '#94370f',
          900: '#782f10',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
