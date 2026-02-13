import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { colors, spacing } from '../../theme';

interface SearchablePickerItem {
    id: string | number;
    name: string;
    subtitle?: string;
}

interface SearchablePickerProps {
    visible: boolean;
    title: string;
    items: SearchablePickerItem[];
    selectedId?: string | number | null;
    onSelect: (item: SearchablePickerItem) => void;
    onClose: () => void;
    searchPlaceholder?: string;
    loading?: boolean;
    emptyMessage?: string;
}

export function SearchablePicker({
    visible,
    title,
    items,
    selectedId,
    onSelect,
    onClose,
    searchPlaceholder = 'Search...',
    loading = false,
    emptyMessage = 'No results found',
}: SearchablePickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredItems, setFilteredItems] = useState<SearchablePickerItem[]>(items);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredItems(items.slice(0, 100)); // Limit initial display
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = items.filter(item =>
                item.name.toLowerCase().includes(query)
            ).slice(0, 100);
            setFilteredItems(filtered);
        }
    }, [searchQuery, items]);

    // Reset search when modal opens
    useEffect(() => {
        if (visible) {
            setSearchQuery('');
        }
    }, [visible]);

    const handleSelect = useCallback((item: SearchablePickerItem) => {
        onSelect(item);
        onClose();
    }, [onSelect, onClose]);

    const renderItem = ({ item }: { item: SearchablePickerItem }) => (
        <TouchableOpacity
            style={[
                styles.item,
                selectedId === item.id && styles.itemSelected,
            ]}
            onPress={() => handleSelect(item)}
        >
            <View style={styles.itemContent}>
                <Text style={[
                    styles.itemText,
                    selectedId === item.id && styles.itemTextSelected,
                ]}>
                    {item.name}
                </Text>
                {item.subtitle && (
                    <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                )}
            </View>
            {selectedId === item.id && (
                <Text style={styles.checkmark}>✓</Text>
            )}
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={searchPlaceholder}
                            placeholderTextColor={colors.textMuted}
                            autoFocus={false}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearBtn}
                                onPress={() => setSearchQuery('')}
                            >
                                <Text style={styles.clearText}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* List */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Loading...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredItems}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={renderItem}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            style={styles.list}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        minHeight: '50%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    closeBtn: {
        padding: spacing.sm,
    },
    closeText: {
        fontSize: 20,
        color: colors.textMuted,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.lg,
        marginVertical: spacing.md,
        backgroundColor: colors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: {
        flex: 1,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
    },
    clearBtn: {
        padding: spacing.md,
    },
    clearText: {
        fontSize: 16,
        color: colors.textMuted,
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: spacing.md,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.xs,
    },
    itemSelected: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    itemContent: {
        flex: 1,
    },
    itemText: {
        fontSize: 16,
        color: colors.text,
    },
    itemTextSelected: {
        color: colors.primary,
        fontWeight: '500',
    },
    itemSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
    checkmark: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: '600',
        marginLeft: spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: 14,
        color: colors.textMuted,
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: colors.textMuted,
        textAlign: 'center',
    },
});

export default SearchablePicker;
