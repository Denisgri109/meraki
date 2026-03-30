import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps, StyleProp } from 'react-native';
import { colors, gradients, layout } from '../../theme/colors';

interface CardProps extends ViewProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'glass' | 'gold';
    style?: StyleProp<ViewStyle>;
    noPadding?: boolean;
}

/**
 * Premium Card component — "Beauty Bay Light" surface
 *
 * Variants:
 *   default  — White card with subtle border
 *   elevated — White card with shadow for depth
 *   glass    — Very subtle tinted overlay
 *   gold     — Soft pink border glow for featured / highlighted content
 */
export function Card({ children, variant = 'default', style, noPadding, ...props }: CardProps) {
    const padding = noPadding ? 0 : 16;

    if (variant === 'elevated') {
        return (
            <View style={[styles.base, styles.elevated, { padding }, style]} {...props}>

                {children}
            </View>
        );
    }

    if (variant === 'gold') {
        return (
            <View style={[styles.base, styles.gold, { padding }, style]} {...props}>
                {children}
            </View>
        );
    }

    if (variant === 'glass') {
        return (
            <View style={[styles.base, styles.glass, { padding }, style]} {...props}>
                {children}
            </View>
        );
    }

    // Default
    return (
        <View style={[styles.base, { padding }, style]} {...props}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    elevated: {
        overflow: 'hidden',
        borderWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    glass: {
        backgroundColor: colors.surfaceGlass,
        borderColor: colors.borderLight,
    },
    gold: {
        borderColor: colors.borderGold,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 8,
        elevation: 3,
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
        height: '40%',
    },
});
