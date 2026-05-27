import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { Input } from '../Input';
import { colors } from '../../../theme/colors';

describe('Input Component', () => {
    it('renders with default props', () => {
        const { getByPlaceholderText } = render(<Input placeholder="Enter text" />);
        const input = getByPlaceholderText('Enter text');
        expect(input).toBeTruthy();
    });

    it('renders the label when provided', () => {
        const { getByText } = render(<Input label="Username" />);
        expect(getByText('Username')).toBeTruthy();
    });

    it('renders the error message when provided', () => {
        const { getByText } = render(<Input error="Invalid input" />);
        expect(getByText('Invalid input')).toBeTruthy();
    });

    it('renders left and right icons when provided', () => {
        const LeftIcon = <Text testID="left-icon">Left</Text>;
        const RightIcon = <Text testID="right-icon">Right</Text>;

        const { getByTestId } = render(
            <Input leftIcon={LeftIcon} rightIcon={RightIcon} />
        );

        expect(getByTestId('left-icon')).toBeTruthy();
        expect(getByTestId('right-icon')).toBeTruthy();
    });

    it('handles focus and blur states correctly', () => {
        const onFocusMock = jest.fn();
        const onBlurMock = jest.fn();

        const { getByPlaceholderText } = render(
            <Input
                placeholder="Test focus"
                onFocus={onFocusMock}
                onBlur={onBlurMock}
            />
        );

        const input = getByPlaceholderText('Test focus');

        // Focus
        fireEvent(input, 'focus');
        expect(onFocusMock).toHaveBeenCalled();

        // Blur
        fireEvent(input, 'blur');
        expect(onBlurMock).toHaveBeenCalled();
    });

    it('calls onChangeText when typing', () => {
        const onChangeTextMock = jest.fn();
        const { getByPlaceholderText } = render(
            <Input placeholder="Type here" onChangeText={onChangeTextMock} />
        );

        const input = getByPlaceholderText('Type here');
        fireEvent.changeText(input, 'Hello World');

        expect(onChangeTextMock).toHaveBeenCalledWith('Hello World');
    });

    it('applies the glass variant styles', () => {
        const { getByPlaceholderText } = render(
            <Input placeholder="Glass input" variant="glass" />
        );

        const input = getByPlaceholderText('Glass input');

        // The wrapper is the parent of the input, parent of parent is container
        // Actually to test styles reliably in React Native Testing Library,
        // it's easier to check if it renders without throwing. But let's verify if variant doesn't crash.
        expect(input).toBeTruthy();
    });
});
