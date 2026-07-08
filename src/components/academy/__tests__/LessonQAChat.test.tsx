import { sendPushNotification } from '../LessonQAChat';
import { supabase } from '../../../lib/supabase';

// Mock supabase invoke
jest.mock('../../../lib/supabase', () => ({
    supabase: {
        functions: {
            invoke: jest.fn(),
        },
    },
}));

describe('LessonQAChat sendPushNotification', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('sends push notification successfully', async () => {
        (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: 'success', error: null });

        await sendPushNotification('token123', 'Test Title', 'Test Body', { key: 'value' });

        expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
            body: {
                to: 'token123',
                sound: 'default',
                title: 'Test Title',
                body: 'Test Body',
                data: { key: 'value' },
                channelId: 'messages',
            }
        });
    });

    it('catches and logs error when sendPushNotification fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockError = new Error('Function invocation failed');

        (supabase.functions.invoke as jest.Mock).mockRejectedValueOnce(mockError);

        await sendPushNotification('token123', 'Test Title', 'Test Body', { key: 'value' });

        expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
            body: {
                to: 'token123',
                sound: 'default',
                title: 'Test Title',
                body: 'Test Body',
                data: { key: 'value' },
                channelId: 'messages',
            }
        });

        expect(consoleSpy).toHaveBeenCalledWith('Push notification send error:', mockError);

        consoleSpy.mockRestore();
    });
});
