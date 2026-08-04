/**
 * PilatesWaiverSheet — Tier 2 component tests.
 *
 * The liability-critical form: 8 required health fields (text + radio),
 * emergency contact, two consent gates (terms + liability). Asserts:
 *  - submit is REJECTED client-side until every required field is filled
 *  - consent toggles are enforced independently
 *  - successful submit normalises (trims) and forwards the exact data shape
 *    used by usePilatesWaiver.submitWaiver
 *  - submitWaiver failure surfaces an error and does NOT call onSigned
 *  - dismiss while submitting is ignored (liability: no half-signed state)
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PilatesWaiverSheet } from '../PilatesWaiverSheet';
import { usePilatesWaiver } from '../../hooks/usePilatesWaiver';

jest.mock('../../hooks/usePilatesWaiver', () => ({
    usePilatesWaiver: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
    MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

const submitWaiverMock = jest.fn();
const hookState = { hasWaiver: false, loading: false, submitting: false, error: null, checkWaiver: jest.fn(), submitWaiver: submitWaiverMock };

beforeEach(() => {
    jest.clearAllMocks();
    submitWaiverMock.mockResolvedValue(undefined);
    (usePilatesWaiver as jest.Mock).mockReturnValue(hookState);
});

const FILL = {
    injuries: 'Knee surgery 2023',
    experience: 'Beginner',
    medications: 'None',
    exercise: 'Walking 2x per week',
    goals: 'Core strength',
    contactName: 'Jane Doe',
    contactRel: 'Sister',
    contactPhone: '+353871234567',
};

/** Fill every text field and pick safe radio answers. Leaves consents alone. */
function fillForm(screen: ReturnType<typeof render>) {
    fireEvent.changeText(screen.getByPlaceholderText('Describe any injuries or joint problems...'), FILL.injuries);
    fireEvent.changeText(screen.getByPlaceholderText('e.g., Some Mat Pilates, Some Reformer, Experienced, etc.'), FILL.experience);
    // Q3 illnesses -> "No" (first No radio: illnesses)
    fireEvent.press(screen.getAllByText('No')[0]);
    // Q4 pregnancy -> N/A
    fireEvent.press(screen.getByText('N/A'));
    fireEvent.changeText(screen.getByPlaceholderText('List any medication that may affect your session...'), FILL.medications);
    fireEvent.changeText(screen.getByPlaceholderText('e.g., Running 3x per week, last exercised yesterday...'), FILL.exercise);
    fireEvent.changeText(screen.getByPlaceholderText('e.g., Improve core strength, better posture, rehabilitation...'), FILL.goals);
    // 'No' radio order in the sheet: [0]=illnesses, [1]=pregnancy, [2]=practitioner, [3]=bone.
    fireEvent.press(screen.getAllByText('No')[2]);
    fireEvent.press(screen.getAllByText('No')[3]);
    fireEvent.changeText(screen.getByPlaceholderText('Full name'), FILL.contactName);
    fireEvent.changeText(screen.getByPlaceholderText('e.g., Spouse, Parent, Sibling'), FILL.contactRel);
    fireEvent.changeText(screen.getByPlaceholderText('Phone number'), FILL.contactPhone);
}

function bothConsents(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByText(/I agree to the/));
    fireEvent.press(screen.getByText(/I understand and agree to the above terms/));
}

