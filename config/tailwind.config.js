/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'jennaz-rose': '#FFAC92',
        'jennaz-rose-light': '#FFDBC7',
        'jennaz-purple-dark': '#1B112B',
        'jennaz-purple-light': '#2A1A3E',
        'jennaz-purple': '#221533',
        'jennaz-accent-purple': '#6B4E9C',
        'jennaz-teal': '#008080',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'jennaz-gradient': 'linear-gradient(to right, #221533, #2A1A3E)',
        'jennaz-rose-gradient': 'linear-gradient(to right, #FFAC92, #FFDBC7, #FFAC92)',
      },
      boxShadow: {
        'jennaz': '0 4px 14px 0 rgba(255, 172, 146, 0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}