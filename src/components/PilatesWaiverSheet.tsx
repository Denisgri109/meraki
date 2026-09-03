import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    TextInput,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePilatesWaiver, PilatesWaiverData } from '../hooks/usePilatesWaiver';
import { colors, spacing } from '../theme';

interface PilatesWaiverSheetProps {
    /** Controls visibility of the sheet */
    visible: boolean;
    /** Called after a successful submission */
    onSigned: () => void;
    /** Called when the user dismisses the sheet without signing */
    onDismiss: () => void;
}

// Verbatim from the web reference (PilatesWaiverFormSheet.tsx). Keep in sync.
const WAIVER_TEXT = `Please feel free to mention anything else that we may need to know to keep your session safe both now and as the training progresses. Whilst every effort is made to keep the session both safe and effective, there is a risk of injury as with any programme of activity. You are responsible for your own body. Should you feel any discomfort in areas of concern (neck, lower back, shoulders), please inform me immediately and we can modify the move.

I hereby state that I have read, understood, and answered honestly the pre-exercise health screening questionnaire. Any questions I had were answered to my full satisfaction. Whilst every effort is made to keep the class safe and enjoyable, I am participating of my own free will and, as with any exercise programme, there is a risk of injury. Do you understand and agree to these terms?`;

const EMERALD = '#10B981';
const EMERALD_DARK = '#047857';
const EMERALD_BG = '#ECFDF5';
const AMBER = '#F59E0B';
const AMBER_BG = '#FFFBEB';
const RED = '#EF4444';
const RED_BG = '#FEF2F2';

