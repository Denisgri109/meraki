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

async function simulateOriginal() {
    const start = performance.now();
    await mockFetch(DB_LATENCY, networkConcurrency);
    await mockFetch(DB_LATENCY, networkConcurrency);
    const end = performance.now();
    return end - start;
}

async function simulateOptimized() {
    const start = performance.now();
    await Promise.all([
        mockFetch(DB_LATENCY, networkConcurrency),
        mockFetch(DB_LATENCY, networkConcurrency)
    ]);
    const end = performance.now();
    return end - start;
}

async function runBenchmark() {
    let origTotal = 0;
    let optTotal = 0;
    const runs = 10;

    for (let i = 0; i < runs; i++) {
        origTotal += await simulateOriginal();
        optTotal += await simulateOptimized();
    }

    const origAvg = origTotal / runs;
    const optAvg = optTotal / runs;

    console.log(`Original Time (avg): ${origAvg.toFixed(2)} ms`);
    console.log(`Optimized Time (avg): ${optAvg.toFixed(2)} ms`);
    console.log(`Improvement: ${((origAvg - optAvg) / origAvg * 100).toFixed(2)}%`);
}

runBenchmark();
