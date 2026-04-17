import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // SkyWalker Cyberpunk palette
        void: {
          DEFAULT: "#0a0a0f",
          50: "#f0f0ff",
          100: "#e0e0ff",
          200: "#c0c0ff",
          300: "#9090e0",
          400: "#6060c0",
          500: "#4040a0",
          600: "#303080",
          700: "#202060",
          800: "#101040",
          900: "#0a0a20",
          950: "#050510",
        },
        neon: {
          cyan: "#00f5ff",
          blue: "#4d9fff",
          purple: "#9d4dff",
          green: "#00ff9d",
          red: "#ff4d4d",
          yellow: "#ffdd4d",
        },
        panel: {
          DEFAULT: "#111118",
          border: "#1e1e2e",
          hover: "#16161f",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Cascadia Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 20px rgba(0, 245, 255, 0.3), 0 0 40px rgba(0, 245, 255, 0.1)",
        "neon-blue": "0 0 20px rgba(77, 159, 255, 0.4)",
        "neon-purple": "0 0 20px rgba(157, 77, 255, 0.4)",
        panel: "0 4px 24px rgba(0, 0, 0, 0.4)",
      },
      animation: {
        "pulse-neon": "pulseNeon 2s ease-in-out infinite",
        "scan-line": "scanLine 3s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "blink": "blink 1s step-end infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
