/**
 * Merakí Luxe — "Midnight Velvet" Color System
 * 
 * Deep navy-charcoal blues create an expensive, atmospheric feel.
 * Warm gold accents glow against the cool background.
 *
 * Background Gradient:  135° from #161B22 → #010409
 * Card Background:      #1F242C  with 1px #30363D border
 */

// ─── Brand Gold ────────────────────────────────────────────────────
const gold = {
    light: '#F5D38E',   // Soft champagne highlight
    base: '#D4A853',   // Rich warm gold — primary brand color
    dark: '#B8912E',   // Deep amber for pressed states
    muted: '#A08040',   // Subdued gold for secondary use
    champagne: '#E6C090', // Stitch Design Champagne
    roseWhite: '#FFF5F5', // Stitch Design Rose White
};

// ─── Surfaces ──────────────────────────────────────────────────────
const surface = {
    /** The deepest background — used behind gradients as fallback */
    base: '#080A0F',
    /** Primary card / elevated surface */
    card: '#1F242C',
    /** Slightly lighter surface for nested elements */
    cardLight: '#262C36',
    /** Input fields, search bars */
    input: '#161B22',
    /** Subtle glass overlay */
    glass: 'rgba(31, 36, 44, 0.55)',
};

// ─── Borders ───────────────────────────────────────────────────────
const border = {
    base: '#30363D',
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.12)',
    gold: 'rgba(212, 168, 83, 0.25)',
};

// ─── Text ──────────────────────────────────────────────────────────
const text = {
    primary: '#F0F6FC',   // Crisp white-blue for headings
    secondary: '#8B949E',   // Cool gray for body / captions
    muted: '#484F58',   // Very dim — placeholders, disabled
    invert: '#0D1117',   // Dark text on gold / light buttons
    gold: '#D4A853',   // Gold-tinted text for accents
};

// ─── Status ────────────────────────────────────────────────────────
const status = {
    success: '#3FB950',
    error: '#F85149',
    warning: '#D29922',
    info: '#58A6FF',
};

// ────────────────────────────────────────────────────────────────────
// Flat export matching the API the rest of the app expects
// ────────────────────────────────────────────────────────────────────

export const colors = {
    // Brand
    primary: gold.base,
    primaryLight: gold.light,
    primaryDark: gold.dark,
    primaryMuted: gold.muted,
    champagne: gold.champagne,
    roseWhite: gold.roseWhite,

    // Backgrounds & surfaces
    background: 'transparent', // Was surface.base (#080A0F)
    baseBackground: surface.base, // New: Keep original base for reference/fallback
    surface: surface.card,
    surfaceLight: surface.cardLight,
    surfaceGlass: surface.glass,
    inputBackground: surface.input,
    deepPurple: '#160F29', // Deep Purple Background

    // Text
    text: text.primary,
    textSecondary: text.secondary,
    textMuted: text.muted,
    textInvert: text.invert,
    textGold: text.gold,

    // Borders
    border: border.base,
    borderLight: border.light,
    borderMedium: border.medium,
    borderGold: border.gold,

    // Status
    success: status.success,
    error: status.error,
    warning: status.warning,
    info: status.info,

    // Tab bar
    tabBarBackground: 'rgba(22, 27, 34, 0.70)',
    tabBarBorder: 'rgba(48, 54, 61, 0.50)',
    tabBarActive: gold.base,
    tabBarInactive: 'rgba(139, 148, 158, 0.55)',

    // Misc
    overlay: 'rgba(1, 4, 9, 0.75)',
    divider: '#21262D',
    white: '#FFFFFF',
    black: '#000000',

    // Aliases used across screens
    accent: gold.base,      // ActivityIndicators, highlights, prices
    gold: gold.light,     // Stamp cards, rewards, loyalty
    secondary: '#A371F7',      // Purple accent for variety (lashes category, schedule dots)
};

export const gradients = {
    /** Primary CTA — Flat Gold #D4A853 */
    primary: ['#D4A853', '#D4A853'] as [string, string],

    /** Background — Midnight Velvet Gradient 135° */
    background: ['#161B22', '#010409'] as [string, string],

    /** Card shimmer — Removed (effectively transparent or flat) */
    cardShimmer: ['rgba(212, 168, 83, 0.00)', 'rgba(212, 168, 83, 0.00)'] as [string, string],

    /** Surface gradient for elevated components — Flat #1F242C */
    surface: ['#1F242C', '#1F242C'] as [string, string],

    /** Gold glow — Flat #D4A853 */
    goldGlow: ['#D4A853', '#D4A853', '#D4A853'] as [string, string, string],

    /** Secondary — Flat #A371F7 */
    secondary: ['#A371F7', '#A371F7'] as [string, string],

    /** Premium — Flat Gold #D4A853 */
    premium: ['#D4A853', '#D4A853', '#D4A853'] as [string, string, string],

    /** Accent — Same as primary (Gold) */
    accent: ['#D4A853', '#D4A853'] as [string, string],

    /** Deep Purple Background - Dark gradient transitioning in dark purple */
    backgroundDeepPurple: ['#1A1125', '#0F1218'] as [string, string],
};

export const layout = {
    borderRadius: {
        sm: 6,
        md: 10,
        lg: 14,
        xl: 18,
        xxl: 24,
        full: 9999,
    },
};

// Re-export spacing locally so `import { colors, spacing } from './colors'` works
export { spacing } from './spacing';

export default colors;
