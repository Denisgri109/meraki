import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

interface SwipeableMessageProps {
    children: React.ReactNode;
    onReply: () => void;
    isMe: boolean;
}

export const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ children, onReply, isMe }) => {
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        const opacity = dragX.interpolate({
            inputRange: [-100, -50],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        // Only allow swipe if not me? Or for all? Usually both can reply.
        // Assuming right swipe to reply for everyone.
        // But if I am sender (isMe), my messages are on the right. Usually swipe left to reply on my messages?
        // Or swipe right? Standard is swipe right triggers reply regardless of side?
        // Let's stick to standard behavior: Swipe RIGHT usually reveals actions on LEFT.
        // But for messages, typically you drag the message bubble itself.
        // If message is on right (me), drag left to reveal reply?
        // If message is on left (other), drag right to reveal reply?

        // Let's implement standard "slide to reply".
        // Usually, sliding ANY message to the right triggers reply.

        return (
            <View style={styles.rightAction}>
                <Animated.View style={[styles.actionIcon, { transform: [{ scale: trans }], opacity: opacity }]}>
                    <Ionicons name="arrow-undo" size={24} color={colors.textMuted} />
                </Animated.View>
            </View>
        );
    };

    const renderLeftActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });

        const opacity = dragX.interpolate({
            inputRange: [50, 100],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });

        return (
            <View style={styles.leftAction}>
                <Animated.View style={[styles.actionIcon, { transform: [{ scale: trans }], opacity: opacity }]}>
                    <Ionicons name="arrow-undo" size={24} color={colors.textMuted} />
                </Animated.View>
            </View>
        );
    };

    // We want swipe RIGHT to reply.
    // So renderLeftActions is what appears when swiping RIGHT.
    // Wait, renderLeftActions appears on the left when swiping item to the RIGHT.

    const onSwipeableWillOpen = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onReply();
        swipeableRef.current?.close();
    };

    return (
        <Swipeable
            ref={swipeableRef}
            friction={2}
            enableTrackpadTwoFingerGesture
            renderLeftActions={renderLeftActions}
            onSwipeableWillOpen={onSwipeableWillOpen}
        // Add right actions if needed for other things, but for now just reply on right swipe
        >
            {children}
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    leftAction: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'flex-start', // Align to left side
        paddingLeft: 20,
    },
    rightAction: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 20,
    },
    actionIcon: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
