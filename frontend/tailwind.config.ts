import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#1A1815",
          surface: "#211E1B",
          input: "#272421",
          hover: "#2f2c29",
        },
        border: {
          DEFAULT: "#3A3733",
          subtle: "#2e2b28",
        },
        accent: {
          DEFAULT: "#E8863A",
          hover: "#F59642",
          muted: "#E8863A26",
        },
        text: {
          primary: "#dddcda",
          secondary: "#96918f",
          muted: "#6e6d69",
        },
        status: {
          success: "#22C55E",
          error: "#EF4444",
          warning: "#F97316",
          info: "#3B82F6",
        },
      },
      fontFamily: {
        sans: ["Monaspace Krypton", "Noto Sans Mono", "system-ui", "sans-serif"],
        mono: ["Monaspace Krypton", "Noto Sans Mono", "monospace"],
      },
      keyframes: {
        "progress-slide": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(600%)" },
        },
      },
      animation: {
        "progress-slide": "progress-slide 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
