const { performance } = require('perf_hooks');

class ConcurrencyController {
    constructor(limit) {
        this.limit = limit;
        this.running = 0;
        this.queue = [];
    }
    async acquire() {
        if (this.running >= this.limit) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.running++;
    }
    release() {
        this.running--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        }
    }
}

const networkConcurrency = new ConcurrencyController(6);
const DB_LATENCY = 30;

async function mockFetch(ms, concurrencyController) {
    await concurrencyController.acquire();
    return new Promise(resolve => {
        setTimeout(() => {
            concurrencyController.release();
            resolve();
        }, ms);
    });
}

async function simulateOriginal(uniqueMessages) {
    const start = performance.now();
    const recentMsgs = await Promise.all(uniqueMessages.map(async (msg) => {
        // Simulating the N queries for profiles
        await mockFetch(DB_LATENCY, networkConcurrency);
        const sender = { full_name: 'Client Name' };
        return {
            id: msg.id,
            content: msg.content,
            media_type: msg.media_type,
            created_at: msg.created_at,
            sender_name: sender?.full_name || 'Client',
            conversation_id: msg.conversation_id
        };
    }));
    const end = performance.now();
    return end - start;
}

async function simulateOptimized(uniqueMessages) {
    const start = performance.now();
    const senderIds = [...new Set(uniqueMessages.map(msg => msg.sender_id))];

    // Simulating 1 query for all profiles
    await mockFetch(DB_LATENCY + 10, networkConcurrency);
    const senderMap = new Map();
    for (const id of senderIds) {
        senderMap.set(id, { full_name: 'Client Name' });
    }

    const recentMsgs = uniqueMessages.map((msg) => {
        const sender = senderMap.get(msg.sender_id);
        return {
            id: msg.id,
            content: msg.content,
            media_type: msg.media_type,
            created_at: msg.created_at,
            sender_name: sender?.full_name || 'Client',
            conversation_id: msg.conversation_id
        };
    });
    const end = performance.now();
    return end - start;
}

async function runBenchmark() {
    // 3 unique messages as per the slice(0, 3) in the code
    // Let's test with 3 messages first, and maybe a case where they don't slice or slice is larger just to show scaling
    const uniqueMessages = Array.from({ length: 3 }, (_, i) => ({
        id: `msg_${i}`,
        content: `Hello ${i}`,
        media_type: 'text',
        created_at: new Date().toISOString(),
        sender_id: `sender_${i}`,
        conversation_id: `conv_${i}`
    }));

    const origTime = await simulateOriginal(uniqueMessages);
    console.log(`Original Time (3 messages): ${origTime.toFixed(2)} ms`);

    const optTime = await simulateOptimized(uniqueMessages);
    console.log(`Optimized Time (3 messages): ${optTime.toFixed(2)} ms`);

    console.log(`Improvement: ${((origTime - optTime) / origTime * 100).toFixed(2)}%`);

    // Let's also do a scenario where there might be 10 messages (e.g. if they increase the limit later)
    const uniqueMessages10 = Array.from({ length: 10 }, (_, i) => ({
        id: `msg_${i}`,
        content: `Hello ${i}`,
        media_type: 'text',
        created_at: new Date().toISOString(),
        sender_id: `sender_${i}`,
        conversation_id: `conv_${i}`
    }));

    const origTime10 = await simulateOriginal(uniqueMessages10);
    console.log(`\nOriginal Time (10 messages): ${origTime10.toFixed(2)} ms`);

    const optTime10 = await simulateOptimized(uniqueMessages10);
    console.log(`Optimized Time (10 messages): ${optTime10.toFixed(2)} ms`);

    console.log(`Improvement: ${((origTime10 - optTime10) / origTime10 * 100).toFixed(2)}%`);
}

runBenchmark();
