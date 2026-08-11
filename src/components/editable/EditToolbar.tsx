import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditMode } from '../../contexts/EditContext';
import { colors } from '../../theme';

/**
 * Floating owner-only toolbar. Mounted once inside the navigation container so
 * it follows the owner across every screen, which is what makes inline editing
 * usable — otherwise edit mode would only be reachable from the dashboard.
 *
 * Renders nothing unless the signed-in user is an owner AND has either Visual
 * Edit Mode or Client View turned on, so clients and masters never see it.
 */
export function EditToolbar() {
    const navigation = useNavigation<any>();
    const { canEdit, isEditMode, isClientView, setEditMode, setClientView } = useEditMode();

    const openCustomize = useCallback(() => {
        navigation.navigate('OwnerApp', {
            screen: 'Menu',
            params: { screen: 'CustomizeApp' },
        });
    }, [navigation]);

    const exitAll = useCallback(() => {
        setEditMode(false);
        setClientView(false);
    }, [setEditMode, setClientView]);

    if (!canEdit || (!isEditMode && !isClientView)) return null;

    return (
        <View style={styles.container} pointerEvents="box-none">
            <View
                style={styles.pill}
                accessibilityRole="toolbar"
                accessibilityLabel="Visual edit mode toolbar"
            >
                <View style={styles.status}>
                    <View style={[styles.dot, isEditMode ? styles.dotEditing : styles.dotPreview]} />
                    <Text style={styles.statusText}>
                        {isClientView ? 'Client View' : 'Editing'}
                    </Text>
                </View>

                <View style={styles.divider} />

                {isClientView ? (
                    <>
                        <ToolbarButton
                            icon={isEditMode ? 'check' : 'edit'}
                            label={isEditMode ? 'Editing On' : 'Edit'}
                            onPress={() => setEditMode(!isEditMode)}
                            variant={isEditMode ? 'primary' : 'ghost'}
                        />
                        <ToolbarButton
                            icon="logout"
                            label="Exit"
                            onPress={exitAll}
                            variant="dark"
                        />
                    </>
                ) : (
                    <>
                        <ToolbarButton
                            icon="tune"
                            label="Customize"
                            onPress={openCustomize}
                            variant="primary"
                        />
                        <ToolbarButton
                            icon="visibility"
                            label="Client View"
                            onPress={() => setClientView(true)}
                            variant="ghost"
                        />
                        <ToolbarButton
                            icon="close"
                            label="Done"
                            onPress={exitAll}
                            variant="dark"
                        />
                    </>
                )}
            </View>
        </View>
    );
}

function ToolbarButton({
    icon,
    label,
    onPress,
    variant,
}: {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    onPress: () => void;
    variant: 'primary' | 'ghost' | 'dark';
}) {
    const isPrimary = variant === 'primary';
    const isDark = variant === 'dark';
    const tint = isPrimary || isDark ? '#fff' : colors.textSecondary;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[
                styles.button,
                isPrimary && styles.buttonPrimary,
                isDark && styles.buttonDark,
                variant === 'ghost' && styles.buttonGhost,
            ]}
        >
            <MaterialIcons name={icon} size={14} color={tint} />
            <Text style={[styles.buttonText, { color: tint }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        // Clears the tab bar on both platforms.
        bottom: Platform.OS === 'ios' ? 96 : 76,
        alignItems: 'center',
        zIndex: 100,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 14,
        paddingRight: 6,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.97)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
        maxWidth: '96%',
    },
    status: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotEditing: {
        backgroundColor: '#22C55E',
    },
    dotPreview: {
        backgroundColor: '#8B5CF6',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
    },
    divider: {
        width: 1,
        height: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        marginHorizontal: 2,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
    },
    buttonPrimary: {
        backgroundColor: '#EC4899',
    },
    buttonGhost: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    buttonDark: {
        backgroundColor: '#1A1A1A',
    },
    buttonText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default EditToolbar;
