import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ModalProvider, useModal } from '../ModalContext';
import { MerakiModal } from '../../components/ui/MerakiModal';

// Mock the MerakiModal component to intercept props
jest.mock('../../components/ui/MerakiModal', () => ({
    MerakiModal: jest.fn(() => null)
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ModalProvider>{children}</ModalProvider>
);

describe('ModalContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('useModal outside provider', () => {
        it('throws error when used outside ModalProvider', () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => {
                renderHook(() => useModal());
            }).toThrow('useModal must be used within a ModalProvider');
            spy.mockRestore();
        });
    });

    describe('showModal and hideModal', () => {
        it('shows and hides a basic modal', () => {
            const { result } = renderHook(() => useModal(), { wrapper });

            act(() => {
                result.current.showModal({ title: 'Test Modal', message: 'Test Message' });
            });

            expect(MerakiModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    visible: true,
                    title: 'Test Modal',
                    message: 'Test Message'
                }),
                undefined
            );

            act(() => {
                result.current.hideModal();
            });

            expect(MerakiModal).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    visible: false,
                    title: 'Test Modal', // Props remain, visible is false
                    message: 'Test Message'
                }),
                undefined
            );
        });
    });

    describe('showAlert', () => {
        it('shows an alert modal with correct defaults', () => {
            const { result } = renderHook(() => useModal(), { wrapper });

            act(() => {
                result.current.showAlert('Alert Title', 'Alert Message', 'error');
            });

            expect(MerakiModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    visible: true,
                    title: 'Alert Title',
                    message: 'Alert Message',
                    type: 'error',
                    hideCancel: true,
                    confirmText: 'OK',
                    onConfirm: expect.any(Function)
                }),
                undefined
            );
        });

        it('dismisses modal on alert confirm', () => {
            const { result } = renderHook(() => useModal(), { wrapper });

            act(() => {
                result.current.showAlert('Alert Title', 'Alert Message');
            });

            const callArgs = (MerakiModal as jest.Mock).mock.calls;
            const onConfirm = callArgs[callArgs.length - 1][0].onConfirm;

            act(() => {
                onConfirm(); // Should call hideModal
            });

            expect(MerakiModal).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    visible: false
                }),
                undefined
            );
        });
    });

    describe('showConfirm', () => {
        it('shows a confirmation modal with correct props', () => {
            const { result } = renderHook(() => useModal(), { wrapper });
            const onConfirmMock = jest.fn();

            act(() => {
                result.current.showConfirm('Confirm Title', 'Confirm Message', onConfirmMock);
            });

            expect(MerakiModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    visible: true,
                    title: 'Confirm Title',
                    message: 'Confirm Message',
                    confirmText: 'Confirm',
                    cancelText: 'Cancel',
                    onConfirm: expect.any(Function)
                }),
                undefined
            );
        });

        it('calls onConfirm callback and hides modal when confirmed', () => {
            const { result } = renderHook(() => useModal(), { wrapper });
            const onConfirmMock = jest.fn();

            act(() => {
                result.current.showConfirm('Confirm Title', 'Confirm Message', onConfirmMock);
            });

            const callArgs = (MerakiModal as jest.Mock).mock.calls;
            const onConfirm = callArgs[callArgs.length - 1][0].onConfirm;

            act(() => {
                onConfirm();
            });

            expect(onConfirmMock).toHaveBeenCalledTimes(1);
            expect(MerakiModal).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    visible: false
                }),
                undefined
            );
        });
    });
});
