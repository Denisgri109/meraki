import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { safeGoBack } from '../../navigation/navigationUtils';
import { colors } from '../../theme';

interface SafeBackButtonProps {
    fallbackRoute?: string;
    fallbackParams?: Record<string, unknown>;
    style?: ViewStyle;
    icon?: string;
    onPress?: () => void;
}

export function SafeBackButton({
    fallbackRoute = 'Home',
    fallbackParams,
    style,
    icon = '←',
    onPress,
}: SafeBackButtonProps) {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            safeGoBack(navigation, fallbackRoute, fallbackParams);
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            style={[styles.button, style]}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Navigates to the previous screen"
        >
            <Text style={styles.icon}>{icon}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 20,
        color: colors.text,
    },
});

export default SafeBackButton;
