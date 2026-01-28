import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { colors, layout, spacing } from '../../theme/colors';

interface CardProps extends ViewProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'glass' | 'flat';
    style?: ViewStyle;
    noPadding?: boolean;
}

export function Card({
    children,
    variant = 'default',
    style,
    noPadding = false,
    ...props
}: CardProps) {
    return (
        <View
            style={[
                styles.card,
                getVariantStyle(variant),
                noPadding && styles.noPadding,
                style
            ]}
            {...props}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: layout.borderRadius.lg,
        padding: spacing.md,
        overflow: 'hidden',
    },
    noPadding: {
        padding: 0,
    }
});

function getVariantStyle(variant: string) {
    switch (variant) {
        case 'elevated':
            return {
                backgroundColor: colors.surfaceLight,
                borderWidth: 1,
                borderColor: colors.borderLight,
            };
        case 'glass':
            return {
                backgroundColor: colors.surfaceGlass,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.05)',
            };
        case 'flat':
            return {
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: colors.border,
            };
        default: // default
            return {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
            };
    }
}
