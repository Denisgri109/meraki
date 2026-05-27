import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { Card } from '../Card';
import { colors } from '../../../theme/colors';

describe('Card Component', () => {
    it('renders with default variant and default padding', () => {
        const { getByTestId } = render(
            <Card testID="card">
                <Text>Card Content</Text>
            </Card>
        );

        const card = getByTestId('card');
        const styles = card.props.style.flat().reduce((acc: any, cur: any) => ({ ...acc, ...cur }), {});

        expect(styles.backgroundColor).toBe(colors.surface);
        expect(styles.borderWidth).toBe(1);
        expect(styles.borderColor).toBe(colors.border);
        expect(styles.padding).toBe(16);
    });

    it('renders elevated variant with shadow properties', () => {
        const { getByTestId } = render(
            <Card testID="card" variant="elevated">
                <Text>Card Content</Text>
            </Card>
        );

        const card = getByTestId('card');
        const styles = card.props.style.flat().reduce((acc: any, cur: any) => ({ ...acc, ...cur }), {});

        expect(styles.borderWidth).toBe(0);
        expect(styles.shadowOpacity).toBe(0.08);
        expect(styles.elevation).toBe(4);
    });

    it('renders glass variant', () => {
        const { getByTestId } = render(
            <Card testID="card" variant="glass">
                <Text>Card Content</Text>
            </Card>
        );

        const card = getByTestId('card');
        const styles = card.props.style.flat().reduce((acc: any, cur: any) => ({ ...acc, ...cur }), {});

        expect(styles.backgroundColor).toBe(colors.surfaceGlass);
        expect(styles.borderColor).toBe(colors.borderLight);
    });

    it('renders gold variant', () => {
        const { getByTestId } = render(
            <Card testID="card" variant="gold">
                <Text>Card Content</Text>
            </Card>
        );

        const card = getByTestId('card');
        const styles = card.props.style.flat().reduce((acc: any, cur: any) => ({ ...acc, ...cur }), {});

        expect(styles.borderColor).toBe(colors.borderGold);
        expect(styles.shadowColor).toBe(colors.accent);
    });

    it('removes padding when noPadding is true', () => {
        const { getByTestId } = render(
            <Card testID="card" noPadding>
                <Text>Card Content</Text>
            </Card>
        );

        const card = getByTestId('card');
        const styles = card.props.style.flat().reduce((acc: any, cur: any) => ({ ...acc, ...cur }), {});

        expect(styles.padding).toBe(0);
    });

    it('merges custom styles correctly', () => {
        const { getByTestId } = render(
            <Card testID="card" style={{ marginTop: 20 }}>
                <Text>Card Content</Text>
            </Card>
        );

        const card = getByTestId('card');
        const styles = card.props.style.flat().reduce((acc: any, cur: any) => ({ ...acc, ...cur }), {});

        expect(styles.marginTop).toBe(20);
        expect(styles.padding).toBe(16); // default padding should still apply
    });
});