describe('PilatesWaiverSheet — render', () => {
    it('renders all section headers and the consent CTA when visible', () => {
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={jest.fn()} />);
        expect(screen.getByText('Health Screening & Waiver')).toBeTruthy();
        expect(screen.getByText('HEALTH SCREENING')).toBeTruthy();
        expect(screen.getByText('EMERGENCY CONTACT')).toBeTruthy();
        expect(screen.getByText('CONSENT')).toBeTruthy();
        expect(screen.getByText('LIABILITY WAIVER')).toBeTruthy();
        expect(screen.getByText('Sign & Continue')).toBeTruthy();
    });

    it('close button is accessible (label + dismisses on press)', () => {
        const onDismiss = jest.fn();
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={onDismiss} />);
        fireEvent.press(screen.getByLabelText('Close'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});

describe('PilatesWaiverSheet — validation gate', () => {
    it('an empty form does NOT call submitWaiver', async () => {
        const onSigned = jest.fn();
        const screen = render(<PilatesWaiverSheet visible onSigned={onSigned} onDismiss={jest.fn()} />);
        fireEvent.press(screen.getByText('Sign & Continue'));
        expect(submitWaiverMock).not.toHaveBeenCalled();
        expect(onSigned).not.toHaveBeenCalled();
    });

    it('rejecting radios alone (all text filled) still blocks submission', () => {
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={jest.fn()} />);
        fireEvent.changeText(screen.getByPlaceholderText('Describe any injuries or joint problems...'), FILL.injuries);
        fireEvent.changeText(screen.getByPlaceholderText('e.g., Some Mat Pilates, Some Reformer, Experienced, etc.'), FILL.experience);
        fireEvent.changeText(screen.getByPlaceholderText('List any medication that may affect your session...'), FILL.medications);
        fireEvent.changeText(screen.getByPlaceholderText('e.g., Running 3x per week, last exercised yesterday...'), FILL.exercise);
        fireEvent.changeText(screen.getByPlaceholderText('e.g., Improve core strength, better posture, rehabilitation...'), FILL.goals);
        fireEvent.changeText(screen.getByPlaceholderText('Full name'), FILL.contactName);
        fireEvent.changeText(screen.getByPlaceholderText('e.g., Spouse, Parent, Sibling'), FILL.contactRel);
        fireEvent.changeText(screen.getByPlaceholderText('Phone number'), FILL.contactPhone);
        bothConsents(screen);
        fireEvent.press(screen.getByText('Sign & Continue'));
        // no radios answered -> hasIllnesses null -> blocked
        expect(submitWaiverMock).not.toHaveBeenCalled();
    });

    it('fully filled form WITHOUT consents is still blocked', () => {
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={jest.fn()} />);
        fillForm(screen);
        fireEvent.press(screen.getByText('Sign & Continue'));
        expect(submitWaiverMock).not.toHaveBeenCalled();
    });

    it('single consent (terms only) is blocked — liability waiver is independently required', () => {
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={jest.fn()} />);
        fillForm(screen);
        fireEvent.press(screen.getByText(/I agree to the/));
        fireEvent.press(screen.getByText('Sign & Continue'));
        expect(submitWaiverMock).not.toHaveBeenCalled();
    });

    it('emergency phone shorter than 5 chars is rejected', () => {
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={jest.fn()} />);
        fillForm(screen);
        // overwrite phone with too-short value
        fireEvent.changeText(screen.getByPlaceholderText('Phone number'), '1234');
        bothConsents(screen);
        fireEvent.press(screen.getByText('Sign & Continue'));
        expect(submitWaiverMock).not.toHaveBeenCalled();
    });
});

describe('PilatesWaiverSheet — submission', () => {
    it('forwards a complete, trimmed payload and calls onSigned on success', async () => {
        const onSigned = jest.fn();
        const screen = render(<PilatesWaiverSheet visible onSigned={onSigned} onDismiss={jest.fn()} />);
        fillForm(screen);
        // pad fields with trailing spaces; handler must trim
        fireEvent.changeText(screen.getByPlaceholderText('Full name'), '  Jane Doe  ');
        bothConsents(screen);
        fireEvent.press(screen.getByText('Sign & Continue'));

        await waitFor(() => expect(submitWaiverMock).toHaveBeenCalledTimes(1));
        const payload = submitWaiverMock.mock.calls[0][0];
        expect(payload).toMatchObject({
            injuriesJointProblems: FILL.injuries,
            pilatesExperience: FILL.experience,
            hasIllnesses: false,
            illnessDetails: '',
            pregnancyStatus: 'not_applicable',
            medicationDetails: FILL.medications,
            exerciseHistory: FILL.exercise,
            practitionerRecommended: false,
            goalsExpectations: FILL.goals,
            hasBoneCondition: false,
            agreedTermsOfUse: true,
            agreedLiabilityWaiver: true,
            emergencyContactName: 'Jane Doe',
            emergencyContactRelationship: FILL.contactRel,
            emergencyContactPhone: FILL.contactPhone,
        });
        await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
    });

    it('shows the error and does NOT call onSigned when submitWaiver rejects', async () => {
        submitWaiverMock.mockRejectedValue(new Error('RLS denied'));
        const onSigned = jest.fn();
        const screen = render(<PilatesWaiverSheet visible onSigned={onSigned} onDismiss={jest.fn()} />);
        fillForm(screen);
        bothConsents(screen);
        fireEvent.press(screen.getByText('Sign & Continue'));

        await waitFor(() => expect(screen.getByText('RLS denied')).toBeTruthy());
        expect(onSigned).not.toHaveBeenCalled();
    });

    it('while submitting, dismiss attempts are ignored (prevents half-signed state)', async () => {
        let resolveSubmit: () => void;
        submitWaiverMock.mockImplementation(() => new Promise<void>((r) => { resolveSubmit = r; }));
        const onDismiss = jest.fn();
        hookState.submitting = true;
        (usePilatesWaiver as jest.Mock).mockReturnValue({ ...hookState });
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={onDismiss} />);
        fireEvent.press(screen.getByLabelText('Close'));
        expect(onDismiss).not.toHaveBeenCalled();
        hookState.submitting = false;
    });

    it('form resets between openings (previous answers never leak into a new session)', async () => {
        const screen = render(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={jest.fn()} />);
        fireEvent.changeText(screen.getByPlaceholderText('Full name'), 'Te Stuser');
        screen.update(<PilatesWaiverSheet visible={false} onSigned={jest.fn()} onDismiss={jest.fn()} />);
        screen.update(<PilatesWaiverSheet visible onSigned={jest.fn()} onDismiss={jest.fn()} />);
        expect(screen.getByPlaceholderText('Full name').props.value).toBe('');
    });
});
