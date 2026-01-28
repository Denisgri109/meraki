import React, { forwardRef } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    ViewStyle,
} from 'react-native';
import { colors, spacing } from '../../theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(
    ({ label, error, containerStyle, leftIcon, rightIcon, style, ...props }, ref) => {
        return (
            <View style={[styles.container, containerStyle]}>
                {label && <Text style={styles.label}>{label}</Text>}
                <View style={[styles.inputContainer, error && styles.inputError]}>
                    {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                    <TextInput
                        ref={ref}
                        style={[
                            styles.input,
                            leftIcon ? styles.inputWithLeftIcon : undefined,
                            rightIcon ? styles.inputWithRightIcon : undefined,
                            style,
                        ].filter(Boolean)}
                        placeholderTextColor={colors.textMuted}
                        {...props}
                    />
                    {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
                </View>
                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
        );
    }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    label: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputError: {
        borderColor: colors.error,
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    inputWithLeftIcon: {
        paddingLeft: 8,
    },
    inputWithRightIcon: {
        paddingRight: 8,
    },
    iconLeft: {
        paddingLeft: 16,
    },
    iconRight: {
        paddingRight: 16,
    },
    errorText: {
        color: colors.error,
        fontSize: 12,
        marginTop: spacing.xs,
    },
});

export default Input;
