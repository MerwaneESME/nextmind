import type { Config } from "tailwindcss";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const flattenColorPalette = require("tailwindcss/lib/util/flattenColorPalette").default;

function addVariablesForColors({ addBase, theme }: any) {
  const allColors = flattenColorPalette(theme("colors"));
  const newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );
  addBase({ ":root": newVars });
}

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Lot label colors (interventions)
    "bg-slate-50",
    "text-slate-700",
    "border-slate-200",
    "bg-slate-500",
    "border-l-slate-400",
    "from-slate-100/60",

    "bg-sky-50",
    "text-sky-700",
    "border-sky-200",
    "bg-sky-500",
    "border-l-sky-400",
    "from-sky-100/60",

    "bg-emerald-50",
    "text-emerald-700",
    "border-emerald-200",
    "bg-emerald-500",
    "border-l-emerald-400",
    "from-emerald-100/60",

    "bg-amber-50",
    "text-amber-800",
    "border-amber-200",
    "bg-amber-500",
    "border-l-amber-400",
    "from-amber-100/60",

    "bg-rose-50",
    "text-rose-700",
    "border-rose-200",
    "bg-rose-500",
    "border-l-rose-400",
    "from-rose-100/60",

    "bg-violet-50",
    "text-violet-700",
    "border-violet-200",
    "bg-violet-500",
    "border-l-violet-400",
    "from-violet-100/60",

    "bg-gradient-to-br",
    "via-white",
    "to-white",
  ],
  darkMode: "class",
  theme: {
    extend: {
      animation: {
        aurora: "aurora 60s linear infinite",
      },
      keyframes: {
        aurora: {
          from: { backgroundPosition: "50% 50%, 50% 50%" },
          to: { backgroundPosition: "350% 50%, 350% 50%" },
        },
      },
      colors: {
        primary: {
          50: "#ebf8ff",
          100: "#d7f0ff",
          200: "#afe2ff",
          300: "#88d3ff",
          400: "#38b6ff", // bleu clair (logo)
          500: "#285bd6",
          600: "#1800ad", // indigo vif (logo)
          700: "#13008a",
          800: "#0e0068",
          900: "#0a0045",
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
  plugins: [addVariablesForColors],
};
export default config;
