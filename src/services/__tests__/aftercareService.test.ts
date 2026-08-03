import { createCampaign, deleteCampaign, listCampaigns, updateCampaign } from '../aftercareService';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

const makeBuilder = (result: { data?: any; error?: any }) => {
    const promise = Promise.resolve(result);
    const builder: any = promise;
    builder.select = jest.fn(() => builder);
    builder.insert = jest.fn(() => builder);
    builder.update = jest.fn(() => builder);
    builder.delete = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.single = jest.fn(() => promise);
    builder.order = jest.fn(() => builder);
    return builder;
};

describe('aftercareService', () => {
    beforeEach(() => jest.resetAllMocks());

    const baseInput = {
        name: 'Post-lash care',
        message: 'Avoid water for 24h.',
        campaignType: 'aftercare' as const,
        isRecurring: true,
        daysAfterAppointment: 2,
    };

    describe('listCampaigns', () => {
        it('lists campaigns for the master, newest first', async () => {
            const builder = makeBuilder({ data: [{ id: 'c1' }], error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            const result = await listCampaigns('master-1');

            expect(supabase.from).toHaveBeenCalledWith('aftercare_campaigns');
            expect(builder.eq).toHaveBeenCalledWith('master_id', 'master-1');
            expect(result).toHaveLength(1);
        });
    });

    describe('createCampaign', () => {
        it('rejects empty name/message', async () => {
            await expect(createCampaign('m1', { ...baseInput, name: ' ' })).rejects.toThrow('name');
            await expect(createCampaign('m1', { ...baseInput, message: ' ' })).rejects.toThrow('Message');
        });

        it('rejects recurring campaigns without days', async () => {
            await expect(
                createCampaign('m1', { ...baseInput, daysAfterAppointment: null })
            ).rejects.toThrow('days after appointment');
        });

        it('inserts recurring campaign with correct payload', async () => {
            const builder = makeBuilder({ data: { id: 'c1' }, error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await createCampaign('master-1', baseInput);

            expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
                master_id: 'master-1',
                name: 'Post-lash care',
                campaign_type: 'aftercare',
                is_recurring: true,
                days_after_appointment: 2,
                send_date: null,
                is_active: true,
            }));
        });

        it('stores send_date for one-time campaigns and nulls the days', async () => {
            const builder = makeBuilder({ data: { id: 'c2' }, error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await createCampaign('master-1', {
                ...baseInput,
                isRecurring: false,
                sendDate: '2026-09-01',
            });

            expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
                is_recurring: false,
                send_date: '2026-09-01',
                days_after_appointment: null,
            }));
        });
    });

    describe('updateCampaign', () => {
        it('throws on empty patch', async () => {
            await expect(updateCampaign('c1', {})).rejects.toThrow('No valid fields');
        });

        it('toggles is_active only', async () => {
            const builder = makeBuilder({ data: { id: 'c1', is_active: false }, error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            const result = await updateCampaign('c1', { isActive: false });

            expect(builder.update).toHaveBeenCalledWith({ is_active: false });
            expect(result.is_active).toBe(false);
        });
    });

    describe('deleteCampaign', () => {
        it('deletes by id', async () => {
            const builder = makeBuilder({ error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await deleteCampaign('c1');

            expect(builder.delete).toHaveBeenCalled();
            expect(builder.eq).toHaveBeenCalledWith('id', 'c1');
        });
    });
});
