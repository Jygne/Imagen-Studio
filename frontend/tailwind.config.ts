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
          base: "#0D0E14",
          surface: "#161720",
          input: "#1E1F2B",
          hover: "#1c1d2a",
        },
        border: {
          DEFAULT: "#2A2B38",
          subtle: "#222330",
        },
        accent: {
          DEFAULT: "#6B63FF",
          hover: "#7c75ff",
          muted: "#6B63FF33",
        },
        text: {
          primary: "#F0F0F5",
          secondary: "#8A8B9A",
          muted: "#5a5b6a",
        },
        status: {
          success: "#22C55E",
          error: "#EF4444",
          warning: "#F97316",
          info: "#3B82F6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
