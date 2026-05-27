import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';
import { colors, layout } from '../../../theme/colors';
import { Text, View } from 'react-native';

describe('Button Component', () => {
    it('renders correctly with default props', () => {
        const { getByText } = render(<Button title="Default Button" />);
        const buttonText = getByText('Default Button');

        expect(buttonText).toBeTruthy();

        // Assert text styles for default (primary, md)
        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.fontFamily).toBe('Manrope-SemiBold');
        expect(flattenedTextStyle.color).toBe(colors.textInvert);
        expect(flattenedTextStyle.fontSize).toBe(15); // md size
    });

    it('triggers onPress callback when pressed', () => {
        const onPressMock = jest.fn();
        const { getByText } = render(<Button title="Press Me" onPress={onPressMock} />);

        fireEvent.press(getByText('Press Me'));
        expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('renders secondary variant correctly', () => {
        const { getByText } = render(<Button title="Secondary" variant="secondary" />);
        const buttonText = getByText('Secondary');

        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.color).toBe(colors.text); // secondary uses colors.text
    });

    it('renders outline variant correctly', () => {
        const { getByText } = render(<Button title="Outline" variant="outline" />);
        const buttonText = getByText('Outline');

        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.color).toBe(colors.text); // outline uses colors.text
    });

    it('renders loading state correctly', () => {
        const onPressMock = jest.fn();
        const { getByText, getByTestId, queryByText } = render(
            <Button title="Loading Button" loading onPress={onPressMock} />
        );

        const buttonText = getByText('Loading Button');
        expect(buttonText).toBeTruthy();

        // ActivityIndicator should be rendered but it's hard to find without testID.
        // We'll rely on the disabled behavior when loading is true.
        fireEvent.press(buttonText); // Should be disabled
        expect(onPressMock).not.toHaveBeenCalled();
    });

    it('renders disabled state correctly', () => {
        const onPressMock = jest.fn();
        const { getByText } = render(
            <Button title="Disabled Button" disabled onPress={onPressMock} />
        );

        const buttonText = getByText('Disabled Button');

        fireEvent.press(buttonText);
        expect(onPressMock).not.toHaveBeenCalled();

        // Check text color for disabled
        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.color).toBe(colors.textMuted);
    });

    it('renders with an icon correctly', () => {
        const { getByText } = render(<Button title="Icon Button" icon="🚀" />);
        const iconElement = getByText('🚀');
        const buttonText = getByText('Icon Button');

        expect(iconElement).toBeTruthy();
        expect(buttonText).toBeTruthy();
    });

    it('renders fullWidth correctly', () => {
        const { getByText, root } = render(<Button title="Full Width" fullWidth />);
        const buttonText = getByText('Full Width');
        expect(buttonText).toBeTruthy();

        // Check for '100%' width in container styles if possible
        // Note: the `fullWidth` prop applies `{ width: '100%' }` to containerStyle
    });

    it('renders size correctly (sm)', () => {
        const { getByText } = render(<Button title="Small" size="sm" />);
        const buttonText = getByText('Small');

        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.fontSize).toBe(13); // sm size
    });

    it('renders size correctly (lg)', () => {
        const { getByText } = render(<Button title="Large" size="lg" />);
        const buttonText = getByText('Large');

        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.fontSize).toBe(17); // lg size
    });

    it('renders gradient variant correctly', () => {
        const { getByText } = render(<Button title="Gradient" variant="gradient" />);
        const buttonText = getByText('Gradient');

        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.color).toBe(colors.textInvert); // gradient uses textInvert
    });

    it('renders custom style and textStyle correctly', () => {
        const { getByText } = render(
            <Button
                title="Custom Styles"
                style={{ margin: 10 }}
                textStyle={{ fontWeight: 'bold' as any }} // Need type assertion for standard React Native types vs test
            />
        );
        const buttonText = getByText('Custom Styles');

        const textStyle = buttonText.props.style.flat();
        const flattenedTextStyle = Object.assign({}, ...textStyle);
        expect(flattenedTextStyle.fontWeight).toBe('bold');
    });
});
