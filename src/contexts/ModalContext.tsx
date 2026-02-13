import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MerakiModal, MerakiModalProps } from '../components/ui/MerakiModal';

type ModalOptions = Omit<MerakiModalProps, 'visible' | 'onClose'>;

interface ModalContextType {
    showModal: (options: ModalOptions) => void;
    hideModal: () => void;
    showAlert: (title: string, message?: string, type?: MerakiModalProps['type'], options?: Partial<ModalOptions>) => void;
    showConfirm: (
        title: string,
        message: string,
        onConfirm: () => void,
        options?: Partial<ModalOptions>
    ) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [modalProps, setModalProps] = useState<ModalOptions>({
        title: '',
    });

    const hideModal = useCallback(() => {
        setVisible(false);
    }, []);

    const showModal = useCallback((options: ModalOptions) => {
        setModalProps(options);
        setVisible(true);
    }, []);

    const showAlert = useCallback((title: string, message?: string, type: MerakiModalProps['type'] = 'info', options: Partial<ModalOptions> = {}) => {
        setModalProps({
            title,
            message,
            type,
            hideCancel: true,
            confirmText: 'OK',
            onConfirm: hideModal,
            ...options
        });
        setVisible(true);
    }, [hideModal]);

    const showConfirm = useCallback((
        title: string,
        message: string,
        onConfirm: () => void,
        options: Partial<ModalOptions> = {}
    ) => {
        setModalProps({
            title,
            message,
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            onConfirm: () => {
                onConfirm();
                hideModal();
            },
            ...options,
        });
        setVisible(true);
    }, [hideModal]);

    return (
        <ModalContext.Provider value={{ showModal, hideModal, showAlert, showConfirm }}>
            {children}
            <MerakiModal
                visible={visible}
                onClose={hideModal}
                {...modalProps}
            />
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (context === undefined) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}
