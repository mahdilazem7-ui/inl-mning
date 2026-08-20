import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: "#0b0c0f",
        panel: "#14161b",
        border: "#23262e",
        accent: "#6ee7b7",
        warn: "#fbbf24",
        crit: "#f87171"
      }
    }
  },
  plugins: []
};

export default config;
