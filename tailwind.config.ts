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
          500: "#F5A623",
          600: "#D97706",
          700: "#C8860A",
          800: "#92400E",
          900: "#78350F",
          DEFAULT: "#FFD700",
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
        "card-hover": "0 0 0 3px rgba(245,166,35,0.15), 0 4px 20px rgba(245,166,35,0.2)",
        "glass-gold": "0 2px 12px rgba(245,166,35,0.08)",
        "gold-glow": "0 0 0 3px rgba(245,166,35,0.15), 0 4px 20px rgba(245,166,35,0.2)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #FFD700 0%, #F5A623 50%, #C8860A 100%)",
        "gold-gradient-r": "linear-gradient(to right, #FFD700, #F5A623, #C8860A)",
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
