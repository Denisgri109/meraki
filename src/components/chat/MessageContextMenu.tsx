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
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../../theme';
import { MerakiText } from '../ui';
import * as Haptics from 'expo-haptics';

interface MessageContextMenuProps {
    visible: boolean;
    onClose: () => void;
    message: any; // Using any for now to avoid circular dependency or duplicating types, ideally import shared type
    yPosition?: number | null;
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
    yPosition,
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

    const screenHeight = Dimensions.get('window').height;
    const safeY = yPosition ? Math.max(100, Math.min(yPosition - 50, screenHeight - 400)) : screenHeight / 2 - 150;

    return (
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />

                    <Animated.View
                        style={[
                            styles.popupWrapper,
                            {
                                top: safeY,
                                opacity: opacityAnim,
                                transform: [{ scale: scaleAnim }],
                                alignItems: isMe ? 'flex-end' : 'flex-start'
                            },
                        ]}
                    >
                        {/* Actions Menu */}
                        <View style={styles.menuContainer}>
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
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    popupWrapper: {
        position: 'absolute',
        width: '100%',
        paddingHorizontal: spacing.lg,
    },
    menuContainer: {
        width: Dimensions.get('window').width * 0.65,
        marginTop: 8,
    },
    previewBubble: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        maxWidth: Dimensions.get('window').width * 0.85,
    },
    bubbleGradient: {
        shadowColor: '#d4145a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 3,
    },
    bubbleGlass: {
        backgroundColor: 'rgba(0, 0, 0, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    previewLeft: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    previewRight: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    previewText: {
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
        fontFamily: 'Manrope-Regular',
        letterSpacing: 0.3,
    },
    menuItems: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
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
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        marginLeft: 16,
    },
});
