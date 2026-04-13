/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#dde6ff",
          200: "#c3d1ff",
          300: "#9db3ff",
          400: "#7088ff",
          500: "#4a5cff",
          600: "#3038f5",
          700: "#2428e0",
          800: "#2025b5",
          900: "#20268f",
          950: "#141654",
        },
        surface: {
          DEFAULT: "#0f1117",
          card:    "#171b26",
          border:  "#252a3a",
          hover:   "#1e2333",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "grid-pattern": "linear-gradient(rgba(74,92,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(74,92,255,0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "40px 40px",
      },
    },
  },
  plugins: [],
};
