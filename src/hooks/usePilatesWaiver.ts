import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { TablesInsert } from '../types/database';

export interface PilatesWaiverData {
    injuriesJointProblems: string;
    pilatesExperience: string;
    hasIllnesses: boolean;
    illnessDetails: string;
    pregnancyStatus: 'yes' | 'no' | 'not_applicable';
    medicationDetails: string;
    exerciseHistory: string;
    practitionerRecommended: boolean;
    goalsExpectations: string;
    hasBoneCondition: boolean;
    agreedTermsOfUse: boolean;
    agreedLiabilityWaiver: boolean;
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
}

export interface UsePilatesWaiverResult {
    /** true if the user has a signed waiver on file */
    hasWaiver: boolean;
    /** true while the initial DB check is in flight */
    loading: boolean;
    /** true while the form submission is in flight */
    submitting: boolean;
    /** error message from the last operation, if any */
    error: string | null;
    /** re-query the database for the current waiver status. returns true if a waiver exists */
    checkWaiver: () => Promise<boolean>;
    /** insert a new waiver (or update if one already exists). throws on error */
    submitWaiver: (data: PilatesWaiverData) => Promise<void>;
}

/**
 * Checks whether the signed-in user has a signed Pilates waiver and provides
 * a method to submit one. Automatically re-checks when the user changes.
 * Mirrors the web implementation in meraki-WEB/src/hooks/usePilatesWaiver.ts.
 */
export function usePilatesWaiver(): UsePilatesWaiverResult {
    const { user } = useAuth();
    const [hasWaiver, setHasWaiver] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);

    const checkWaiver = useCallback(async (): Promise<boolean> => {
        if (!user?.id) {
            setHasWaiver(false);
            setLoading(false);
            return false;
        }

        setLoading(true);
        setError(null);
        try {
            const { data, error: queryError } = await supabase
                .from('pilates_waivers')
                .select('id, signed_at')
                .eq('user_id', user.id)
                .maybeSingle();

            if (queryError) throw queryError;
            const exists = !!data;
            setHasWaiver(exists);
            return exists;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to check waiver status';
            setError(msg);
            setHasWaiver(false);
            return false;
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id !== lastUserIdRef.current) {
            lastUserIdRef.current = user?.id ?? null;
            void checkWaiver();
        }
    }, [user?.id, checkWaiver]);

    const submitWaiver = useCallback(
        async (data: PilatesWaiverData) => {
            if (!user?.id) {
                throw new Error('You must be signed in to submit a waiver.');
            }

            setSubmitting(true);
            setError(null);
            try {
                const injuriesText = data.injuriesJointProblems.trim();
                const payload: TablesInsert<'pilates_waivers'> = {
                    user_id: user.id,
                    has_injuries: injuriesText.length > 0,
                    injury_details: injuriesText || null,
                    emergency_contact_name: data.emergencyContactName.trim() || null,
                    emergency_contact_relationship: data.emergencyContactRelationship.trim() || null,
                    emergency_contact_phone: data.emergencyContactPhone.trim() || null,
                    signature_name: null,
                    signed_at: new Date().toISOString(),
                    terms_version: '3.0',
                    injuries_joint_problems: injuriesText || null,
                    pilates_experience: data.pilatesExperience.trim() || null,
                    has_illnesses: data.hasIllnesses,
                    illness_details: data.hasIllnesses ? data.illnessDetails.trim() || null : null,
                    pregnancy_status: data.pregnancyStatus,
                    medication_details: data.medicationDetails.trim() || null,
                    exercise_history: data.exerciseHistory.trim() || null,
                    practitioner_recommended: data.practitionerRecommended,
                    goals_expectations: data.goalsExpectations.trim() || null,
                    has_bone_condition: data.hasBoneCondition,
                    agreed_terms_of_use: data.agreedTermsOfUse,
                    agreed_liability_waiver: data.agreedLiabilityWaiver,
                };

                const { error: upsertError } = await supabase
                    .from('pilates_waivers')
                    .upsert(payload, { onConflict: 'user_id' });

                if (upsertError) throw upsertError;

                setHasWaiver(true);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to submit waiver';
                setError(msg);
                throw err;
            } finally {
                setSubmitting(false);
            }
        },
        [user?.id]
    );

    return { hasWaiver, loading, submitting, error, checkWaiver, submitWaiver };
}
