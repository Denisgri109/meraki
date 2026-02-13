import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    ViewStyle,
} from 'react-native';
import { colors, layout } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    variant?: 'default' | 'glass';
}

export function Input({
    label,
    error,
    containerStyle,
    leftIcon,
    rightIcon,
    style,
    variant = 'default',
    ...props
}: InputProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View
                style={[
                    styles.inputWrapper,
                    variant === 'glass' && styles.inputWrapperGlass,
                    isFocused && styles.inputWrapperFocused,
                    error ? styles.inputWrapperError : null,
                ]}
            >
                {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                <TextInput
                    style={[
                        styles.input,
                        leftIcon ? { paddingLeft: 0 } : null,
                        rightIcon ? { paddingRight: 0 } : null,
                        style,
                    ]}
                    placeholderTextColor={colors.textMuted}
                    selectionColor={colors.primary}
                    onFocus={(e) => {
                        setIsFocused(true);
                        props.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        props.onBlur?.(e);
                    }}
                    {...props}
                />
                {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderRadius: layout.borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    inputWrapperGlass: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: layout.borderRadius.full,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    inputWrapperFocused: {
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    inputWrapperError: {
        borderColor: colors.error,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        fontSize: 15,
        color: colors.text,
    },
    iconLeft: {
        paddingLeft: spacing.md,
    },
    iconRight: {
        paddingRight: spacing.md,
    },
    error: {
        fontSize: 12,
        color: colors.error,
        marginTop: spacing.xs,
    },
});
