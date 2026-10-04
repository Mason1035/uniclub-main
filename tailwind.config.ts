import animate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			screens: {
				'xs': '475px',
			},
			fontFamily: {
        sans: ['var(--font-ui)'],
        ui: ['var(--font-ui)'],
        editorial: ['var(--font-editorial)'],
        signature: ['var(--font-signature)'],
        latin: ['var(--font-latin)', 'var(--font-ui)'],
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        reading: ['var(--font-reading)'],
        mono: ['var(--font-mono)'],
        // Preserve old utility names while routing them to the shared UI stack.
				'inter': ['var(--font-ui)'],
				'avigea': ['var(--font-ui)'],
			},
      fontSize: {
        hero: ['var(--text-hero)', { lineHeight: '1.2' }],
        display: ['var(--text-display)', { lineHeight: '1.2' }],
        h1: ['var(--text-h1)', { lineHeight: '1.3' }],
        h2: ['var(--text-h2)', { lineHeight: '1.4' }],
        h3: ['var(--text-h3)', { lineHeight: '1.5' }],
        body: ['var(--text-body)', { lineHeight: '1.7' }],
        reading: ['var(--text-reading)', { lineHeight: '1.95' }],
        caption: ['var(--text-caption)', { lineHeight: '1.6' }],
      },
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			animation: {
				'fade-in': 'fade-in 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
			},
			keyframes: {
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.95)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				}
			}
		}
	},
	plugins: [animate],
} satisfies Config;
