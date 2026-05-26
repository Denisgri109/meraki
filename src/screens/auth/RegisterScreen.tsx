import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { supabase } from '../../lib/supabase';
import { Button, Input, MerakiText, SearchablePicker } from '../../components/ui';
import { getAllCountries, getCitiesOfCountry, type Country, type City } from '../../utils/locationApi';
import { colors, spacing, layout } from '../../theme';
import { StatusBar } from 'expo-status-bar';
import {
    validateIrishPhone,
    formatIrishPhone,
    normalizeIrishPhone,
    validateEmail,
    validatePassword,
    validateFullName,
} from '../../utils/validation';

type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    VerifyOtp: { email: string };
    ForgotPassword: undefined;
    Terms: undefined;
};

type RegisterScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

const { width } = Dimensions.get('window');

export function RegisterScreen({ navigation }: RegisterScreenProps) {
    const { signUp } = useAuth();
    const { showAlert } = useModal();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<'client' | 'master'>('client');
    const [tosAccepted, setTosAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{
        fullName?: string;
        phone?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        country?: string;
        city?: string;
    }>({});

    // Location fields
    const [selectedCountry, setSelectedCountry] = useState('');
    const [selectedCountryCode, setSelectedCountryCode] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [countries, setCountries] = useState<Country[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [loadingCities, setLoadingCities] = useState(false);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [showCityPicker, setShowCityPicker] = useState(false);

    // Load countries on mount
    useState(() => {
        getAllCountries().then((data) => {
            setCountries(data);
            setLoadingCountries(false);
        }).catch(() => setLoadingCountries(false));
    });

    const validate = () => {
        const newErrors: typeof errors = {};
        const nameValidation = validateFullName(fullName);
        if (!nameValidation.valid) newErrors.fullName = nameValidation.error;
        if (phone.trim()) {
            const phoneValidation = validateIrishPhone(phone);
            if (!phoneValidation.valid) newErrors.phone = phoneValidation.error;
        }
        if (!selectedCountry.trim()) newErrors.country = 'Please select your country';
        if (!selectedCity.trim()) newErrors.city = 'Please select your city';
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) newErrors.email = emailValidation.error;
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) newErrors.password = passwordValidation.error;
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePhoneChange = (text: string) => {
        setPhone(text);
        if (errors.phone) setErrors({ ...errors, phone: undefined });
    };

    const handlePhoneBlur = () => {
        if (phone.trim()) {
            const validation = validateIrishPhone(phone);
            if (validation.valid) setPhone(formatIrishPhone(phone));
        }
    };

    const handleRegister = async () => {
        if (!validate()) return;
        if (!tosAccepted) {
            showAlert('Terms Required', 'Please accept the Terms of Service to continue.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const normalizedPhone = phone.trim() ? normalizeIrishPhone(phone) : null;
            const { error: signUpError } = await signUp(
                email.trim().toLowerCase(),
                password,
                fullName.trim(),
                selectedRole,
                tosAccepted,
                '1.0'
            );

            if (signUpError) throw signUpError;

            // Save location to profile
            const { data: { user: newUser } } = await supabase.auth.getUser();
            if (newUser) {
                await supabase
                    .from('profiles')
                    .update({
                        country: selectedCountry,
                        country_code: selectedCountryCode,
                        city: selectedCity,
                    })
                    .eq('id', newUser.id);
            }

            const { error: otpError } = await supabase.auth.resend({
                type: 'signup',
                email: email.trim().toLowerCase(),
            });

            navigation.navigate('VerifyOtp', { email: email.trim().toLowerCase() });
        } catch (error: any) {
            let errorMessage = error.message || 'An error occurred during registration.';
            if (error.message?.includes('Database error')) {
                errorMessage = 'Database error creating account. Please try again or contact support.';
            } else if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (error.message?.includes('password')) {
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
            } else if (error.message?.includes('valid')) {
                errorMessage = 'Please check your email format and try again.';
            }
            showAlert('Registration Failed', errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Password strength
    const getPasswordStrength = () => {
        if (!password) return 0;
        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        return strength;
    };

    const strength = getPasswordStrength();

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation.goBack()}
                            >
                                <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            <View style={styles.headerTexts}>
                                <MerakiText variant="h2" style={styles.title}>Create Account</MerakiText>
                                <MerakiText style={styles.subtitle}>Join the Merakí community</MerakiText>
                            </View>
                        </View>

                        {/* Role Selection */}
                        <View style={styles.roleContainer}>
                            <MerakiText style={styles.sectionLabel}>I AM A...</MerakiText>
                            <View style={styles.roleRow}>
                                <TouchableOpacity
                                    style={[styles.roleCard, selectedRole === 'client' && styles.roleCardActive]}
                                    onPress={() => setSelectedRole('client')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.roleIconBox, selectedRole === 'client' && styles.roleIconBoxActive]}>
                                        <MaterialIcons
                                            name="person-outline"
                                            size={24}
                                            color={selectedRole === 'client' ? colors.primary : 'rgba(0, 0, 0, 0.35)'}
                                        />
                                    </View>
                                    <MerakiText style={[styles.roleText, selectedRole === 'client' && styles.roleTextActive]}>
                                        Client
                                    </MerakiText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roleCard, selectedRole === 'master' && styles.roleCardActive]}
                                    onPress={() => setSelectedRole('master')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.roleIconBox, selectedRole === 'master' && styles.roleIconBoxActive]}>
                                        <MaterialIcons
                                            name="content-cut"
                                            size={24}
                                            color={selectedRole === 'master' ? colors.primary : 'rgba(0, 0, 0, 0.35)'}
                                        />
                                    </View>
                                    <MerakiText style={[styles.roleText, selectedRole === 'master' && styles.roleTextActive]}>
                                        Professional
                                    </MerakiText>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.inputLabel}>FULL NAME</MerakiText>
                                <Input
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="words"
                                    placeholder="Julianne Moore"
                                    error={errors.fullName}
                                    variant="glass"
                                    leftIcon={<MaterialIcons name="person-outline" size={20} color="rgba(0, 0, 0, 0.25)" />}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.inputLabel}>PHONE NUMBER</MerakiText>
                                <Input
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    onBlur={handlePhoneBlur}
                                    keyboardType="phone-pad"
                                    placeholder="+353 87 123 4567"
                                    error={errors.phone}
                                    variant="glass"
                                    leftIcon={<MaterialIcons name="phone-iphone" size={20} color="rgba(0, 0, 0, 0.25)" />}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.inputLabel}>COUNTRY</MerakiText>
                                <TouchableOpacity
                                    style={[styles.locationField, errors.country ? styles.locationFieldError : null]}
                                    onPress={() => setShowCountryPicker(true)}
                                >
                                    <MaterialIcons name="location-on" size={20} color="rgba(0, 0, 0, 0.25)" />
                                    <MerakiText style={[styles.locationFieldText, !selectedCountry && styles.locationFieldPlaceholder]}>
                                        {selectedCountry || (loadingCountries ? 'Loading...' : 'Select your country')}
                                    </MerakiText>
                                    <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.25)" />
                                </TouchableOpacity>
                                {errors.country && <MerakiText style={styles.fieldError}>{errors.country}</MerakiText>}
                            </View>

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.inputLabel}>CITY</MerakiText>
                                <TouchableOpacity
                                    style={[styles.locationField, errors.city ? styles.locationFieldError : null, !selectedCountry && styles.locationFieldDisabled]}
                                    onPress={() => { if (selectedCountry && cities.length > 0) setShowCityPicker(true); }}
                                    disabled={!selectedCountry}
                                >
                                    <MaterialIcons name="location-city" size={20} color="rgba(0, 0, 0, 0.25)" />
                                    <MerakiText style={[styles.locationFieldText, !selectedCity && styles.locationFieldPlaceholder]}>
                                        {selectedCity || (!selectedCountry ? 'Select country first' : loadingCities ? 'Loading...' : 'Select your city')}
                                    </MerakiText>
                                    <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.25)" />
                                </TouchableOpacity>
                                {errors.city && <MerakiText style={styles.fieldError}>{errors.city}</MerakiText>}
                            </View>

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.inputLabel}>EMAIL ADDRESS</MerakiText>
                                <Input
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    placeholder="name@example.com"
                                    error={errors.email}
                                    variant="glass"
                                    leftIcon={<MaterialIcons name="alternate-email" size={20} color="rgba(0, 0, 0, 0.25)" />}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.inputLabel}>PASSWORD</MerakiText>
                                <Input
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    placeholder="••••••••"
                                    error={errors.password}
                                    variant="glass"
                                    leftIcon={<MaterialIcons name="lock-outline" size={20} color="rgba(0, 0, 0, 0.25)" />}
                                    rightIcon={
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                            <MaterialIcons
                                                name={showPassword ? 'visibility' : 'visibility-off'}
                                                size={20}
                                                color="rgba(0, 0, 0, 0.25)"
                                            />
                                        </TouchableOpacity>
                                    }
                                />
                            </View>

                            {/* Password Strength Meter */}
                            {password.length > 0 && (
                                <View style={styles.strengthContainer}>
                                    <View style={styles.strengthBarsRow}>
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.strengthBar,
                                                    i <= strength && styles.strengthBarActive,
                                                    i <= strength && { backgroundColor: strength <= 2 ? '#EF4444' : strength <= 3 ? '#F59E0B' : '#10B981' }
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    <MerakiText style={[
                                        styles.strengthLabel,
                                        { color: strength <= 2 ? '#EF4444' : strength <= 3 ? '#F59E0B' : '#10B981' }
                                    ]}>
                                        {strength <= 2 ? 'Weak' : strength <= 3 ? 'Medium' : 'Strong'}
                                    </MerakiText>
                                </View>
                            )}

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.inputLabel}>CONFIRM PASSWORD</MerakiText>
                                <Input
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    placeholder="••••••••"
                                    error={errors.confirmPassword}
                                    variant="glass"
                                    leftIcon={<MaterialIcons name="verified-user" size={20} color="rgba(0, 0, 0, 0.25)" />}
                                />
                            </View>
                        </View>

                        {/* Terms */}
                        <TouchableOpacity
                            style={styles.termsContainer}
                            onPress={() => setTosAccepted(!tosAccepted)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}>
                                {tosAccepted && <MaterialIcons name="check" size={14} color="#000" />}
                            </View>
                            <MerakiText style={styles.termsText}>
                                I agree to <MerakiText style={styles.linkText} onPress={() => navigation.navigate('Terms')}>Terms of Service</MerakiText> & <MerakiText style={styles.linkText} onPress={() => navigation.navigate('Terms')}>Privacy Policy</MerakiText>
                            </MerakiText>
                        </TouchableOpacity>

                        {/* Submit */}
                        <Button
                            title="CREATE ACCOUNT"
                            onPress={handleRegister}
                            loading={loading}
                            fullWidth
                            variant="gradient"
                            style={styles.submitButton}
                            textStyle={styles.submitButtonText}
                        />

                        {/* Footer */}
                        <View style={styles.footer}>
                            <MerakiText style={styles.footerText}>Already have an account? </MerakiText>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <MerakiText style={styles.footerLink}>Sign In</MerakiText>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
            {/* Country Picker */}
            <SearchablePicker
                visible={showCountryPicker}
                title="Select Country"
                items={countries.map(c => ({ id: c.id, name: c.name, subtitle: c.iso2 }))}
                onSelect={(item) => {
                    const found = countries.find(c => c.id === item.id);
                    if (found) {
                        setSelectedCountry(found.name);
                        setSelectedCountryCode(found.iso2);
                        setSelectedCity('');
                        setErrors(prev => ({ ...prev, country: undefined }));
                        setLoadingCities(true);
                        getCitiesOfCountry(found.iso2).then(data => {
                            setCities(data);
                            setLoadingCities(false);
                        }).catch(() => setLoadingCities(false));
                    }
                    setShowCountryPicker(false);
                }}
                onClose={() => setShowCountryPicker(false)}
            />

            {/* City Picker */}
            <SearchablePicker
                visible={showCityPicker}
                title="Select City"
                items={cities.map(c => ({ id: c.id, name: c.name }))}
                onSelect={(item) => {
                    setSelectedCity(item.name);
                    setErrors(prev => ({ ...prev, city: undefined }));
                    setShowCityPicker(false);
                }}
                onClose={() => setShowCityPicker(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },

    header: {
        marginTop: 20,
        marginBottom: 40,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    headerTexts: {
        gap: 8,
    },
    title: {
        fontSize: 32,
        fontFamily: 'PlayfairDisplay-Regular', // Consistent with Design System
        color: colors.primary,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.40)',
        letterSpacing: 0.5,
    },
    roleContainer: {
        marginBottom: 32,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(0, 0, 0, 0.35)',
        letterSpacing: 1.5,
        marginBottom: 16,
    },
    roleRow: {
        flexDirection: 'row',
        gap: 16,
    },
    roleCard: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        borderRadius: layout.borderRadius.xl,
        padding: 20,
        alignItems: 'center',
        gap: 12,
    },
    roleCardActive: {
        backgroundColor: 'rgba(212, 168, 83, 0.1)',
        borderColor: colors.primary,
    },
    roleIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleIconBoxActive: {
        backgroundColor: 'rgba(212, 168, 83, 0.2)',
    },
    roleText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.50)',
    },
    roleTextActive: {
        color: colors.primary,
        fontWeight: '700',
    },
    form: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.35)',
        marginLeft: 16,
        marginBottom: 8,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    locationField: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        borderRadius: layout.borderRadius.xl,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    locationFieldError: {
        borderColor: '#FCA5A5',
    },
    locationFieldDisabled: {
        opacity: 0.5,
    },
    locationFieldText: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
    },
    locationFieldPlaceholder: {
        color: 'rgba(0, 0, 0, 0.25)',
    },
    fieldError: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
        marginLeft: 16,
    },
    strengthContainer: {
        marginTop: -12,
        marginBottom: 24,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    strengthBarsRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 4,
    },
    strengthBar: {
        height: 4,
        flex: 1,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
    },
    strengthBarActive: {
        // dynamic color handled inline
    },
    strengthLabel: {
        fontSize: 11,
        fontWeight: '600',
        width: 50,
        textAlign: 'right',
        textTransform: 'uppercase',
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 32,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: 'rgba(0, 0, 0, 0.25)',
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    termsText: {
        flex: 1,
        fontSize: 13,
        color: 'rgba(0, 0, 0, 0.50)',
        lineHeight: 20,
    },
    linkText: {
        color: colors.primary,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    submitButton: {
        height: 56,
        borderRadius: 28,
        shadowColor: 'rgba(212, 138, 130, 0.2)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 40,
    },
    submitButtonText: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.35)',
    },
    footerLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});

export default RegisterScreen;
