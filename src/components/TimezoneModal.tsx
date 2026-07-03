import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing } from '../theme';

interface Timezone {
    value: string;
    label: string;
}

interface TimezoneModalProps {
    visible: boolean;
    timezones: Timezone[];
    selectedTimezone: string;
    onSelect: (timezoneValue: string) => void;
    onClose: () => void;
}

export const TimezoneModal: React.FC<TimezoneModalProps> = ({
    visible,
    timezones,
    selectedTimezone,
    onSelect,
    onClose,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.dropdownOverlay}>
                <View style={styles.dropdownContent}>
                    <View style={styles.dropdownHeader}>
                        <Text style={styles.dropdownTitle}>Select Timezone</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.dropdownClose}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.dropdownList}>
                        {timezones.map((tz) => (
                            <TouchableOpacity
                                key={tz.value}
                                style={[styles.dropdownItem, selectedTimezone === tz.value && styles.dropdownItemSelected]}
                                onPress={() => {
                                    onSelect(tz.value);
                                    onClose();
                                }}
                            >
                                <Text style={[styles.dropdownItemText, selectedTimezone === tz.value && styles.dropdownItemTextSelected]}>
                                    {tz.label}
                                </Text>
                                {selectedTimezone === tz.value && <Text style={styles.checkmark}>✓</Text>}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end'
    },
    dropdownContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)'
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.04)'
    },
    dropdownTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text
    },
    dropdownClose: {
        fontSize: 20,
        color: colors.textMuted,
        padding: spacing.sm
    },
    dropdownList: {
        padding: spacing.md
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 16,
        marginBottom: spacing.xs
    },
    dropdownItemSelected: {
        backgroundColor: 'rgba(200, 160, 77, 0.1)'
    },
    dropdownItemText: {
        fontSize: 16,
        color: colors.text,
        flex: 1
    },
    dropdownItemTextSelected: {
        color: colors.primary,
        fontWeight: '700'
    },
    checkmark: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: '800'
    },
});

export default TimezoneModal;
