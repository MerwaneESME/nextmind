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
        primary: {
          50: "#e8eef7",
          100: "#d6e2f3",
          200: "#adc4e7",
          300: "#85a5db",
          400: "#5c87cf",
          500: "#355aa8",
          600: "#1e3a8a", // bleu profond
          700: "#16306f",
          800: "#0f2554",
          900: "#0a1c40",
        },
        success: {
          50: "#ecfdf3",
          100: "#d1fadf",
          200: "#a6f4c5",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981", // vert vif
          600: "#0da36b",
          700: "#0a8557",
          800: "#0a6744",
          900: "#0a4f36",
        },
        warning: {
          50: "#fff7e6",
          100: "#ffe8bf",
          200: "#ffd58c",
          300: "#ffc159",
          400: "#ffad26",
          500: "#fbbf24", // jaune / orange clair
          600: "#d89c1a",
          700: "#b67913",
          800: "#93580d",
          900: "#7a4309",
        },
        neutral: {
          50: "#f5f5f5",
          100: "#e5e7eb",
          200: "#d5d7dc",
          300: "#b8bcc6",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Inter", "sans-serif"],
        body: ["var(--font-body)", "Open Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

