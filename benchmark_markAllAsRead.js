const { performance } = require('perf_hooks');

const generateMessages = (num) => {
    return Array.from({ length: num }).map((_, i) => ({
        id: `msg-${i}`,
        type: 'message',
        read: false
    }));
};

// Mock supabase
const supabaseMock = {
    from: (table) => ({
        update: (data) => ({
            eq: async (field, id) => {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 5));
            },
            in: async (field, ids) => {
                // Simulate network delay (batch is faster than N single calls)
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        })
    })
};

const runBenchmark = async () => {
    console.log('Running benchmark...');
    const numMessages = 100;
    const notifications = generateMessages(numMessages);

    // N+1 implementation
    const startN1 = performance.now();
    const unreadMessages = notifications.filter(n => n.type === 'message' && !n.read);
    for (const n of unreadMessages) {
        try {
            const msgId = n.id.replace('msg-', '');
            await supabaseMock.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msgId);
        } catch (e) { /* Ignore */ }
    }
    const endN1 = performance.now();
    console.log(`N+1 execution time (${numMessages} messages): ${(endN1 - startN1).toFixed(2)} ms`);

    // Batch implementation
    const startBatch = performance.now();
    const unreadMessagesBatch = notifications.filter(n => n.type === 'message' && !n.read);
    if (unreadMessagesBatch.length > 0) {
        try {
            const messageIds = unreadMessagesBatch.map(n => n.id.replace('msg-', ''));
            await supabaseMock.from('messages').update({ read_at: new Date().toISOString() }).in('id', messageIds);
        } catch (e) { /* Ignore */ }
    }
    const endBatch = performance.now();
    console.log(`Batched execution time (${numMessages} messages): ${(endBatch - startBatch).toFixed(2)} ms`);
};

runBenchmark();
