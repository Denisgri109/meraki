
export interface StampCard {
    stamp_id: string;
    card_id: string;
    card_name: string;
    card_description: string | null;
    master_id: string;
    master_name: string;
    master_avatar: string | null;
    stamps_collected: number;
    stamps_required: number;
    stamps_redeemed: number;
    reward_type: string;
    reward_value: number | null;
    reward_available: boolean;
    last_stamp_at: string | null;
    is_active?: boolean; // Optional, might be added later
}
