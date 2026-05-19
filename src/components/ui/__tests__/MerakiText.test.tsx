import React from 'react';
import { render } from '@testing-library/react-native';
import { MerakiText } from '../MerakiText';
import { colors } from '../../../theme/colors';

describe('MerakiText', () => {
    it('renders with default props (body variant, default color, left align)', () => {
        const { getByText } = render(<MerakiText>Test Text</MerakiText>);
        const textElement = getByText('Test Text');

        expect(textElement).toBeTruthy();

        // Ensure default styles are applied
        const style = textElement.props.style.flat();
        const flattenedStyle = Object.assign({}, ...style);

        expect(flattenedStyle.fontFamily).toBe('Manrope-Regular'); // base + body
        expect(flattenedStyle.fontSize).toBe(16); // body
        expect(flattenedStyle.color).toBe(colors.text); // default color
        expect(flattenedStyle.textAlign).toBe('left'); // default align
    });

    it('renders with h1 variant', () => {
        const { getByText } = render(<MerakiText variant="h1">Heading 1</MerakiText>);
        const textElement = getByText('Heading 1');

        const style = textElement.props.style.flat();
        const flattenedStyle = Object.assign({}, ...style);

        expect(flattenedStyle.fontFamily).toBe('Manrope-Bold');
        expect(flattenedStyle.fontSize).toBe(32);
        expect(flattenedStyle.letterSpacing).toBe(-0.5);
    });

    it('renders with custom color', () => {
        const customColor = '#FF0000';
        const { getByText } = render(<MerakiText color={customColor}>Colored Text</MerakiText>);
        const textElement = getByText('Colored Text');

        const style = textElement.props.style.flat();
        const flattenedStyle = Object.assign({}, ...style);

        expect(flattenedStyle.color).toBe(customColor);
    });

    it('renders with center alignment', () => {
        const { getByText } = render(<MerakiText align="center">Centered Text</MerakiText>);
        const textElement = getByText('Centered Text');

        const style = textElement.props.style.flat();
        const flattenedStyle = Object.assign({}, ...style);

        expect(flattenedStyle.textAlign).toBe('center');
    });

    it('merges custom styles', () => {
        const customStyle = { marginTop: 10, opacity: 0.5 };
        const { getByText } = render(<MerakiText style={customStyle}>Styled Text</MerakiText>);
        const textElement = getByText('Styled Text');

        const style = textElement.props.style.flat();
        const flattenedStyle = Object.assign({}, ...style);

        expect(flattenedStyle.marginTop).toBe(10);
        expect(flattenedStyle.opacity).toBe(0.5);
    });
});
