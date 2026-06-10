import { getRewardText } from '../loyalty';

describe('loyalty utils', () => {
    describe('getRewardText', () => {
        it('should return "Free Service" for free_service reward type', () => {
            expect(getRewardText('free_service', null)).toBe('Free Service');
            expect(getRewardText('free_service', 10)).toBe('Free Service');
        });

        it('should return "Free Service" for service reward type', () => {
            expect(getRewardText('service', null)).toBe('Free Service');
            expect(getRewardText('service', 10)).toBe('Free Service');
        });

        it('should return percentage off for discount_percent reward type', () => {
            expect(getRewardText('discount_percent', 15)).toBe('15% Off');
            expect(getRewardText('discount_percent', 0)).toBe('0% Off');
            // Edge case where rewardValue might be null
            expect(getRewardText('discount_percent', null)).toBe('null% Off'); // Based on current code logic
        });

        it('should return amount off for discount_amount reward type', () => {
            expect(getRewardText('discount_amount', 20)).toBe('€20 Off');
            expect(getRewardText('discount_amount', 0)).toBe('€0 Off');
            // Edge case where rewardValue might be null
            expect(getRewardText('discount_amount', null)).toBe('€null Off'); // Based on current code logic
        });

        it('should return "Reward" for unknown reward type', () => {
            expect(getRewardText('unknown_type', null)).toBe('Reward');
            expect(getRewardText('unknown_type', 10)).toBe('Reward');
        });

        it('should handle undefined or empty string', () => {
            expect(getRewardText('', null)).toBe('Reward');
            // @ts-ignore
            expect(getRewardText(undefined, null)).toBe('Reward');
        });
    });
});
