export const getRewardText = (rewardType: string, rewardValue: number | null): string => {
    switch (rewardType) {
        case 'free_service':
        case 'service': // Handle master side reward type
            return 'Free Service';
        case 'discount_percent':
            return `${rewardValue}% Off`;
        case 'discount_amount':
            return `€${rewardValue} Off`;
        default:
            return 'Reward';
    }
};
