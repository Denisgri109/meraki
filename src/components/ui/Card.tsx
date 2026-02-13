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
 * Premium Card component — "Midnight Velvet" surface
 *
 * Variants:
 *   default  — Solid #1F242C with 1px #30363D border
 *   elevated — Same card with a subtle gold shimmer gradient at the top
 *   glass    — Semi-transparent overlay with backdrop tint
 *   gold     — Faint gold border glow for featured / highlighted content
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 8,
    },
    glass: {
        backgroundColor: colors.surfaceGlass,
        borderColor: colors.borderLight,
    },
    gold: {
        borderColor: colors.borderGold,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
        height: '40%',
    },
});
