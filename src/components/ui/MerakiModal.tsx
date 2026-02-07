import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
    TextInput,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, gradients } from '../../theme';
import { Card } from './Card';

const { width } = Dimensions.get('window');

export interface MerakiModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    confirmDestructive?: boolean;
    loading?: boolean;
    icon?: string;
    children?: React.ReactNode;
    hideCancel?: boolean;
    autoClose?: boolean;
    type?: 'success' | 'error' | 'warning' | 'info' | 'default';
}

/**
 * Standardized Glassmorphic Modal for Merakí App
 */
export function MerakiModal({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmDestructive = false,
    loading = false,
    icon,
    children,
    hideCancel = false,
    autoClose = false,
    type = 'default',
}: MerakiModalProps) {

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (visible && autoClose) {
            timeout = setTimeout(() => {
                onClose();
            }, 2000);
        }
        return () => clearTimeout(timeout);
    }, [visible, autoClose, onClose]);

    // Determine icon based on type if not provided
    const getIcon = () => {
        if (icon) return icon;
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return null;
        }
    };

    const displayIcon = getIcon();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modalContainer}>
                            {/* Premium Opaque Card Container */}
                            <View style={styles.cardContainer}>
                                {/* Gradient Border */}
                                <LinearGradient
                                    colors={['rgba(212, 138, 130, 0.5)', 'rgba(230, 192, 144, 0.3)']} /* Rose Gold to Champagne */
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.gradientBorder}
                                >
                                    <View style={styles.innerCard}>
                                        <View style={styles.content}>
                                            {/* Icon */}
                                            {displayIcon && (
                                                <LinearGradient
                                                    colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                                    style={styles.iconContainer}
                                                >
                                                    <Text style={styles.icon}>{displayIcon}</Text>
                                                </LinearGradient>
                                            )}

                                            {/* Title */}
                                            <Text style={styles.title}>{title}</Text>

                                            {/* Message */}
                                            {message && (
                                                <Text style={styles.message}>{message}</Text>
                                            )}

                                            {/* Custom Content */}
                                            {children}

                                            {/* Actions */}
                                            <View style={styles.actions}>
                                                {!hideCancel && (
                                                    <TouchableOpacity
                                                        style={styles.cancelButton}
                                                        onPress={onClose}
                                                        disabled={loading}
                                                    >
                                                        <Text style={styles.cancelButtonText}>{cancelText}</Text>
                                                    </TouchableOpacity>
                                                )}

                                                {(onConfirm || hideCancel) && (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.confirmButton,
                                                            confirmDestructive && styles.confirmButtonDestructive,
                                                            hideCancel && styles.confirmButtonFull,
                                                        ]}
                                                        onPress={onConfirm || onClose}
                                                        disabled={loading}
                                                    >
                                                        {loading ? (
                                                            <ActivityIndicator color={colors.text} size="small" />
                                                        ) : (
                                                            <LinearGradient
                                                                colors={confirmDestructive ? [colors.error, colors.error] : gradients.primary}
                                                                start={{ x: 0, y: 0 }}
                                                                end={{ x: 1, y: 0 }}
                                                                style={StyleSheet.absoluteFill}
                                                            />
                                                        )}
                                                        {!loading && (
                                                            <Text style={styles.confirmButtonText}>{confirmText}</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </LinearGradient>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

// Backward compatibility alias
export const ConfirmModal = MerakiModal;

// Alert Modal - For simple alerts with just an OK button
interface AlertModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message?: string;
    buttonText?: string;
    icon?: string;
    type?: 'success' | 'error' | 'warning' | 'info';
}

export function AlertModal({
    visible,
    onClose,
    title,
    message,
    buttonText = 'OK',
    icon,
    type = 'info',
}: AlertModalProps) {
    return (
        <MerakiModal
            visible={visible}
            onClose={onClose}
            onConfirm={onClose}
            title={title}
            message={message}
            confirmText={buttonText}
            icon={icon}
            type={type}
            hideCancel
        />
    );
}

// Input Modal - For modals with text input
interface InputModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    placeholder?: string;
    initialValue?: string;
    submitText?: string;
    loading?: boolean;
}

export function InputModal({
    visible,
    onClose,
    onSubmit,
    title,
    placeholder = '',
    initialValue = '',
    submitText = 'Submit',
    loading = false,
}: InputModalProps) {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (visible) setValue(initialValue);
    }, [visible, initialValue]);

    return (
        <MerakiModal
            visible={visible}
            onClose={onClose}
            onConfirm={() => onSubmit(value)}
            title={title}
            confirmText={submitText}
            loading={loading}
        >
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={setValue}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                />
            </View>
        </MerakiModal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Restored dimming (user wanted "not see-through" referring to the CARD, but usually overlay should dim)
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
    },
    cardContainer: {
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        // Shadow for depth
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    gradientBorder: {
        padding: 1, // 1px border width
        borderRadius: borderRadius.xl,
    },
    innerCard: {
        backgroundColor: colors.surface, // Solid opaque background
        borderRadius: borderRadius.xl - 1, // Slightly less than container
        overflow: 'hidden',
    },
    content: {
        padding: spacing.xl,
        alignItems: 'center',
        backgroundColor: colors.surface, // Ensure solid color
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    icon: {
        fontSize: 32,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
        letterSpacing: 0.5,
    },
    message: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: spacing.xl,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    confirmButtonFull: {
        flex: 1,
    },
    confirmButtonDestructive: {
        backgroundColor: colors.error,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
        zIndex: 1,
    },
    inputContainer: {
        width: '100%',
        marginBottom: spacing.lg,
    },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
});
