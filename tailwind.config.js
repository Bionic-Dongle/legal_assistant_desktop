
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        neon: {
          cyan:   "hsl(var(--neon-cyan))",
          pink:   "hsl(var(--neon-pink))",
          purple: "hsl(var(--neon-purple))",
          green:  "hsl(var(--neon-green))",
          yellow: "hsl(var(--neon-yellow))",
          orange: "hsl(var(--neon-orange))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'neon-cyan':   '0 0 8px hsl(191 100% 50% / 0.6), 0 0 20px hsl(191 100% 50% / 0.3)',
        'neon-pink':   '0 0 8px hsl(330 100% 50% / 0.6), 0 0 20px hsl(330 100% 50% / 0.3)',
        'neon-purple': '0 0 8px hsl(280 85% 65% / 0.6), 0 0 20px hsl(280 85% 65% / 0.3)',
        'neon-green':  '0 0 8px hsl(150 100% 50% / 0.6), 0 0 20px hsl(150 100% 50% / 0.3)',
        'neon-yellow': '0 0 8px hsl(48 100% 51% / 0.6), 0 0 20px hsl(48 100% 51% / 0.3)',
        'card-hover':  '0 0 12px hsl(191 100% 50% / 0.15)',
      },
    },
  },
  plugins: [],
}
