import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';
import { useModal } from '../../../contexts/ModalContext';

interface UsePreBookingQuestionnaireProps {
    serviceId: string;
    masterId: string | null;
    onClose: () => void;
    onSubmit: (consultationId: string) => void;
}

export function usePreBookingQuestionnaire({
    serviceId,
    masterId,
    onClose,
    onSubmit,
}: UsePreBookingQuestionnaireProps) {
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(false);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);

    const [formData, setFormData] = useState({
        hadBefore: false,
        howLongAgo: '',
        wasMyWork: false,
        photos: [] as string[],
        additionalNotes: '',
    });

    const resetForm = () => {
        setFormData({
            hadBefore: false,
            howLongAgo: '',
            wasMyWork: false,
            photos: [],
            additionalNotes: '',
        });
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const pickPhotos = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                selectionLimit: 3,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                setUploadingPhotos(true);
                const validAssets = result.assets.filter(asset => !!asset.base64);

                const uploadResults = [];
                for (const asset of validAssets) {
                    const fileName = `booking-consultations/${Date.now()}_${uuidv4()}.jpg`;

                    const uploadResult = await supabase.storage
                        .from('consultation-photos')
                        .upload(fileName, decode(asset.base64!), {
                            contentType: 'image/jpeg',
                        });

                    if (uploadResult.error) throw uploadResult.error;
                    uploadResults.push(uploadResult);
                }

                const uploadedUrls = uploadResults.map(uploadResult => {
                    const { data: { publicUrl } } = supabase.storage
                        .from('consultation-photos')
                        .getPublicUrl(uploadResult.data.path);
                    return publicUrl;
                });
                setFormData(prev => ({
                    ...prev,
                    photos: [...prev.photos, ...uploadedUrls].slice(0, 3)
                }));
            }
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Error uploading photos:', err);
            showAlert('Error', 'Failed to upload photos. Please try again.', 'error');
        } finally {
            setUploadingPhotos(false);
        }
    };

    const removePhoto = (url: string) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter(p => p !== url)
        }));
    };

    const handleSubmit = async () => {
        // Validate
        if (formData.hadBefore && !formData.howLongAgo) {
            showAlert('Required', 'Please select how long ago you had this service.', 'error');
            return;
        }
        if (formData.photos.length === 0) {
            showAlert('Required', 'Please upload at least one photo of the current state.', 'error');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('booking_consultations')
                .insert({
                    client_id: user.id,
                    service_id: serviceId,
                    master_id: masterId,
                    had_before: formData.hadBefore,
                    how_long_ago: formData.hadBefore ? formData.howLongAgo : null,
                    was_my_work: formData.hadBefore ? formData.wasMyWork : null,
                    photo_urls: formData.photos,
                    additional_notes: formData.additionalNotes.trim() || null,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) throw error;

            resetForm();
            onSubmit(data.id);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Error submitting consultation:', err);
            showAlert('Error', err.message || 'Failed to submit consultation request', 'error');
        } finally {
            setLoading(false);
        }
    };

    return {
        formData,
        setFormData,
        loading,
        uploadingPhotos,
        handleClose,
        pickPhotos,
        removePhoto,
        handleSubmit,
    };
}
