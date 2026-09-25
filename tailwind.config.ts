import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F5C800",
          600: "#D97706",
          700: "#EFC000",
          800: "#92400E",
          900: "#78350F",
          DEFAULT: "#F5C800",
        },
        background: "#FFFFFF",
        card: "#FFFFFF",
        "text-primary": "#1A1A1A",
        "text-secondary": "#6B6B6B",
        success: "#34C759",
        error: "#FF3B30",
      },
      fontFamily: {
        nunito: ["Nunito", "sans-serif"],
        inter: ["Nunito", "sans-serif"],
        sora: ["Nunito", "sans-serif"],
        sans: ["Nunito", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.06)",
        "card-hover": "0 0 0 3px rgba(245,200,0,0.15), 0 4px 20px rgba(245,200,0,0.2)",
        "glass-gold": "0 2px 12px rgba(245,200,0,0.08)",
        "gold-glow": "0 0 0 3px rgba(245,200,0,0.15), 0 4px 20px rgba(245,200,0,0.2)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #FFDC46 0%, #F7CB08 48%, #EFC000 100%)",
        "gold-gradient-r": "linear-gradient(to right, #FFDC46, #F7CB08, #EFC000)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
