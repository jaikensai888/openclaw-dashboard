/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand color - sky blue
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Semantic status colors - use these instead of direct Tailwind colors
        status: {
          pending: {
            DEFAULT: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.1)',
          },
          running: {
            DEFAULT: '#3b82f6',
            bg: 'rgba(59, 130, 246, 0.1)',
          },
          completed: {
            DEFAULT: '#22c55e',
            bg: 'rgba(34, 197, 94, 0.1)',
          },
          failed: {
            DEFAULT: '#ef4444',
            bg: 'rgba(239, 68, 68, 0.1)',
          },
          cancelled: {
            DEFAULT: '#737373',
            bg: 'rgba(115, 115, 115, 0.1)',
          },
        },
      },
      fontFamily: {
        // System font stack - more distinctive than Inter, no font download needed
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
        mono: [
          '"SF Mono"',
          'Monaco',
          'Inconsolata',
          '"Fira Mono"',
          '"Droid Sans Mono"',
          '"Source Code Pro"',
          'monospace',
        ],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
