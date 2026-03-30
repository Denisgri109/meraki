import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

interface ScreenBackgroundProps extends ViewProps {
    children: React.ReactNode;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({ children, style, ...props }) => {
    return (
        <View
            style={[styles.container, style]}
            {...props}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
});
