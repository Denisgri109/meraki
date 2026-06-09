import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
    TouchableOpacityProps
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, layout } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass' | 'gradient';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: string;
    style?: ViewStyle;
    textStyle?: TextStyle;
    fullWidth?: boolean;
}

export function Button({
    title,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    style,
    textStyle,
    disabled,
    fullWidth = false,
    ...props
}: ButtonProps) {
    const isPrimary = variant === 'primary';
    const isGradient = variant === 'gradient';
    const isDisabled = disabled || loading;
    const containerStyle: ViewStyle = fullWidth ? { width: '100%' } : {};

    const content = (
        <>
            {loading ? (
                <ActivityIndicator color={isPrimary || isGradient ? colors.textInvert : colors.primary} size="small" style={styles.loader} />
            ) : icon ? (
                <Text style={[styles.icon, getIconStyle(variant, isDisabled)]}>{icon}</Text>
            ) : null}
            <Text style={[
                styles.text,
                getTextStyle(variant, size, isDisabled),
                textStyle
            ]}>
                {title}
            </Text>
        </>
    );

    if (isPrimary) {
        return (
            <TouchableOpacity
                onPress={props.onPress}
                activeOpacity={0.8}
                style={[
                    styles.button,
                    { backgroundColor: colors.primary },
                    getSizeStyle(size),
                    isDisabled && styles.disabled,
                    style,
                    containerStyle
                ]}
                disabled={isDisabled}
                {...props}
            >
                {content}
            </TouchableOpacity>
        );
    }

    if (isGradient) {
        return (
            <TouchableOpacity
                onPress={props.onPress}
                activeOpacity={0.8}
                disabled={isDisabled}
                style={[containerStyle, isDisabled && styles.disabled, style]}
                {...props}
            >
                <LinearGradient
                    colors={['#E8A0B4', '#C47A90']} // Gradient from design: rose pink
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.button,
                        getSizeStyle(size),
                        { borderRadius: layout.borderRadius.full }
                    ]}
                >
                    {content}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            disabled={isDisabled}
            style={[
                styles.button,
                getVariantStyle(variant),
                getSizeStyle(size),
                isDisabled && styles.disabled,
                containerStyle,
                style
            ]}
            activeOpacity={0.7}
            {...props}
        >
            {content}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: layout.borderRadius.full,
        overflow: 'hidden',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: layout.borderRadius.full,
    },
    text: {
        fontFamily: 'Manrope-SemiBold',
        textAlign: 'center',
    },
    loader: {
        marginRight: spacing.sm,
    },
    icon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    disabled: {
        opacity: 0.7,
    }
});

function getVariantStyle(variant: string) {
    switch (variant) {
        case 'secondary':
            return {
                backgroundColor: colors.surfaceLight,
            };
        case 'outline':
            return {
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: colors.borderLight,
            };
        case 'glass':
            return {
                backgroundColor: colors.surfaceGlass,
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
            };
        default:
            return {};
    }
}

function getSizeStyle(size: string) {
    switch (size) {
        case 'sm':
            return {
                paddingVertical: 8,
                paddingHorizontal: 16,
            };
        case 'lg':
            return {
                paddingVertical: 16,
                paddingHorizontal: 32,
            };
        default: // md
            return {
                paddingVertical: 12,
                paddingHorizontal: 24,
            };
    }
}

function getTextStyle(variant: string, size: string, disabled: boolean) {
    const baseColor = disabled
        ? colors.textMuted
        : variant === 'primary' || variant === 'gradient'
            ? colors.textInvert
            : colors.text;

    const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;

    return {
        color: baseColor,
        fontSize,
    };
}

function getIconStyle(variant: string, disabled: boolean) {
    return {
        color: disabled
            ? colors.textMuted
            : variant === 'primary' || variant === 'gradient'
                ? colors.textInvert
                : colors.text
    };
}
