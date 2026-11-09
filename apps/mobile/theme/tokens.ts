import { Platform, type TextStyle } from 'react-native'

/**
 * KROEX global design tokens — the "Apple Light" system.
 * Single source of truth shared across every mobile screen so the visual
 * language matches web and desktop. Exact values from the design spec.
 */

export const colors = {
  primary: '#0071E3',
  secondary: '#2997FF',
  tertiary: '#0066CC',
  neutral: '#1D1D1F',
  surface: '#FFFFFF',
  background: '#FFFFFF',
  onSurface: '#1D1D1F',
  muted: '#E5E7EB',
  error: '#D92D20',

  // Derived helpers (kept consistent with the palette above)
  primaryForeground: '#FFFFFF',
  secondarySurface: '#F5F5F7',
  border: '#E5E7EB',
  mutedForeground: '#6B7280',
  link: '#0066CC',
} as const

/** Spacing scale: 8 / 16 / 24 / 54 / 70. */
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 54,
  xl: 70,
} as const

/** Corner radii: 4 / 8 / 16 / 24 / pill. Applied per component purpose. */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 980,
} as const

/**
 * Typography hierarchy. Values mirror the design spec exactly (sizes, weights,
 * line heights, letter spacing). Native SF is used on Apple platforms; the
 * platform system font is used elsewhere (Inter bundling is a follow-up — see
 * README/report). Screens choose the step appropriate to a phone's scale.
 */
const systemFont = Platform.select({ ios: undefined, default: undefined })

type Type = TextStyle

export const typography = {
  headlineDisplay: { fontFamily: systemFont, fontSize: 56, fontWeight: '700', lineHeight: 67, letterSpacing: 0 },
  headlineLg:      { fontFamily: systemFont, fontSize: 47, fontWeight: '600', lineHeight: 60, letterSpacing: -0.28 },
  headlineMd:      { fontFamily: systemFont, fontSize: 40, fontWeight: '600', lineHeight: 44, letterSpacing: 0 },
  headlineSm:      { fontFamily: systemFont, fontSize: 33, fontWeight: '600', lineHeight: 40, letterSpacing: 0 },
  bodyLg:          { fontFamily: systemFont, fontSize: 28, fontWeight: '400', lineHeight: 42, letterSpacing: 0.196 },
  bodyMd:          { fontFamily: systemFont, fontSize: 17, fontWeight: '400', lineHeight: 26, letterSpacing: 0 },
  bodySm:          { fontFamily: systemFont, fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: 0 },
  labelLg:         { fontFamily: systemFont, fontSize: 17, fontWeight: '600', lineHeight: 22, letterSpacing: 0 },
  labelMd:         { fontFamily: systemFont, fontSize: 15, fontWeight: '500', lineHeight: 20, letterSpacing: 0 },
  labelSm:         { fontFamily: systemFont, fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0 },
  navLink:         { fontFamily: systemFont, fontSize: 12, fontWeight: '400', lineHeight: 14, letterSpacing: 0 },
  iconLabel:       { fontFamily: systemFont, fontSize: 12, fontWeight: '400', lineHeight: 12, letterSpacing: 0 },
} satisfies Record<string, Type>

export const theme = { colors, spacing, radii, typography } as const
export type Theme = typeof theme
