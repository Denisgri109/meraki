
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CitySelectionModal } from '../CitySelectionModal';
import { useCitySelection } from '../../hooks/useCitySelection';

// Mock the hook
jest.mock('../../hooks/useCitySelection');

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('../ui', () => ({
    SearchablePicker: 'SearchablePicker',
}));

// Mock only the specific React Native components that crash the jest preset due to missing constructor issues.
jest.mock('react-native', () => {
    const React = require('react');
    const RN = jest.requireActual('react-native');

    return Object.setPrototypeOf({
        Modal: (props: any) => React.createElement(RN.View, { testID: "modal-mock", ...props }, props.children),
        ActivityIndicator: (props: any) => React.createElement(RN.View, { testID: "ActivityIndicator", ...props }),
        Text: (props: any) => React.createElement('Text', { testID: "Text", ...props }, props.children),
        TextInput: (props: any) => React.createElement('TextInput', { testID: "TextInput", ...props }),
        // We don't mock TouchableOpacity so testing-library native checks for 'disabled' work
    }, RN);
});


const mockUseCitySelection = useCitySelection as jest.MockedFunction<typeof useCitySelection>;

describe('CitySelectionModal', () => {
    const defaultProps = {
        visible: true,
        detectedCountry: 'United States',
        detectedCountryCode: 'US',
        onCitySaved: jest.fn(),
        onClose: jest.fn(),
    };

    const mockActions = {
        setSelectedCity: jest.fn(),
        setCountryPickerVisible: jest.fn(),
        setStatePickerVisible: jest.fn(),
        handleCountrySelect: jest.fn(),
        handleStateSelect: jest.fn(),
        handleSave: jest.fn(),
    };

    const mockState = {
        selectedCity: '',
        countries: [],
        states: [],
        loadingCountries: false,
        loadingStates: false,
        saving: false,
        countryPickerVisible: false,
        statePickerVisible: false,
        currentCountry: 'United States',
        currentCountryCode: 'US',
        currentState: '',
        hasStates: true,
        canSave: true,
        countryPickerItems: [],
        statePickerItems: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseCitySelection.mockReturnValue({
            state: mockState,
            actions: mockActions,
        } as any);
    });

    it('renders properly with given state', () => {
        const { getByText, getByPlaceholderText } = render(
            <CitySelectionModal {...defaultProps} />
        );

        expect(getByText('Set your location')).toBeTruthy();
        expect(getByText('Country')).toBeTruthy();
        expect(getByText('State / Region')).toBeTruthy();
        // @testing-library/react-native might have trouble with 'City' because it contains nested elements. We can match by a regex.
        expect(getByText(/City/)).toBeTruthy();
        expect(getByText('United States')).toBeTruthy();
        expect(getByPlaceholderText('Type your city name')).toBeTruthy();
    });

    it('triggers setCountryPickerVisible on country field press', () => {
        const { getByText } = render(<CitySelectionModal {...defaultProps} />);

        const countryField = getByText('United States');
        fireEvent.press(countryField);

        expect(mockActions.setCountryPickerVisible).toHaveBeenCalledWith(true);
    });

    it('triggers setStatePickerVisible on state field press', () => {
        const { getByText } = render(<CitySelectionModal {...defaultProps} />);

        const stateField = getByText('Select your state / region');
        fireEvent.press(stateField);

        expect(mockActions.setStatePickerVisible).toHaveBeenCalledWith(true);
    });

    it('calls setSelectedCity on city input change', () => {
        const { getByPlaceholderText } = render(<CitySelectionModal {...defaultProps} />);

        const cityInput = getByPlaceholderText('Type your city name');
        fireEvent.changeText(cityInput, 'New York');

        expect(mockActions.setSelectedCity).toHaveBeenCalledWith('New York');
    });

    it('calls handleSave on continue button press', () => {
        const { getByText } = render(<CitySelectionModal {...defaultProps} />);

        const saveButton = getByText('Continue');
        fireEvent.press(saveButton);

        expect(mockActions.handleSave).toHaveBeenCalled();
    });

    it('disables save button when canSave is false', () => {
        mockUseCitySelection.mockReturnValue({
            state: { ...mockState, canSave: false },
            actions: mockActions,
        } as any);

        const { getByText } = render(<CitySelectionModal {...defaultProps} />);

        const saveButtonText = getByText('Continue');
        fireEvent.press(saveButtonText);

        expect(mockActions.handleSave).not.toHaveBeenCalled();
    });

    it('shows ActivityIndicator on save button when saving is true', () => {
        mockUseCitySelection.mockReturnValue({
            state: { ...mockState, saving: true },
            actions: mockActions,
        } as any);

        const { queryByText, getByTestId } = render(<CitySelectionModal {...defaultProps} />);

        expect(queryByText('Continue')).toBeNull();
        expect(getByTestId('ActivityIndicator')).toBeTruthy();
    });
});
