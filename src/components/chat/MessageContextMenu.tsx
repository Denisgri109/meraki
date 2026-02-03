import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import * as Haptics from 'expo-haptics';

interface MessageContextMenuProps {
    visible: boolean;
    onClose: () => void;
    message: any; // Using any for now to avoid circular dependency or duplicating types, ideally import shared type
    onReply: () => void;
    onCopy: () => void;
    onDelete?: () => void; // Optional, only if it's my message
    onForward?: () => void;
    isMe: boolean;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
    visible,
    onClose,
    message,
    onReply,
    onCopy,
    onDelete,
    onForward,
    isMe,
}) => {
    const scaleAnim = new Animated.Value(0.9);
    const opacityAnim = new Animated.Value(0);

    useEffect(() => {
        if (visible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    damping: 15,
                    stiffness: 150,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.9);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    const handleAction = (action: () => void) => {
        onClose();
        // Small delay to allow menu to close before action triggers (ui responsiveness)
        setTimeout(action, 100);
    };

    return (
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

                    <Animated.View
                        style={[
                            styles.menuContainer,
                            {
                                opacity: opacityAnim,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        {/* Message Preview (Simplified) */}
                        <View style={[styles.previewBubble, isMe ? styles.previewRight : styles.previewLeft]}>
                            <Text style={styles.previewText} numberOfLines={3}>
                                {message.content || (message.media_url ? '📷 Media' : '')}
                            </Text>
                        </View>

                        {/* Actions Menu */}
                        <View style={styles.menuItems}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction(onReply)}>
                                <Text style={styles.menuText}>Reply</Text>
                                <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction(onCopy)}>
                                <Text style={styles.menuText}>Copy</Text>
                                <Ionicons name="copy-outline" size={20} color={colors.text} />
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.menuItem} onPress={() => {
                                // Forward placeholder
                                if (onForward) handleAction(onForward);
                                else handleAction(() => { });
                            }}>
                                <Text style={styles.menuText}>Forward</Text>
                                <Ionicons name="arrow-redo-outline" size={20} color={colors.text} />
                            </TouchableOpacity>

                            {isMe && onDelete && (
                                <>
                                    <View style={styles.divider} />
                                    <TouchableOpacity style={styles.menuItem} onPress={() => handleAction(onDelete)}>
                                        <Text style={[styles.menuText, styles.destructiveText]}>Delete</Text>
                                        <Ionicons name="trash-outline" size={20} color={colors.error || '#FF453A'} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </Animated.View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    menuContainer: {
        width: Dimensions.get('window').width * 0.7,
        alignItems: 'center',
    },
    previewBubble: {
        padding: spacing.md,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: spacing.lg,
        maxWidth: '100%',
    },
    previewLeft: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    previewRight: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
        backgroundColor: colors.primary,
    },
    previewText: {
        color: colors.text,
        fontSize: 16,
    },
    menuItems: {
        width: '100%',
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        borderRadius: 16,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'transparent',
    },
    menuText: {
        fontSize: 17,
        color: colors.text,
        fontWeight: '500',
    },
    destructiveText: {
        color: colors.error || '#FF453A',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginLeft: 16,
    },
});
