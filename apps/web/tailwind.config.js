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
        midnight: {
          950: "#03060f",
          900: "#060b19",
          850: "#091024",
          800: "#0d1733",
          700: "#132147",
        },
        graphite: {
          900: "#0e131d",
          800: "#161e2e",
          700: "#222c42",
        },
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
          300: "#67e8f9",
        },
        electric: {
          400: "#60a5fa",
          500: "#3b82f6",
        },
        turquoise: {
          400: "#2dd4bf",
          500: "#14b8a6",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Sora", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "24px",
        "3xl": "40px",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 25s linear infinite",
        "spin-reverse-slow": "spin-reverse 35s linear infinite",
        "breathe": "breathe 6s ease-in-out infinite",
        "glow": "glow 3s ease-in-out infinite alternate",
        "wave": "wave 1.2s ease-in-out infinite alternate",
      },
      keyframes: {
        "spin-reverse": {
          "0%": { transform: "rotate(360deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
        glow: {
          "0%": { boxShadow: "0 0 15px rgba(34, 211, 238, 0.2)" },
          "100%": { boxShadow: "0 0 35px rgba(34, 211, 238, 0.45)" },
        },
      },
      boxShadow: {
        "cyan-glow": "0 0 25px -5px rgba(34, 211, 238, 0.3)",
        "blue-glow": "0 0 30px -5px rgba(59, 130, 246, 0.3)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
    },
  },
  plugins: [],
};

