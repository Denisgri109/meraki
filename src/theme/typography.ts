import { TextStyle } from 'react-native';

export const fontSizes = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    display: 42,
};

export const fontWeights = {
    light: '300' as TextStyle['fontWeight'],
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
};

export const typography = {
    display: {
        fontSize: fontSizes.display,
        fontWeight: fontWeights.light,
        letterSpacing: 4,
    },
    h1: {
        fontSize: fontSizes.xxxl,
        fontWeight: fontWeights.semibold,
        letterSpacing: 1,
    },
    h2: {
        fontSize: fontSizes.xxl,
        fontWeight: fontWeights.semibold,
        letterSpacing: 0.5,
    },
    h3: {
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.medium,
    },
    body: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.regular,
    },
    bodySmall: {
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
    },
    caption: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.regular,
    },
    label: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.medium,
        textTransform: 'uppercase' as const,
        letterSpacing: 1.5,
    },
    button: {
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semibold,
        letterSpacing: 1,
    },
};

export default typography;
