import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface MerakiTextProps extends TextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyBold' | 'caption' | 'label';
    color?: string;
    align?: 'left' | 'center' | 'right';
}

export function MerakiText({
    children,
    variant = 'body',
    color,
    align,
    style,
    ...props
}: MerakiTextProps) {
    const textStyle: TextStyle = {
        color: color || colors.text,
        textAlign: align || 'left',
    };

    return (
        <Text
            style={[
                styles.base,
                styles[variant],
                textStyle,
                style
            ]}
            {...props}
        >
            {children}
        </Text>
    );
}

const styles = StyleSheet.create({
    base: {
        fontFamily: 'Manrope-Regular',
    },
    h1: {
        fontFamily: 'Manrope-Bold',
        fontSize: 32,
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    h2: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        lineHeight: 32,
    },
    h3: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 20,
        lineHeight: 28,
    },
    h4: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        lineHeight: 24,
    },
    body: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        lineHeight: 24,
    },
    bodyBold: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        lineHeight: 24,
    },
    caption: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        lineHeight: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: colors.textMuted,
    },
});