export function PilatesWaiverSheet({ visible, onSigned, onDismiss }: PilatesWaiverSheetProps) {
    const navigation = useNavigation<any>();
    const { submitWaiver, submitting } = usePilatesWaiver();

    const [injuriesJointProblems, setInjuriesJointProblems] = useState('');
    const [pilatesExperience, setPilatesExperience] = useState('');
    const [hasIllnesses, setHasIllnesses] = useState<string | null>(null);
    const [illnessDetails, setIllnessDetails] = useState('');
    const [pregnancyStatus, setPregnancyStatus] = useState<string | null>(null);
    const [medicationDetails, setMedicationDetails] = useState('');
    const [exerciseHistory, setExerciseHistory] = useState('');
    const [practitionerRecommended, setPractitionerRecommended] = useState<string | null>(null);
    const [goalsExpectations, setGoalsExpectations] = useState('');
    const [hasBoneCondition, setHasBoneCondition] = useState<string | null>(null);
    const [agreedTermsOfUse, setAgreedTermsOfUse] = useState(false);
    const [agreedLiabilityWaiver, setAgreedLiabilityWaiver] = useState(false);
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [formError, setFormError] = useState('');

    const resetForm = useCallback(() => {
        setInjuriesJointProblems('');
        setPilatesExperience('');
        setHasIllnesses(null);
        setIllnessDetails('');
        setPregnancyStatus(null);
        setMedicationDetails('');
        setExerciseHistory('');
        setPractitionerRecommended(null);
        setGoalsExpectations('');
        setHasBoneCondition(null);
        setAgreedTermsOfUse(false);
        setAgreedLiabilityWaiver(false);
        setEmergencyContactName('');
        setEmergencyContactRelationship('');
        setEmergencyContactPhone('');
        setSubmitAttempted(false);
        setFormError('');
    }, []);

    useEffect(() => {
        if (visible) resetForm();
    }, [visible, resetForm]);

    // Same validation rules as the web form
    const errors = {
        injuriesJointProblems: !injuriesJointProblems.trim(),
        pilatesExperience: !pilatesExperience.trim(),
        hasIllnesses: hasIllnesses === null,
        illnessDetails: hasIllnesses === 'yes' && !illnessDetails.trim(),
        pregnancyStatus: pregnancyStatus === null,
        medicationDetails: !medicationDetails.trim(),
        exerciseHistory: !exerciseHistory.trim(),
        practitionerRecommended: practitionerRecommended === null,
        goalsExpectations: !goalsExpectations.trim(),
        hasBoneCondition: hasBoneCondition === null,
        agreedTermsOfUse: !agreedTermsOfUse,
        agreedLiabilityWaiver: !agreedLiabilityWaiver,
        emergencyContactName: emergencyContactName.trim().length < 2,
        emergencyContactRelationship: emergencyContactRelationship.trim().length < 2,
        emergencyContactPhone: emergencyContactPhone.trim().length < 5,
    };
    const hasErrors = Object.values(errors).some(Boolean);

    const handleSubmit = async () => {
        setSubmitAttempted(true);
        setFormError('');
        if (hasErrors) return;

        const data: PilatesWaiverData = {
            injuriesJointProblems: injuriesJointProblems.trim(),
            pilatesExperience: pilatesExperience.trim(),
            hasIllnesses: hasIllnesses === 'yes',
            illnessDetails: hasIllnesses === 'yes' ? illnessDetails.trim() : '',
            pregnancyStatus: pregnancyStatus as 'yes' | 'no' | 'not_applicable',
            medicationDetails: medicationDetails.trim(),
            exerciseHistory: exerciseHistory.trim(),
            practitionerRecommended: practitionerRecommended === 'yes',
            goalsExpectations: goalsExpectations.trim(),
            hasBoneCondition: hasBoneCondition === 'yes',
            agreedTermsOfUse,
            agreedLiabilityWaiver,
            emergencyContactName: emergencyContactName.trim(),
            emergencyContactRelationship: emergencyContactRelationship.trim(),
            emergencyContactPhone: emergencyContactPhone.trim(),
        };

        try {
            await submitWaiver(data);
            onSigned();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit waiver. Please try again.';
            setFormError(msg);
        }
    };

    const renderFieldError = (show: boolean, message: string) =>
        submitAttempted && show ? <Text style={styles.fieldError}>{message}</Text> : null;

    const renderQuestion = (label: string, children: React.ReactNode) => (
        <View style={styles.question}>
            <Text style={styles.questionLabel}>
                {label} <Text style={styles.requiredStar}>*</Text>
            </Text>
            {children}
        </View>
    );

    const renderRadio = (
        value: string | null,
        setValue: (v: string) => void,
        options: { value: string; label: string; warning?: boolean }[]
    ) => (
        <View style={styles.radioRow}>
            {options.map((opt) => {
                const selected = value === opt.value;
                return (
                    <TouchableOpacity
                        key={opt.value}
                        style={[
                            styles.radioButton,
                            selected && (opt.warning ? styles.radioButtonWarning : styles.radioButtonSelected),
                        ]}
                        onPress={() => setValue(opt.value)}
                        activeOpacity={0.7}
                    >
                        {opt.warning && selected && (
                            <MaterialIcons name="warning" size={14} color="#92400E" />
                        )}
                        <Text
                            style={[
                                styles.radioButtonText,
                                selected && (opt.warning ? styles.radioTextWarning : styles.radioTextSelected),
                            ]}
                        >
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderCheckbox = (
        checked: boolean,
        onToggle: () => void,
        label: React.ReactNode,
        testID?: string
    ) => (
        <TouchableOpacity
            testID={testID}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            style={styles.checkboxRow}
            onPress={onToggle}
            activeOpacity={0.7}
        >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={() => {
                if (!submitting) onDismiss();
            }}
        >
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableOpacity
                    style={styles.backdropTouchable}
                    activeOpacity={1}
                    onPress={() => {
                        if (!submitting) onDismiss();
                    }}
                />
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerIcon}>
                                <MaterialCommunityIcons name="heart-pulse" size={18} color={EMERALD_DARK} />
                            </View>
                            <View>
                                <Text style={styles.headerTitle}>Health Screening & Waiver</Text>
                                <Text style={styles.headerSubtitle}>
                                    Required before booking Pilates classes
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                if (!submitting) onDismiss();
                            }}
                            disabled={submitting}
                            style={styles.closeButton}
                            accessibilityLabel="Close"
                        >
                            <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Scrollable body */}
                    <ScrollView
                        style={styles.body}
                        contentContainerStyle={styles.bodyContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* ── Health Screening ── */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <MaterialCommunityIcons name="heart-pulse" size={16} color={EMERALD} />
                                <Text style={styles.sectionTitle}>HEALTH SCREENING</Text>
                            </View>

                            {renderQuestion(
                                'Do you have any injuries or joint problems?',
                                <>
                                    <TextInput
                                        style={[styles.textarea, submitAttempted && errors.injuriesJointProblems && styles.inputError]}
                                        value={injuriesJointProblems}
                                        onChangeText={setInjuriesJointProblems}
                                        placeholder="Describe any injuries or joint problems..."
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                    />
                                    {renderFieldError(errors.injuriesJointProblems, 'Please describe any injuries or joint problems.')}
                                </>
                            )}

                            {renderQuestion(
                                'What is your Pilates experience?',
                                <>
                                    <TextInput
                                        style={[styles.textarea, submitAttempted && errors.pilatesExperience && styles.inputError]}
                                        value={pilatesExperience}
                                        onChangeText={setPilatesExperience}
                                        placeholder="e.g., Some Mat Pilates, Some Reformer, Experienced, etc."
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        numberOfLines={2}
                                        textAlignVertical="top"
                                    />
                                    {renderFieldError(errors.pilatesExperience, 'Please describe your Pilates experience.')}
                                </>
                            )}

                            {renderQuestion(
                                'Have you had any illnesses or disabilities?',
                                <>
                                    {renderRadio(hasIllnesses, (v) => {
                                        setHasIllnesses(v);
                                        if (v === 'no') setIllnessDetails('');
                                    }, [
                                        { value: 'no', label: 'No' },
                                        { value: 'yes', label: 'Yes', warning: true },
                                    ])}
                                    {renderFieldError(errors.hasIllnesses, 'Please select Yes or No.')}
                                </>
                            )}

                            {hasIllnesses === 'yes' &&
                                renderQuestion(
                                    'If yes, please provide details:',
                                    <>
                                        <TextInput
                                            style={[styles.textarea, submitAttempted && errors.illnessDetails && styles.inputError]}
                                            value={illnessDetails}
                                            onChangeText={setIllnessDetails}
                                            placeholder="Provide details about your illness or disability..."
                                            placeholderTextColor={colors.textMuted}
                                            multiline
                                            numberOfLines={3}
                                            textAlignVertical="top"
                                            autoFocus
                                        />
                                        {renderFieldError(errors.illnessDetails, 'Please provide details about your illness or disability.')}
                                    </>
                                )}

                            {renderQuestion(
                                'Are you pregnant, or have you been pregnant in the last 6 months?',
                                <>
                                    {renderRadio(pregnancyStatus, setPregnancyStatus, [
                                        { value: 'no', label: 'No' },
                                        { value: 'yes', label: 'Yes', warning: true },
                                        { value: 'not_applicable', label: 'N/A' },
                                    ])}
                                    {renderFieldError(errors.pregnancyStatus, 'Please select an option.')}
                                </>
                            )}

                            {renderQuestion(
                                'Are you on any medication that may affect you during the session? If yes, please provide details:',
                                <>
                                    <TextInput
                                        style={[styles.textarea, submitAttempted && errors.medicationDetails && styles.inputError]}
                                        value={medicationDetails}
                                        onChangeText={setMedicationDetails}
                                        placeholder="List any medication that may affect your session..."
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                    />
                                    {renderFieldError(errors.medicationDetails, 'Please provide medication details.')}
                                </>
                            )}

                            {renderQuestion(
                                'In brief, please state your exercise history, when you last exercised, and what activity it was:',
                                <>
                                    <TextInput
                                        style={[styles.textarea, submitAttempted && errors.exerciseHistory && styles.inputError]}
                                        value={exerciseHistory}
                                        onChangeText={setExerciseHistory}
                                        placeholder="e.g., Running 3x per week, last exercised yesterday..."
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                    />
                                    {renderFieldError(errors.exerciseHistory, 'Please describe your exercise history.')}
                                </>
                            )}

                            {renderQuestion(
                                'Have you been recommended to do Pilates by a health/medical practitioner?',
                                <>
                                    {renderRadio(practitionerRecommended, setPractitionerRecommended, [
                                        { value: 'no', label: 'No' },
                                        { value: 'yes', label: 'Yes' },
                                    ])}
                                    <Text style={styles.helpText}>
                                        e.g., Physiotherapist, Osteopath, Chiropractor, etc.
                                    </Text>
                                    {renderFieldError(errors.practitionerRecommended, 'Please select Yes or No.')}
                                </>
                            )}

                            {renderQuestion(
                                'What are you hoping to achieve from your classes?',
                                <>
                                    <TextInput
                                        style={[styles.textarea, submitAttempted && errors.goalsExpectations && styles.inputError]}
                                        value={goalsExpectations}
                                        onChangeText={setGoalsExpectations}
                                        placeholder="e.g., Improve core strength, better posture, rehabilitation..."
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        numberOfLines={2}
                                        textAlignVertical="top"
                                    />
                                    {renderFieldError(errors.goalsExpectations, 'Please describe your goals.')}
                                </>
                            )}

                            {renderQuestion(
                                'Have you ever been diagnosed with Osteoporosis or Osteopenia?',
                                <>
                                    {renderRadio(hasBoneCondition, setHasBoneCondition, [
                                        { value: 'no', label: 'No' },
                                        { value: 'yes', label: 'Yes', warning: true },
                                    ])}
                                    {renderFieldError(errors.hasBoneCondition, 'Please select Yes or No.')}
                                </>
                            )}
                        </View>

                        {/* ── Emergency Contact ── */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <MaterialIcons name="phone" size={16} color={EMERALD} />
                                <Text style={styles.sectionTitle}>EMERGENCY CONTACT</Text>
                            </View>
                            <Text style={styles.helpText}>
                                Required — we need someone to contact in case of an emergency during your session.
                            </Text>

                            {renderQuestion(
                                'Contact Name',
                                <>
                                    <TextInput
                                        testID="waiver-emergency-name"
                                        style={[styles.input, submitAttempted && errors.emergencyContactName && styles.inputError]}
                                        value={emergencyContactName}
                                        onChangeText={setEmergencyContactName}
                                        placeholder="Full name"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                    {renderFieldError(errors.emergencyContactName, 'Please enter a contact name (min 2 characters).')}
                                </>
                            )}

                            {renderQuestion(
                                'Relationship',
                                <>
                                    <TextInput
                                        style={[styles.input, submitAttempted && errors.emergencyContactRelationship && styles.inputError]}
                                        value={emergencyContactRelationship}
                                        onChangeText={setEmergencyContactRelationship}
                                        placeholder="e.g., Spouse, Parent, Sibling"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                    {renderFieldError(errors.emergencyContactRelationship, 'Please enter the relationship (min 2 characters).')}
                                </>
                            )}

                            {renderQuestion(
                                'Contact Phone',
                                <>
                                    <TextInput
                                        testID="waiver-emergency-phone"
                                        style={[styles.input, submitAttempted && errors.emergencyContactPhone && styles.inputError]}
                                        value={emergencyContactPhone}
                                        onChangeText={setEmergencyContactPhone}
                                        placeholder="Phone number"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="phone-pad"
                                    />
                                    {renderFieldError(errors.emergencyContactPhone, 'Please enter a valid phone number (min 5 digits).')}
                                </>
                            )}
                        </View>

                        {/* ── Consent ── */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <MaterialIcons name="verified-user" size={16} color={EMERALD} />
                                <Text style={styles.sectionTitle}>CONSENT</Text>
                            </View>

                            {renderCheckbox(
                                agreedTermsOfUse,
                                () => setAgreedTermsOfUse((v) => !v),
                                <>
                                    I agree to the{' '}
                                    <Text
                                        style={styles.termsLink}
                                        onPress={() => navigation.navigate('TermsOfService')}
                                    >
                                        General Terms of Use
                                    </Text>
                                    . <Text style={styles.requiredStar}>*</Text>
                                </>,
                                'waiver-agree-terms'
                            )}
                            {renderFieldError(errors.agreedTermsOfUse, 'You must agree to the Terms of Use to continue.')}
                        </View>

                        {/* ── Liability Waiver ── */}
                        <View style={[styles.section, { marginBottom: 0 }]}>
                            <View style={styles.sectionHeader}>
                                <MaterialIcons name="description" size={16} color={EMERALD} />
                                <Text style={styles.sectionTitle}>LIABILITY WAIVER</Text>
                            </View>

                            <View style={styles.waiverTextBox}>
                                <ScrollView nestedScrollEnabled style={styles.waiverTextScroll}>
                                    <Text style={styles.waiverText}>{WAIVER_TEXT}</Text>
                                </ScrollView>
                            </View>

                            {renderCheckbox(
                                agreedLiabilityWaiver,
                                () => setAgreedLiabilityWaiver((v) => !v),
                                <>
                                    I understand and agree to the above terms.{' '}
                                    <Text style={styles.requiredStar}>*</Text>
                                </>,
                                'waiver-agree-liability'
                            )}
                            {renderFieldError(errors.agreedLiabilityWaiver, 'You must agree to the liability waiver to continue.')}
                        </View>
                    </ScrollView>

                    {/* Error banner */}
                    {!!formError && (
                        <View style={styles.errorBannerWrap}>
                            <View style={styles.errorBanner}>
                                <MaterialIcons name="warning" size={14} color={RED} />
                                <Text style={styles.errorBannerText}>{formError}</Text>
                            </View>
                        </View>
                    )}

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            testID="waiver-submit"
                            accessibilityRole="button"
                            accessibilityLabel="Sign and continue"
                            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.8}
                        >
                            {submitting ? (
                                <>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text style={styles.submitButtonText}>Submitting...</Text>
                                </>
                            ) : (
                                <>
                                    <MaterialIcons name="verified-user" size={16} color="#FFFFFF" />
                                    <Text style={styles.submitButtonText}>Sign & Continue</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.footerNote}>
                            Your health screening is stored securely. You only need to complete this once.
                        </Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'flex-end',
    },
    backdropTouchable: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: EMERALD_BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    headerSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    closeButton: { padding: 6 },
    body: { flexGrow: 0 },
    bodyContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    section: {
        marginBottom: spacing.lg,
        paddingTop: spacing.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 1,
    },
    question: { marginBottom: spacing.md },
    questionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
        lineHeight: 19,
    },
    requiredStar: { color: RED },
    textarea: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.text,
        minHeight: 72,
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: colors.text,
    },
    inputError: {
        borderColor: '#FCA5A5',
        backgroundColor: RED_BG,
    },
    fieldError: { marginTop: 4, fontSize: 12, color: RED },
    helpText: { marginTop: 4, fontSize: 11, color: colors.textMuted },
    radioRow: { flexDirection: 'row', gap: spacing.sm },
    radioButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    radioButtonSelected: {
        borderColor: '#6EE7B7',
        backgroundColor: EMERALD_BG,
    },
    radioButtonWarning: {
        borderColor: '#FCD34D',
        backgroundColor: AMBER_BG,
    },
    radioButtonText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    radioTextSelected: { color: EMERALD_DARK },
    radioTextWarning: { color: '#92400E' },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    checkboxChecked: {
        backgroundColor: EMERALD,
        borderColor: EMERALD,
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
        lineHeight: 19,
    },
    termsLink: { color: EMERALD_DARK, fontWeight: '700', textDecorationLine: 'underline' },
    waiverTextBox: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        padding: 12,
        marginBottom: spacing.md,
    },
    waiverTextScroll: { maxHeight: 176 },
    waiverText: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
    errorBannerWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderRadius: 12,
        backgroundColor: RED_BG,
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    errorBannerText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#B91C1C' },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
        backgroundColor: '#FFFFFF',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: EMERALD,
        borderRadius: 14,
        paddingVertical: 14,
    },
    submitButtonDisabled: { backgroundColor: '#D1D5DB' },
    submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
    footerNote: {
        marginTop: 8,
        textAlign: 'center',
        fontSize: 11,
        color: colors.textMuted,
    },
});

export default PilatesWaiverSheet;
