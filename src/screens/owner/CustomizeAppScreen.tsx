import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditMode } from '../../contexts/EditContext';
import { ImageUrlUpload } from '../../components/ImageUrlUpload';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, layout } from '../../theme';
import { safeGoBack } from '../../navigation/navigationUtils';
import {
    TEXT_GROUPS,
    IMAGE_FIELDS,
    RESET_SECTIONS,
    SUPPORT_SETTING_FIELDS,
    FAQ_CATEGORIES,
    FAQ_ITEMS_KEY,
    SUPPORT_SETTINGS_KEY,
    DEFAULT_SUPPORT_SETTINGS,
    parseFaqItems,
    parseSupportSettings,
    type FaqItem,
    type SupportSettings,
} from '../../lib/mobileContent';

type TabId = 'text' | 'images' | 'support' | 'reset';

const TABS: { id: TabId; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'text', label: 'Text', icon: 'title' },
    { id: 'images', label: 'Images', icon: 'image' },
    { id: 'support', label: 'Support', icon: 'help-outline' },
    { id: 'reset', label: 'Reset', icon: 'restore' },
];

const emptyFaqForm = { question: '', answer: '', category: 'General' };

export function CustomizeAppScreen() {
    const navigation = useNavigation<any>();
    const {
        isEditMode,
        canEdit,
        isClientView,
        toggleEditMode,
        setClientView,
        content,
        getContent,
        updateContent,
        clearContent,
        refreshContent,
        resetContent,
    } = useEditMode();

    const [activeTab, setActiveTab] = useState<TabId>('text');
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ home: true });
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null);
    const [resettingSection, setResettingSection] = useState<string | null>(null);

    // Support & FAQ
    const [supportDraft, setSupportDraft] = useState<SupportSettings>(DEFAULT_SUPPORT_SETTINGS);
    const [savingSupport, setSavingSupport] = useState(false);
    const [faqModalOpen, setFaqModalOpen] = useState(false);
    const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
    const [faqForm, setFaqForm] = useState(emptyFaqForm);
    const [savingFaqs, setSavingFaqs] = useState(false);

    const faqs = useMemo(() => parseFaqItems(content[FAQ_ITEMS_KEY]), [content]);
    const savedSupport = useMemo(
        () => parseSupportSettings(content[SUPPORT_SETTINGS_KEY]),
        [content]
    );

    useEffect(() => {
        refreshContent();
    }, [refreshContent]);

    useEffect(() => {
        setSupportDraft(savedSupport);
    }, [savedSupport]);

    const customCount = useMemo(
        () =>
            Object.keys(content).filter(
                (k) =>
                    RESET_SECTIONS.some((s) => s.prefixes.some((p) => k.startsWith(p))) ||
                    RESET_SECTIONS.some((s) => s.keys.includes(k))
            ).length,
        [content]
    );

    // ─── Text ───────────────────────────────────────────────────────────

    const draftFor = useCallback(
        (key: string, fallback: string) => drafts[key] ?? getContent(key, fallback),
        [drafts, getContent]
    );

    const handleSaveText = useCallback(
        async (key: string) => {
            const value = drafts[key];
            if (value === undefined) return;
            setSavingKey(key);
            const { error } = await updateContent(key, value);
            setSavingKey(null);
            if (error) {
                Alert.alert('Could not save', error);
                return;
            }
            setDrafts((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        },
        [drafts, updateContent]
    );

    const handleResetText = useCallback(
        async (key: string) => {
            setSavingKey(key);
            const { error } = await clearContent(key);
            setSavingKey(null);
            if (error) {
                Alert.alert('Could not reset', error);
                return;
            }
            setDrafts((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        },
        [clearContent]
    );

    // ─── Images ─────────────────────────────────────────────────────────

    const handleUploadFor = useCallback(
        (contentKey: string) => async (publicUrl: string) => {
            const { error } = await updateContent(contentKey, publicUrl);
            setActiveUploadKey(null);
            if (error) Alert.alert('Could not save image', error);
        },
        [updateContent]
    );

    const handleResetImage = useCallback(
        (contentKey: string) => {
            Alert.alert('Reset Image', 'Reset this image back to the original?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await clearContent(contentKey);
                        if (error) Alert.alert('Could not reset', error);
                    },
                },
            ]);
        },
        [clearContent]
    );

    // ─── Support & FAQ ──────────────────────────────────────────────────

    const supportDirty = useMemo(
        () => SUPPORT_SETTING_FIELDS.some((f) => supportDraft[f.field] !== savedSupport[f.field]),
        [supportDraft, savedSupport]
    );

    const handleSaveSupport = useCallback(async () => {
        setSavingSupport(true);
        const { error } = await updateContent(SUPPORT_SETTINGS_KEY, JSON.stringify(supportDraft));
        setSavingSupport(false);
        if (error) Alert.alert('Could not save support details', error);
    }, [supportDraft, updateContent]);

    const persistFaqs = useCallback(
        async (next: FaqItem[]) => {
            setSavingFaqs(true);
            const ordered = next.map((f, i) => ({ ...f, order: i }));
            const { error } = await updateContent(FAQ_ITEMS_KEY, JSON.stringify(ordered));
            setSavingFaqs(false);
            if (error) Alert.alert('Could not save FAQ', error);
            return !error;
        },
        [updateContent]
    );

    const openFaqEditor = useCallback((faq?: FaqItem) => {
        if (faq) {
            setEditingFaqId(faq.id);
            setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category });
        } else {
            setEditingFaqId(null);
            setFaqForm(emptyFaqForm);
        }
        setFaqModalOpen(true);
    }, []);

    const handleSaveFaq = useCallback(async () => {
        if (!faqForm.question.trim() || !faqForm.answer.trim()) {
            Alert.alert('Missing details', 'A question and an answer are both required.');
            return;
        }
        const next = editingFaqId
            ? faqs.map((f) =>
                f.id === editingFaqId
                    ? { ...f, question: faqForm.question, answer: faqForm.answer, category: faqForm.category }
                    : f
            )
            : [
                ...faqs,
                {
                    id: `${Date.now()}`,
                    question: faqForm.question,
                    answer: faqForm.answer,
                    category: faqForm.category,
                    order: faqs.length,
                },
            ];
        const ok = await persistFaqs(next);
        if (ok) setFaqModalOpen(false);
    }, [faqForm, editingFaqId, faqs, persistFaqs]);

    const handleDeleteFaq = useCallback(
        (faq: FaqItem) => {
            Alert.alert('Delete question', `Remove "${faq.question}" from the FAQ?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => persistFaqs(faqs.filter((f) => f.id !== faq.id)),
                },
            ]);
        },
        [faqs, persistFaqs]
    );

    // ─── Reset ──────────────────────────────────────────────────────────

    const handleResetSection = useCallback(
        (sectionId: string, title: string, prefixes: string[], keys: string[]) => {
            Alert.alert(
                `Reset ${title}`,
                'This restores the original content for this section and cannot be undone.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                            setResettingSection(sectionId);
                            let failure: string | null = null;
                            for (const prefix of prefixes) {
                                const { error } = await resetContent(prefix);
                                if (error) failure = error;
                            }
                            for (const key of keys) {
                                const { error } = await clearContent(key);
                                if (error) failure = error;
                            }
                            await refreshContent();
                            setResettingSection(null);
                            if (failure) Alert.alert('Reset incomplete', failure);
                        },
                    },
                ]
            );
        },
        [resetContent, clearContent, refreshContent]
    );

    // Non-owners can never reach this screen through the UI; this is the
    // belt-and-braces guard for deep links and stale navigation state.
    if (!canEdit) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.safeArea} edges={['top']}>
                    <View style={styles.deniedWrap}>
                        <MaterialIcons name="lock" size={40} color={colors.textMuted} />
                        <MerakiText style={styles.deniedTitle}>Owners only</MerakiText>
                        <MerakiText style={styles.deniedText}>
                            Only the salon owner can customize the app.
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.deniedButton}
                            onPress={() => safeGoBack(navigation)}
                        >
                            <MerakiText style={styles.deniedButtonText}>Go back</MerakiText>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => safeGoBack(navigation)} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText style={styles.headerTitle}>Customize App</MerakiText>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Visual edit mode */}
                    <View style={styles.toggleCard}>
                        <View style={styles.toggleRow}>
                            <View
                                style={[
                                    styles.toggleIcon,
                                    isEditMode ? styles.toggleIconActive : styles.toggleIconInactive,
                                ]}
                            >
                                <MaterialIcons
                                    name={isEditMode ? 'check' : 'edit'}
                                    size={22}
                                    color={isEditMode ? '#22C55E' : '#EC4899'}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <MerakiText style={styles.toggleTitle}>
                                    Visual Edit Mode: {isEditMode ? 'ON' : 'OFF'}
                                </MerakiText>
                                <MerakiText style={styles.toggleSubtitle}>
                                    {isEditMode
                                        ? 'Browse the app and tap any pink-outlined text or image to change it.'
                                        : 'Turn on to edit text and images directly on any screen.'}
                                </MerakiText>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.toggleButton,
                                    isEditMode ? styles.toggleButtonActive : styles.toggleButtonInactive,
                                ]}
                                onPress={toggleEditMode}
                                activeOpacity={0.7}
                            >
                                <MerakiText style={styles.toggleButtonText}>
                                    {isEditMode ? 'Turn Off' : 'Turn On'}
                                </MerakiText>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.clientViewRow}
                            onPress={() => setClientView(!isClientView)}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="visibility" size={18} color="#8B5CF6" />
                            <MerakiText style={styles.clientViewText}>
                                {isClientView
                                    ? 'Exit Client View'
                                    : 'Open Client View — edit the client screens'}
                            </MerakiText>
                            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabBar}>
                        {TABS.map((tab) => {
                            const active = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tab, active && styles.tabActive]}
                                    onPress={() => setActiveTab(tab.id)}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons
                                        name={tab.icon}
                                        size={16}
                                        color={active ? '#fff' : colors.textSecondary}
                                    />
                                    <MerakiText
                                        style={[styles.tabText, active && styles.tabTextActive]}
                                    >
                                        {tab.label}
                                    </MerakiText>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {activeTab === 'text' && (
                        <View>
                            <View style={styles.infoBanner}>
                                <MaterialIcons name="info" size={18} color={colors.textSecondary} />
                                <MerakiText style={styles.infoText}>
                                    Turn on Visual Edit Mode to tap and edit most of this copy
                                    directly on the screen it appears on. Sign-in copy can only be
                                    changed from here.
                                </MerakiText>
                            </View>

                            {TEXT_GROUPS.map((group) => {
                                const open = openGroups[group.id] ?? false;
                                const customInGroup = group.fields.filter(
                                    (f) => content[f.key] !== undefined
                                ).length;

                                return (
                                    <View key={group.id} style={styles.groupCard}>
                                        <TouchableOpacity
                                            style={styles.groupHeader}
                                            onPress={() =>
                                                setOpenGroups((prev) => ({ ...prev, [group.id]: !open }))
                                            }
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <MerakiText style={styles.groupTitle}>
                                                    {group.title}
                                                    {customInGroup > 0 ? `  •  ${customInGroup} edited` : ''}
                                                </MerakiText>
                                                <MerakiText style={styles.groupDesc}>
                                                    {group.description}
                                                </MerakiText>
                                            </View>
                                            <MaterialIcons
                                                name={open ? 'expand-less' : 'expand-more'}
                                                size={24}
                                                color={colors.textMuted}
                                            />
                                        </TouchableOpacity>

                                        {open &&
                                            group.fields.map((field) => {
                                                const current = getContent(field.key, field.fallback);
                                                const draft = draftFor(field.key, field.fallback);
                                                const dirty = draft !== current;
                                                const isCustom = content[field.key] !== undefined;
                                                const busy = savingKey === field.key;

                                                return (
                                                    <View key={field.key} style={styles.fieldWrap}>
                                                        <View style={styles.fieldLabelRow}>
                                                            <MerakiText style={styles.fieldLabel}>
                                                                {field.label}
                                                            </MerakiText>
                                                            {isCustom && (
                                                                <View style={styles.editedPill}>
                                                                    <Text style={styles.editedPillText}>
                                                                        EDITED
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <TextInput
                                                            style={[
                                                                styles.fieldInput,
                                                                field.multiline && styles.fieldInputMultiline,
                                                            ]}
                                                            value={draft}
                                                            onChangeText={(text) =>
                                                                setDrafts((prev) => ({
                                                                    ...prev,
                                                                    [field.key]: text,
                                                                }))
                                                            }
                                                            multiline={field.multiline}
                                                            placeholder={field.fallback}
                                                            placeholderTextColor={colors.textMuted}
                                                            textAlignVertical={
                                                                field.multiline ? 'top' : 'center'
                                                            }
                                                            editable={!busy}
                                                        />
                                                        {(dirty || isCustom) && (
                                                            <View style={styles.fieldActions}>
                                                                {dirty && (
                                                                    <TouchableOpacity
                                                                        style={[
                                                                            styles.smallButton,
                                                                            styles.smallButtonPrimary,
                                                                        ]}
                                                                        onPress={() =>
                                                                            handleSaveText(field.key)
                                                                        }
                                                                        disabled={busy}
                                                                    >
                                                                        {busy ? (
                                                                            <ActivityIndicator
                                                                                size="small"
                                                                                color="#fff"
                                                                            />
                                                                        ) : (
                                                                            <>
                                                                                <MaterialIcons
                                                                                    name="check"
                                                                                    size={14}
                                                                                    color="#fff"
                                                                                />
                                                                                <Text
                                                                                    style={
                                                                                        styles.smallButtonTextLight
                                                                                    }
                                                                                >
                                                                                    Save
                                                                                </Text>
                                                                            </>
                                                                        )}
                                                                    </TouchableOpacity>
                                                                )}
                                                                {isCustom && (
                                                                    <TouchableOpacity
                                                                        style={[
                                                                            styles.smallButton,
                                                                            styles.smallButtonDanger,
                                                                        ]}
                                                                        onPress={() =>
                                                                            handleResetText(field.key)
                                                                        }
                                                                        disabled={busy}
                                                                    >
                                                                        <MaterialIcons
                                                                            name="restore"
                                                                            size={14}
                                                                            color="#EF4444"
                                                                        />
                                                                        <Text style={styles.smallButtonTextDanger}>
                                                                            Original
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {activeTab === 'images' && (
                        <View style={styles.listContainer}>
                            {IMAGE_FIELDS.map((item, index) => {
                                const customUrl = getContent(item.key, '');
                                const hasCustom = Boolean(customUrl);
                                const imageSource = hasCustom
                                    ? { uri: customUrl }
                                    : item.fallbackSource;

                                return (
                                    <View
                                        key={item.key}
                                        style={[
                                            styles.imageCard,
                                            index === IMAGE_FIELDS.length - 1 && { borderBottomWidth: 0 },
                                        ]}
                                    >
                                        <View style={styles.imagePreviewWrap}>
                                            <Image
                                                source={imageSource as any}
                                                style={styles.imagePreview}
                                                resizeMode="cover"
                                            />
                                            {hasCustom && (
                                                <View style={styles.customBadge}>
                                                    <MaterialIcons name="edit" size={10} color="#fff" />
                                                    <Text style={styles.customBadgeText}>Custom</Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.imageInfo}>
                                            <MerakiText style={styles.imageLabel}>{item.label}</MerakiText>
                                            <MerakiText style={styles.imageDesc}>
                                                {item.description}
                                            </MerakiText>

                                            {activeUploadKey === item.key ? (
                                                <View style={styles.uploadWrap}>
                                                    <ImageUrlUpload
                                                        onUpload={handleUploadFor(item.key)}
                                                        bucket="site-images"
                                                        pathPrefix={item.pathPrefix}
                                                        label="Paste new image URL"
                                                        compact={false}
                                                    />
                                                    <TouchableOpacity
                                                        onPress={() => setActiveUploadKey(null)}
                                                        style={styles.cancelUploadBtn}
                                                    >
                                                        <MerakiText style={styles.cancelUploadText}>
                                                            Cancel
                                                        </MerakiText>
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <View style={styles.imageActions}>
                                                    <TouchableOpacity
                                                        style={styles.replaceBtn}
                                                        onPress={() => setActiveUploadKey(item.key)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <MaterialIcons
                                                            name="cloud-upload"
                                                            size={15}
                                                            color="#fff"
                                                        />
                                                        <MerakiText style={styles.replaceBtnText}>
                                                            Replace
                                                        </MerakiText>
                                                    </TouchableOpacity>
                                                    {hasCustom && (
                                                        <TouchableOpacity
                                                            style={styles.resetOneBtn}
                                                            onPress={() => handleResetImage(item.key)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <MaterialIcons
                                                                name="restore"
                                                                size={15}
                                                                color="#EF4444"
                                                            />
                                                            <MerakiText style={styles.resetOneText}>
                                                                Reset
                                                            </MerakiText>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {activeTab === 'support' && (
                        <View>
                            <View style={styles.infoBanner}>
                                <MaterialIcons name="info" size={18} color={colors.textSecondary} />
                                <MerakiText style={styles.infoText}>
                                    Support details and FAQ entries are shared with the website — one
                                    edit updates both.
                                </MerakiText>
                            </View>

                            <MerakiText style={styles.sectionLabel}>CONTACT DETAILS</MerakiText>
                            <View style={styles.groupCard}>
                                {SUPPORT_SETTING_FIELDS.map((field) => (
                                    <View key={field.field} style={styles.fieldWrap}>
                                        <MerakiText style={styles.fieldLabel}>{field.label}</MerakiText>
                                        <TextInput
                                            style={[
                                                styles.fieldInput,
                                                field.multiline && styles.fieldInputMultiline,
                                            ]}
                                            value={supportDraft[field.field]}
                                            onChangeText={(text) =>
                                                setSupportDraft((prev) => ({
                                                    ...prev,
                                                    [field.field]: text,
                                                }))
                                            }
                                            multiline={field.multiline}
                                            placeholder={field.placeholder}
                                            placeholderTextColor={colors.textMuted}
                                            autoCapitalize={field.field === 'email' ? 'none' : 'sentences'}
                                            keyboardType={
                                                field.field === 'email'
                                                    ? 'email-address'
                                                    : field.field === 'phone'
                                                        ? 'phone-pad'
                                                        : 'default'
                                            }
                                            textAlignVertical={field.multiline ? 'top' : 'center'}
                                        />
                                    </View>
                                ))}

                                {supportDirty && (
                                    <TouchableOpacity
                                        style={[styles.wideButton, savingSupport && styles.buttonDisabled]}
                                        onPress={handleSaveSupport}
                                        disabled={savingSupport}
                                    >
                                        {savingSupport ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <MaterialIcons name="check" size={16} color="#fff" />
                                                <Text style={styles.wideButtonText}>
                                                    Save Contact Details
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.faqHeaderRow}>
                                <MerakiText style={styles.sectionLabel}>
                                    FAQ ({faqs.length})
                                </MerakiText>
                                <TouchableOpacity
                                    style={styles.addFaqButton}
                                    onPress={() => openFaqEditor()}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="add" size={15} color="#fff" />
                                    <Text style={styles.addFaqText}>Add</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.listContainer}>
                                {faqs.map((faq, index) => (
                                    <View
                                        key={faq.id}
                                        style={[
                                            styles.faqRow,
                                            index === faqs.length - 1 && { borderBottomWidth: 0 },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <MerakiText style={styles.faqCategory}>
                                                {faq.category.toUpperCase()}
                                            </MerakiText>
                                            <MerakiText style={styles.faqQuestion}>
                                                {faq.question}
                                            </MerakiText>
                                            <MerakiText style={styles.faqAnswer} numberOfLines={2}>
                                                {faq.answer}
                                            </MerakiText>
                                        </View>
                                        <View style={styles.faqActions}>
                                            <TouchableOpacity
                                                onPress={() => openFaqEditor(faq)}
                                                style={styles.faqIconButton}
                                                disabled={savingFaqs}
                                            >
                                                <MaterialIcons
                                                    name="edit"
                                                    size={18}
                                                    color={colors.textSecondary}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteFaq(faq)}
                                                style={styles.faqIconButton}
                                                disabled={savingFaqs}
                                            >
                                                <MaterialIcons name="delete" size={18} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {activeTab === 'reset' && (
                        <View>
                            <View style={styles.infoBanner}>
                                <MaterialIcons name="info" size={18} color={colors.textSecondary} />
                                <MerakiText style={styles.infoText}>
                                    {customCount} customization{customCount === 1 ? '' : 's'} saved.
                                    Resetting restores the content Merakí ships with.
                                </MerakiText>
                            </View>

                            {RESET_SECTIONS.map((section) => (
                                <View key={section.id} style={styles.dangerCard}>
                                    <MerakiText style={styles.dangerTitle}>{section.title}</MerakiText>
                                    <MerakiText style={styles.dangerDesc}>
                                        {section.description}
                                    </MerakiText>
                                    <TouchableOpacity
                                        style={[
                                            styles.dangerButton,
                                            resettingSection === section.id && styles.buttonDisabled,
                                        ]}
                                        onPress={() =>
                                            handleResetSection(
                                                section.id,
                                                section.title,
                                                section.prefixes,
                                                section.keys
                                            )
                                        }
                                        disabled={resettingSection !== null}
                                        activeOpacity={0.7}
                                    >
                                        {resettingSection === section.id ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <MaterialIcons name="restore" size={16} color="#fff" />
                                                <Text style={styles.dangerButtonText}>
                                                    Reset {section.title}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ height: 120 }} />
                </ScrollView>

                {/* FAQ editor */}
                <Modal
                    visible={faqModalOpen}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setFaqModalOpen(false)}
                >
                    <KeyboardAvoidingView
                        style={styles.modalOverlay}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <MerakiText style={styles.modalTitle}>
                                    {editingFaqId ? 'Edit question' : 'New question'}
                                </MerakiText>
                                <TouchableOpacity
                                    onPress={() => setFaqModalOpen(false)}
                                    style={styles.faqIconButton}
                                >
                                    <MaterialIcons name="close" size={22} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView keyboardShouldPersistTaps="handled">
                                <MerakiText style={styles.fieldLabel}>Category</MerakiText>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.categoryRow}
                                >
                                    {FAQ_CATEGORIES.map((cat) => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[
                                                styles.categoryChip,
                                                faqForm.category === cat && styles.categoryChipActive,
                                            ]}
                                            onPress={() => setFaqForm((prev) => ({ ...prev, category: cat }))}
                                        >
                                            <Text
                                                style={[
                                                    styles.categoryChipText,
                                                    faqForm.category === cat && styles.categoryChipTextActive,
                                                ]}
                                            >
                                                {cat}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <MerakiText style={styles.fieldLabel}>Question</MerakiText>
                                <TextInput
                                    style={styles.fieldInput}
                                    value={faqForm.question}
                                    onChangeText={(text) => setFaqForm((prev) => ({ ...prev, question: text }))}
                                    placeholder="How do I book an appointment?"
                                    placeholderTextColor={colors.textMuted}
                                />

                                <MerakiText style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                                    Answer
                                </MerakiText>
                                <TextInput
                                    style={[styles.fieldInput, styles.fieldInputMultiline]}
                                    value={faqForm.answer}
                                    onChangeText={(text) => setFaqForm((prev) => ({ ...prev, answer: text }))}
                                    multiline
                                    textAlignVertical="top"
                                    placeholder="Explain the steps a client should follow…"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </ScrollView>

                            <TouchableOpacity
                                style={[styles.wideButton, savingFaqs && styles.buttonDisabled]}
                                onPress={handleSaveFaq}
                                disabled={savingFaqs}
                            >
                                {savingFaqs ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.wideButtonText}>
                                        {editingFaqId ? 'Save Changes' : 'Add Question'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    headerSpacer: { width: 40 },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    /* Access denied */
    deniedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
    deniedTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    deniedText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    deniedButton: {
        marginTop: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 22,
        backgroundColor: colors.primary,
    },
    deniedButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    /* Edit mode toggle */
    toggleCard: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        padding: 16,
        marginBottom: 16,
        marginTop: 12,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    toggleIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleIconActive: { backgroundColor: 'rgba(34, 197, 94, 0.12)' },
    toggleIconInactive: { backgroundColor: 'rgba(236, 72, 153, 0.12)' },
    toggleTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    toggleSubtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    toggleButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
    toggleButtonActive: { backgroundColor: '#22C55E' },
    toggleButtonInactive: { backgroundColor: '#EC4899' },
    toggleButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    clientViewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    clientViewText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },

    /* Tabs */
    tabBar: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.04)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 18,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 9,
        borderRadius: 9,
    },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: '#fff' },

    /* Info banner */
    infoBanner: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 18,
    },
    infoText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, flex: 1 },

    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(0,0,0,0.25)',
        letterSpacing: 1.5,
        marginBottom: 12,
    },

    /* Text groups */
    groupCard: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        padding: 14,
        marginBottom: 14,
    },
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    groupTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
    groupDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    fieldWrap: { marginTop: 16 },
    fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
    editedPill: {
        backgroundColor: 'rgba(236, 72, 153, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 6,
    },
    editedPillText: { fontSize: 9, fontWeight: '700', color: '#EC4899', letterSpacing: 0.5 },
    fieldInput: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: layout.borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        fontSize: 14,
        color: colors.text,
        backgroundColor: colors.surface,
    },
    fieldInputMultiline: { minHeight: 90 },
    fieldActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    smallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 9,
    },
    smallButtonPrimary: { backgroundColor: '#EC4899' },
    smallButtonDanger: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    smallButtonTextLight: { fontSize: 12, fontWeight: '700', color: '#fff' },
    smallButtonTextDanger: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

    /* Shared list container */
    listContainer: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        marginBottom: 24,
        overflow: 'hidden',
    },

    /* Images */
    imageCard: {
        flexDirection: 'row',
        padding: 14,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    imagePreviewWrap: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    imagePreview: { width: '100%', height: '100%' },
    customBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#EC4899',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 10,
    },
    customBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
    imageInfo: { flex: 1 },
    imageLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
    imageDesc: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
    imageActions: { flexDirection: 'row', gap: 8 },
    replaceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#EC4899',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    replaceBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    resetOneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    resetOneText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
    uploadWrap: { marginTop: 4 },
    cancelUploadBtn: { marginTop: 8, alignSelf: 'flex-start' },
    cancelUploadText: {
        fontSize: 13,
        color: colors.textMuted,
        textDecorationLine: 'underline',
    },

    /* Support & FAQ */
    wideButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#EC4899',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 16,
    },
    wideButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    buttonDisabled: { opacity: 0.6 },
    faqHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    addFaqButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        marginBottom: 12,
    },
    addFaqText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    faqRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    faqCategory: {
        fontSize: 9,
        fontWeight: '700',
        color: '#EC4899',
        letterSpacing: 1,
        marginBottom: 3,
    },
    faqQuestion: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 3 },
    faqAnswer: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    faqActions: { flexDirection: 'row', gap: 2 },
    faqIconButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* FAQ modal */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: layout.borderRadius.xl,
        borderTopRightRadius: layout.borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '88%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    categoryRow: { marginBottom: spacing.md },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginRight: 6,
    },
    categoryChipActive: { backgroundColor: '#EC4899' },
    categoryChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    categoryChipTextActive: { color: '#fff' },

    /* Reset */
    dangerCard: {
        backgroundColor: 'rgba(239, 68, 68, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.15)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
    },
    dangerTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    dangerDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 14 },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#EF4444',
        paddingVertical: 13,
        borderRadius: 12,
    },
    dangerButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default CustomizeAppScreen;
