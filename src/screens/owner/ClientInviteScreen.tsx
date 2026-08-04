// T09 — Walk-in client invite (mirrors MasterInviteScreen conventions: honest sent/not-sent messaging).

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { safeGoBack } from '../../navigation/navigationUtils';
import { colors, spacing } from '../../theme';
import { inviteWalkInClient } from '../../services/clientManagementService';

export function ClientInviteScreen() {
    const navigation = useNavigation<any>();
    const { profile } = useAuth();
    const isOwner = profile?.role === 'owner';

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);

    const handleSubmit = async () => {
        setSubmitting(true);
        setResult(null);
        const res = await inviteWalkInClient({
            email,
            fullName,
            phone: phone.trim() || undefined,
        });
        setSubmitting(false);
        if (res.error) {
            setResult({ kind: 'error', text: res.error });
            return;
        }
        if (res.emailSent) {
            setResult({ kind: 'ok', text: `Invite sent to ${email.trim().toLowerCase()} — they can set their password from the email.` });
        } else {
            setResult({ kind: 'warn', text: 'Account created, but the invite email could not be sent. Share the password-reset link manually.' });
        }
        setFullName(''); setEmail(''); setPhone('');
    };

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <MerakiText style={styles.title}>New Client</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.centerMessage}>
                        <MaterialIcons name="lock-outline" size={48} color={colors.textMuted} />
                        <MerakiText style={styles.emptyTitle}>Restricted</MerakiText>
                        <MerakiText style={styles.emptyText}>Only the owner can create client accounts.</MerakiText>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const canSubmit = !submitting && fullName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim());

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText style={styles.title}>New Client</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                        <MerakiText style={styles.hint}>
                            Creates the client's account and emails them a link to set their password.
                        </MerakiText>

                        <TextInput
                            style={styles.input}
                            placeholder="Full name *"
                            placeholderTextColor={colors.textMuted}
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email *"
                            placeholderTextColor={colors.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Phone (optional)"
                            placeholderTextColor={colors.textMuted}
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />

                        {result && (
                            <View style={[styles.resultBox, result.kind === 'ok' && styles.resultOk, result.kind === 'warn' && styles.resultWarn, result.kind === 'error' && styles.resultError]}>
                                <MaterialIcons
                                    name={result.kind === 'ok' ? 'check-circle' : result.kind === 'warn' ? 'warning' : 'error-outline'}
                                    size={18}
                                    color={result.kind === 'ok' ? '#047857' : result.kind === 'warn' ? '#B45309' : '#B91C1C'}
                                />
                                <MerakiText style={styles.resultText}>{result.text}</MerakiText>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.submitButton, !canSubmit && { opacity: 0.4 }]}
                            onPress={handleSubmit}
                            disabled={!canSubmit}
                            activeOpacity={0.8}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <MerakiText style={styles.submitText}>Create &amp; Send Invite</MerakiText>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    body: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
    hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
    input: {
        backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 14,
        height: 48, fontSize: 14, color: colors.text, marginBottom: spacing.sm,
    },
    resultBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: spacing.sm },
    resultOk: { backgroundColor: 'rgba(16,185,129,0.10)' },
    resultWarn: { backgroundColor: 'rgba(245,158,11,0.12)' },
    resultError: { backgroundColor: 'rgba(239,68,68,0.10)' },
    resultText: { flex: 1, fontSize: 13, color: colors.text },
    submitButton: { backgroundColor: '#000', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
    submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
