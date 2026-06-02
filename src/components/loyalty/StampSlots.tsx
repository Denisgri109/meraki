import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface StampSlotsProps {
    stampsRequired: number;
    stampsCollected: number;
    containerStyle?: StyleProp<ViewStyle>;
    slotStyle?: StyleProp<ViewStyle>;
    collectedSlotStyle?: StyleProp<ViewStyle>;
}

export const StampSlots: React.FC<StampSlotsProps> = ({
    stampsRequired,
    stampsCollected,
    containerStyle,
    slotStyle,
    collectedSlotStyle,
}) => {
    const slots = [];
    for (let i = 0; i < stampsRequired; i++) {
        const isCollected = i < stampsCollected;
        slots.push(
            <View
                key={i}
                style={[
                    styles.stampSlot,
                    slotStyle,
                    isCollected && styles.stampSlotCollected,
                    isCollected && collectedSlotStyle,
                ]}
            >
                {isCollected ? (
                    <MaterialIcons name="star" size={16} color="#fff" />
                ) : (
                    <MaterialIcons name="star-border" size={16} color="rgba(0, 0, 0, 0.08)" />
                )}
            </View>
        );
    }

    return <View style={[styles.slotsGrid, containerStyle]}>{slots}</View>;
};

const styles = StyleSheet.create({
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    stampSlot: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stampSlotCollected: {
        backgroundColor: colors.primary,
        borderColor: 'rgba(0, 0, 0, 0.12)',
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
});
