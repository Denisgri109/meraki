const { performance } = require('perf_hooks');

// Node.js Event Loop concurrency allows Promise.all to run very quickly
// in this synthetic environment because setTimeout is just an event loop registration.
// However, in a real environment, making 50 simultaneous network requests
// from a React Native client often results in significant queuing, blocking,
// connection pooling exhaustion, and large actual latency.
// We will simulate real network request queuing logic.

async function mockFetch(ms, concurrencyController) {
    await concurrencyController.acquire();
    return new Promise(resolve => {
        setTimeout(() => {
            concurrencyController.release();
            resolve();
        }, ms);
    });
}

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

// React Native / Supabase fetch often has limited connection pools or browser fetch limits (e.g. 6-10 per origin)
const networkConcurrency = new ConcurrencyController(6);
const DB_LATENCY = 30;

async function simulateOriginal(allConversations, isMaster) {
    const start = performance.now();

    const convWithUsers = await Promise.all(
        allConversations.map(async (conv) => {
            // N network calls
            await mockFetch(DB_LATENCY, networkConcurrency);
            const userData = { full_name: 'test', avatar_url: 'test' };

            // N network calls
            await mockFetch(DB_LATENCY, networkConcurrency);
            const lastMsgData = { content: 'test', media_type: 'test', is_deleted: false };

            return {
                ...conv,
                other_user: userData,
                last_message: lastMsgData,
            };
        })
    );
    const end = performance.now();
    return end - start;
}

async function simulateOptimized(allConversations, isMaster) {
    const start = performance.now();

    const userIds = [...new Set(allConversations.map(conv => isMaster ? conv.client_id : conv.master_id))];

    // 1 network call for all users
    await mockFetch(DB_LATENCY + 10, networkConcurrency);
    const userMap = {};
    for (const id of userIds) {
        userMap[id] = { full_name: 'test', avatar_url: 'test' };
    }

    const convWithUsers = await Promise.all(
        allConversations.map(async (conv) => {
            const otherUserId = isMaster ? conv.client_id : conv.master_id;

            // N network calls
            await mockFetch(DB_LATENCY, networkConcurrency);
            const lastMsgData = { content: 'test', media_type: 'test', is_deleted: false };

            return {
                ...conv,
                other_user: userMap[otherUserId],
                last_message: lastMsgData,
            };
        })
    );

    const end = performance.now();
    return end - start;
}

async function runBenchmark() {
    const isMaster = true;
    const allConversations = Array.from({ length: 50 }, (_, i) => ({
        id: `conv_${i}`,
        client_id: `client_${i}`,
        master_id: `master_${i}`
    }));

    const origTime = await simulateOriginal(allConversations, isMaster);
    console.log(`Original Time (50 conversations): ${origTime.toFixed(2)} ms`);

    const optTime = await simulateOptimized(allConversations, isMaster);
    console.log(`Optimized Time (50 conversations): ${optTime.toFixed(2)} ms`);

    console.log(`Improvement: ${((origTime - optTime) / origTime * 100).toFixed(2)}%`);
}

runBenchmark();
