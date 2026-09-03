/**
 * Merakí — "Beauty Bay Light" Color System
 * 
 * Clean white backgrounds with bold black typography.
 * Soft rose-pink accents for highlights and branding.
 * Inspired by Beauty Bay's premium, minimal aesthetic.
 *
 * Background:   #FFFFFF (pure white)
 * Card Surface:  #FFFFFF with subtle shadow
 * Primary CTA:   #000000 (black buttons, white text)
 */

// ─── Brand Pink ────────────────────────────────────────────────────
const pink = {
    light: '#FDE8ED',   // Very soft pink tint for subtle backgrounds
    base: '#E8A0B4',    // Muted rose — primary brand accent
    dark: '#C47A90',    // Deeper rose for pressed states
    muted: '#D4A0B0',   // Subdued pink for secondary use
    champagne: '#F5E6E0', // Warm champagne tint
    roseWhite: '#FFF5F5', // Rose-tinted white
};

// ─── Surfaces ──────────────────────────────────────────────────────
const surface = {
    /** The base background — pure white */
    base: '#FFFFFF',
    /** Primary card / elevated surface */
    card: '#FFFFFF',
    /** Slightly off-white surface for nested elements */
    cardLight: '#F8F8F8',
    /** Input fields, search bars */
    input: '#F5F5F5',
    /** Subtle glass overlay (light mode) */
    glass: 'rgba(0, 0, 0, 0.02)',
};

// ─── Borders ───────────────────────────────────────────────────────
const border = {
    base: '#E5E7EB',
    light: 'rgba(0, 0, 0, 0.06)',
    medium: 'rgba(0, 0, 0, 0.10)',
    gold: 'rgba(232, 160, 180, 0.25)',
};

// ─── Text ──────────────────────────────────────────────────────────
const text = {
    primary: '#1A1A1A',    // Near-black for headings
    secondary: '#6B7280',   // Cool gray for body / captions
    muted: '#9CA3AF',      // Light gray — placeholders, disabled
    invert: '#FFFFFF',     // White text on dark / primary buttons
    gold: '#C47A90',       // Pink-tinted text for accents (replaces gold)
};

// ─── Status ────────────────────────────────────────────────────────
const status = {
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
};

// ────────────────────────────────────────────────────────────────────
// Flat export matching the API the rest of the app expects
// ────────────────────────────────────────────────────────────────────

export const colors = {
    // Brand
    primary: '#000000',           // Black CTAs (Beauty Bay style)
    primaryLight: '#333333',      // Slightly lighter for hover states
    primaryDark: '#000000',       // Deep black for pressed states
    primaryMuted: '#6B7280',      // Muted gray for secondary use
    champagne: pink.champagne,
    roseWhite: pink.roseWhite,

    // Backgrounds & surfaces
    background: '#FFFFFF',
    baseBackground: surface.base,
    surface: surface.card,
    surfaceLight: surface.cardLight,
    surfaceGlass: surface.glass,
    inputBackground: surface.input,
    deepPurple: '#F8F4FA',        // Very light lavender (was Deep Purple)

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
    tabBarBackground: 'rgba(255, 255, 255, 0.96)',
    tabBarBorder: 'rgba(0, 0, 0, 0.08)',
    tabBarActive: '#000000',
    tabBarInactive: 'rgba(156, 163, 175, 0.70)',

    // Misc
    overlay: 'rgba(0, 0, 0, 0.50)',
    divider: '#F0F0F0',
    white: '#FFFFFF',
    black: '#000000',

    // Aliases used across screens
    accent: pink.base,       // ActivityIndicators, highlights, prices
    gold: pink.light,        // Stamp cards, rewards, loyalty (now pink-tinted)
    secondary: '#A78BFA',    // Purple accent for variety (lashes category, schedule dots)

    // Brand-pink aliases used by the voucher sign-up and scan-to-pay screens.
    brandPink: pink.base,
    brandPinkLight: pink.light,
    /** Alias for `text`; some screens spell the primary text colour this way. */
    textPrimary: text.primary,
};

export const gradients = {
    /** Primary CTA — Flat Black */
    primary: ['#000000', '#000000'] as [string, string],

    /** Background — Clean white (was Midnight Velvet) */
    background: ['#FFFFFF', '#FAFAFA'] as [string, string],

    /** Card shimmer — Removed (transparent) */
    cardShimmer: ['rgba(0, 0, 0, 0.00)', 'rgba(0, 0, 0, 0.00)'] as [string, string],

    /** Surface gradient for elevated components — White */
    surface: ['#FFFFFF', '#FFFFFF'] as [string, string],

    /** Gold glow — Soft pink gradient (replaces gold) */
    goldGlow: ['#E8A0B4', '#E8A0B4', '#E8A0B4'] as [string, string, string],

    /** Secondary — Soft lavender */
    secondary: ['#A78BFA', '#A78BFA'] as [string, string],

    /** Premium — Soft rose gradient */
    premium: ['#E8A0B4', '#C47A90', '#E8A0B4'] as [string, string, string],

    /** Accent — Soft pink */
    accent: ['#E8A0B4', '#E8A0B4'] as [string, string],

    /** Background variant — Very light lavender (was deep purple) */
    backgroundDeepPurple: ['#FFFFFF', '#FAF5FF'] as [string, string],
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


export default colors;
