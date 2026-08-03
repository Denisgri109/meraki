import {
    createQrPayCode,
    deleteQrPayCode,
    listQrPayCodes,
    setQrPayAccess,
    updateQrPayCode,
} from '../qrPayService';
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
    builder.order = jest.fn(() => builder);
    builder.single = jest.fn(() => promise);
    builder.maybeSingle = jest.fn(() => promise);
    return builder;
};

describe('qrPayService', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    const codeImage = { id: 'c1', provider_name: 'Revolut', qr_image_url: 'https://x/qr.png', qr_payload: null, is_active: true, display_order: 0 };

    describe('listQrPayCodes', () => {
        it('returns all codes for owners', async () => {
            const builder = makeBuilder({ data: [codeImage], error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            const codes = await listQrPayCodes(true);

            expect(supabase.from).toHaveBeenCalledWith('qr_pay_codes');
            expect(builder.select).toHaveBeenCalledWith('*');
            expect(builder.eq).not.toHaveBeenCalled();
            expect(codes).toEqual([codeImage]);
        });

        it('filters to active rows for instructors', async () => {
            const builder = makeBuilder({ data: [codeImage], error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await listQrPayCodes(false);

            expect(builder.eq).toHaveBeenCalledWith('is_active', true);
        });
    });

    describe('createQrPayCode', () => {
        it('rejects when both or neither source is provided', async () => {
            await expect(
                createQrPayCode({ providerName: 'Revolut', qrImageUrl: 'x.png', qrPayload: 'data' })
            ).rejects.toThrow('exactly one');
            await expect(createQrPayCode({ providerName: 'Revolut' })).rejects.toThrow('exactly one');
            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('rejects empty provider name', async () => {
            await expect(
                createQrPayCode({ providerName: '  ', qrPayload: 'data' })
            ).rejects.toThrow('Provider name');
        });

        it('inserts image-based code with trim + defaults', async () => {
            const builder = makeBuilder({ data: codeImage, error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            const result = await createQrPayCode({
                providerName: 'Revolut',
                qrImageUrl: ' https://x/qr.png ',
                createdBy: 'owner-1',
            });

            expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
                provider_name: 'Revolut',
                qr_image_url: 'https://x/qr.png',
                qr_payload: null,
                display_order: 0,
                is_active: true,
                created_by: 'owner-1',
            }));
            expect(result.id).toBe('c1');
        });
    });

    describe('updateQrPayCode', () => {
        it('rejects switching to no source', async () => {
            const existing = makeBuilder({ data: codeImage, error: null });
            (supabase.from as jest.Mock).mockReturnValue(existing);

            await expect(
                updateQrPayCode('c1', { qrImageUrl: '', qrPayload: '' })
            ).rejects.toThrow('exactly one');
        });

        it('allows toggling is_active without touching sources', async () => {
            const existing = makeBuilder({ data: codeImage, error: null });
            const updated = makeBuilder({ data: { ...codeImage, is_active: false }, error: null });
            (supabase.from as jest.Mock)
                .mockReturnValueOnce(existing)
                .mockReturnValueOnce(updated);

            const result = await updateQrPayCode('c1', { isActive: false });

            expect(updated.update).toHaveBeenCalledWith({ is_active: false });
            expect(updated.eq).toHaveBeenCalledWith('id', 'c1');
            expect(result.is_active).toBe(false);
        });

        it('supports a source swap to payload', async () => {
            const existing = makeBuilder({ data: codeImage, error: null });
            const updated = makeBuilder({ data: codeImage, error: null });
            (supabase.from as jest.Mock)
                .mockReturnValueOnce(existing)
                .mockReturnValueOnce(updated);

            await updateQrPayCode('c1', { qrImageUrl: null, qrPayload: 'PAY-LINK' });

            expect(updated.update).toHaveBeenCalledWith({ qr_image_url: null, qr_payload: 'PAY-LINK' });
        });
    });

    describe('deleteQrPayCode', () => {
        it('deletes by id', async () => {
            const builder = makeBuilder({ error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await deleteQrPayCode('c1');

            expect(builder.delete).toHaveBeenCalled();
            expect(builder.eq).toHaveBeenCalledWith('id', 'c1');
        });
    });

    describe('setQrPayAccess', () => {
        it('sets can_view_qr_pay on the profile', async () => {
            const builder = makeBuilder({ error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await setQrPayAccess('profile-1', true);

            expect(supabase.from).toHaveBeenCalledWith('profiles');
            expect(builder.update).toHaveBeenCalledWith({ can_view_qr_pay: true });
            expect(builder.eq).toHaveBeenCalledWith('id', 'profile-1');
        });
    });
});
