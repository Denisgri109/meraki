import React from 'react';
import { StyleSheet, Dimensions, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../theme';

interface ScreenBackgroundProps extends ViewProps {
    children: React.ReactNode;
}

const { width, height } = Dimensions.get('window');

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({ children, style, ...props }) => {
    return (
        <LinearGradient
            colors={gradients.backgroundDeepPurple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.container, style]}
            {...props}
        >
            {children}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
