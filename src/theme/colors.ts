// Meraki Luxe Theme - High-End Beauty & Wellness
// Deep Warm Blacks, Rose Gold, and Iridescent Gradients

export const colors = {
    // Backgrounds - Deep, rich, warm darks (not void black)
    background: '#0F0F13',      // Deep Mauve-Black (Soft & Luxurious)
    backgroundSecondary: '#15151A', // Slightly lighter

    // Surfaces - Elevated & Elegant
    surface: '#1E1E24',         // Warm charcoal
    surfaceLight: '#2A2A35',    // Lighter surface for cards
    surfaceGlass: 'rgba(30, 30, 36, 0.85)', // Frosted mauve-black

    // Brand - Rose Gold & Champagne
    primary: '#D48A82',         // Muted Dusty Rose (Less bright)
    primaryLight: 'rgba(212, 138, 130, 0.2)', // Rose tint
    primaryDark: '#B8756D',     // Deeper Muted Rose

    // Accents
    secondary: '#C0A0E0',       // Muted Lavender
    accent: '#E6C090',          // Muted Champagne Gold
    gold: '#B8972F',            // Muted Gold

    // Text - Warm & Readable
    text: '#FDF6F6',            // Rose White
    textSecondary: '#AFA8BA',   // Muted Lavender-Gray
    textMuted: '#6B6675',       // Deep Mauve-Gray
    textInvert: '#121212',

    // Status - Softened but functional
    success: '#86EFAC',         // Soft Green
    error: '#FDA4AF',           // Soft Red
    warning: '#FDE047',         // Soft Yellow

    // Borders
    border: '#2E2E36',          // Subtle mauve-gray
    borderLight: '#454552',
} as const;

export const gradients = {
    // "Meraki Soul" - Rose to Champagne (Signature)
    primary: ['#D48A82', '#E6C090'] as const,

    // "Midnight Bloom" - Deep Violet to Rose
    secondary: ['#1E0A40', '#9E154E'] as const,

    // "Liquid Gold" - Luxury Metallic
    gold: ['#BF953F', '#FCF6BA', '#B38728'] as const,

    // "Velvet Night" - Background depth
    dark: ['#1E1E24', '#0F0F13'] as const,

    // "Ethereal" - Holographic sheen for premium cards
    premium: ['#D8B4FE', '#818CF8', '#C084FC'] as const,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
} as const;

export const layout = {
    borderRadius: {
        sm: 12,     // Softer corners
        md: 20,     // Very round, friendly
        lg: 32,
        full: 9999,
    }
} as const;

export default colors;