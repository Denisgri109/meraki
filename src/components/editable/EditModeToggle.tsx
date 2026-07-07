import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditMode } from '../../contexts/EditContext';
import { colors, layout } from '../../theme/colors';

export function EditModeToggle() {
    const { isEditMode, canEdit, toggleEditMode } = useEditMode();

    if (!canEdit) return null;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isEditMode ? styles.active : styles.inactive,
            ]}
            onPress={toggleEditMode}
            activeOpacity={0.7}
        >
            <MaterialIcons
                name={isEditMode ? 'check' : 'edit'}
                size={14}
                color={isEditMode ? '#fff' : colors.accent}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 36,
        height: 36,
        borderRadius: layout.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    active: {
        backgroundColor: '#22C55E',
    },
    inactive: {
        backgroundColor: colors.gold,
    },
});
