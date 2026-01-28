import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../../theme';

interface ConfirmModalProps {
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
}

export function ConfirmModal({
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
}: ConfirmModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.container}>
                            {/* Gradient Border Effect */}
                            <LinearGradient
                                colors={['rgba(139,92,246,0.3)', 'rgba(59,130,246,0.3)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.gradientBorder}
                            />

                            <View style={styles.content}>
                                {/* Icon */}
                                {icon && (
                                    <View style={styles.iconContainer}>
                                        <Text style={styles.icon}>{icon}</Text>
                                    </View>
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

                                    {onConfirm && (
                                        <TouchableOpacity
                                            style={[
                                                styles.confirmButton,
                                                confirmDestructive && styles.confirmButtonDestructive,
                                                hideCancel && styles.confirmButtonFull,
                                            ]}
                                            onPress={onConfirm}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color={colors.text} size="small" />
                                            ) : (
                                                <Text style={styles.confirmButtonText}>{confirmText}</Text>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

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
    const getDefaultIcon = () => {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    };

    return (
        <ConfirmModal
            visible={visible}
            onClose={onClose}
            onConfirm={onClose}
            title={title}
            message={message}
            confirmText={buttonText}
            icon={icon || getDefaultIcon()}
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
    const [value, setValue] = React.useState(initialValue);

    React.useEffect(() => {
        if (visible) setValue(initialValue);
    }, [visible, initialValue]);

    return (
        <ConfirmModal
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
        </ConfirmModal>
    );
}

import { TextInput } from 'react-native';

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    gradientBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
    },
    content: {
        margin: 1,
        backgroundColor: colors.surface,
        borderRadius: 23,
        padding: spacing.xl,
        alignItems: 'center',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    icon: {
        fontSize: 32,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    message: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
        marginTop: spacing.md,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
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
        color: colors.text,
    },
    inputContainer: {
        width: '100%',
        marginBottom: spacing.md,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
});

export default ConfirmModal;
