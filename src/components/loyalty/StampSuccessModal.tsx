import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Animated,
    Dimensions,
} from 'react-native';
import { colors, spacing } from '../../theme';
import { Button } from '../ui';

interface StampSuccessModalProps {
    visible: boolean;
    onClose: () => void;
    cardName?: string;
    masterName?: string;
    stampsCollected: number;
    stampsRequired: number;
    rewardAvailable: boolean;
}

const { width } = Dimensions.get('window');

export function StampSuccessModal({
    visible,
    onClose,
    cardName = 'Loyalty Card',
    masterName = 'Master',
    stampsCollected,
    stampsRequired,
    rewardAvailable,
}: StampSuccessModalProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Reset animations
            scaleAnim.setValue(0);
            rotateAnim.setValue(0);
            fadeAnim.setValue(0);

            // Start animations
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 4,
                        tension: 40,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.spring(rotateAnim, {
                    toValue: 1,
                    friction: 3,
                    tension: 100,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-close after 3 seconds if not reward
            if (!rewardAvailable) {
                const timer = setTimeout(() => {
                    onClose();
                }, 3000);
                return () => clearTimeout(timer);
            }
        }
    }, [visible, rewardAvailable]);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const renderStampDots = () => {
        const dots = [];
        for (let i = 0; i < stampsRequired; i++) {
            const isFilled = i < stampsCollected;
            const isLatest = i === stampsCollected - 1;
            dots.push(
                <View
                    key={i}
                    style={[
                        styles.stampDot,
                        isFilled && styles.stampDotFilled,
                        isLatest && styles.stampDotLatest,
                    ]}
                >
                    {isFilled && <Text style={styles.stampCheck}>✓</Text>}
                </View>
            );
        }
        return dots;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: fadeAnim,
                        },
                    ]}
                >
                    {/* Animated stamp icon */}
                    <Animated.View
                        style={[
                            styles.stampIconContainer,
                            { transform: [{ rotate: rotation }] },
                        ]}
                    >
                        <Text style={styles.stampIcon}>
                            {rewardAvailable ? '🎁' : '✨'}
                        </Text>
                    </Animated.View>

                    {/* Title */}
                    <Text style={styles.title}>
                        {rewardAvailable ? 'Reward Earned!' : 'Stamp Collected!'}
                    </Text>

                    {/* Card info */}
                    <Text style={styles.cardName}>{cardName}</Text>
                    <Text style={styles.masterName}>from {masterName}</Text>

                    {/* Progress dots */}
                    <View style={styles.dotsContainer}>{renderStampDots()}</View>

                    {/* Progress text */}
                    <Text style={styles.progressText}>
                        {stampsCollected}/{stampsRequired} stamps
                    </Text>

                    {/* Message */}
                    <Text style={styles.message}>
                        {rewardAvailable
                            ? 'Congratulations! Visit your stamp cards to claim your reward.'
                            : `${stampsRequired - stampsCollected} more stamp${stampsRequired - stampsCollected === 1 ? '' : 's'
                            } to go!`}
                    </Text>

                    {/* Close button */}
                    <Button
                        title={rewardAvailable ? 'View My Cards' : 'Awesome!'}
                        onPress={onClose}
                        style={styles.button}
                    />
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: width * 0.85,
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: spacing.xl,
        alignItems: 'center',
    },
    stampIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: `${colors.primary}20`,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    stampIcon: {
        fontSize: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    cardName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    masterName: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    dotsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: spacing.md,
        maxWidth: '100%',
    },
    stampDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.border,
        margin: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stampDotFilled: {
        backgroundColor: colors.primary,
    },
    stampDotLatest: {
        backgroundColor: colors.success,
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 4,
    },
    stampCheck: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    progressText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
    },
    message: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 20,
    },
    button: {
        width: '100%',
    },
});

export default StampSuccessModal;
