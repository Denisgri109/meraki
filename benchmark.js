const { performance } = require('perf_hooks');

async function mockSafeSupabaseFetch(promise, options) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    return promise;
}

const mockMessages = Array(10).fill(0).map((_, i) => ({ sender_id: `user-${i % 3}`, id: i }));

async function beforeOptimization() {
    const senderIds = Array.from(new Set(mockMessages.map(m => m.sender_id)));
    // Simulate Supabase fetch
    const promise = { data: senderIds.map(id => ({ id, full_name: `Name ${id}` })) };
    const { data: sendersData } = await mockSafeSupabaseFetch(promise, { timeout: 3000 });
    const sendersMap = new Map((sendersData || []).map(sender => [sender.id, sender]));
    return sendersMap.size;
}

const senderProfileCache = new Map();
async function afterOptimization() {
    const senderIds = Array.from(new Set(mockMessages.map(m => m.sender_id)));
    const uncachedSenderIds = senderIds.filter(id => !senderProfileCache.has(id));

    if (uncachedSenderIds.length > 0) {
        // Simulate Supabase fetch
        const promise = { data: uncachedSenderIds.map(id => ({ id, full_name: `Name ${id}` })) };
        const { data: sendersData } = await mockSafeSupabaseFetch(promise, { timeout: 3000 });
        (sendersData || []).forEach(sender => senderProfileCache.set(sender.id, sender));
    }
    return senderProfileCache.size;
}

async function runBenchmark() {
    console.log('--- Baseline: Unoptimized ---');
    let start = performance.now();
    for (let i = 0; i < 5; i++) await beforeOptimization();
    console.log(`Unoptimized Time: ${(performance.now() - start).toFixed(2)}ms`);

    console.log('\n--- Optimized: Client Cache ---');
    senderProfileCache.clear();
    start = performance.now();
    for (let i = 0; i < 5; i++) await afterOptimization();
    console.log(`Optimized Time: ${(performance.now() - start).toFixed(2)}ms`);
}

runBenchmark();
