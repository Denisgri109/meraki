import React, { ReactNode } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme';

const { width, height } = Dimensions.get('window');

interface GlobalBackgroundProps {
    children?: ReactNode;
}

export const GlobalBackground: React.FC<GlobalBackgroundProps> = ({ children }) => {
    return (
        <LinearGradient
            colors={gradients.backgroundDeepPurple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.container}
        >
            <View style={styles.content}>{children}</View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
