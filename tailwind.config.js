/** @type {import('tailwindcss').Config} */
// Blue and white. Blue is reserved for the primary action and the current
// page; red/amber only for problems (short, low stock, out).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff5ff",
          100: "#dbe8fe",
          200: "#bfd5fd",
          300: "#93b8fb",
          400: "#5f93f6",
          500: "#3a70ee",
          600: "#2556d9",
          700: "#1d45b8",
          800: "#1c3c94",
          900: "#1b3575",
        },
        canvas: "#eef3fa",
        mpesa: { DEFAULT: "#00a651", dark: "#008c44" },
        line: "#e1e7ef",
        ink: { DEFAULT: "#16202e", soft: "#556275", faint: "#8a95a5" },
        danger: { 50: "#fdf1f0", 100: "#f9dcd9", 600: "#b42318", 700: "#912018" },
        warn: { 50: "#fdf6ec", 100: "#f8e6c8", 600: "#b54708", 700: "#93370d" },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "Consolas", "Menlo", "monospace"],
      },
      borderRadius: { DEFAULT: "6px" },
      boxShadow: {
        card: "0 1px 2px rgba(16,32,64,0.06), 0 1px 1px rgba(16,32,64,0.04)",
        lift: "0 4px 14px rgba(16,32,64,0.10)",
      },
    },
  },
  plugins: [],
};
