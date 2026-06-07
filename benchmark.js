const TEST_ACCOUNTS = [
    { email: 'test@gmail.com' },
    { email: 'testclient@gmail.com' },
    { email: 'daxyburn@gmail.com' },
];

const mockDelay = 50; // ms

const AsyncStorage = {
    getItem: async (key) => {
        return new Promise(resolve => setTimeout(() => resolve('password'), mockDelay));
    }
};

const passwordKey = (email) => `key:${email}`;

async function runSerial() {
    const start = Date.now();
    const next = {};
    for (const a of TEST_ACCOUNTS) {
        const pw = await AsyncStorage.getItem(passwordKey(a.email));
        if (pw) next[a.email.toLowerCase()] = pw;
    }
    const end = Date.now();
    return end - start;
}

async function runParallel() {
    const start = Date.now();
    const next = {};

    const results = await Promise.all(
        TEST_ACCOUNTS.map(async (a) => {
            const pw = await AsyncStorage.getItem(passwordKey(a.email));
            return { email: a.email.toLowerCase(), pw };
        })
    );

    for (const res of results) {
        if (res.pw) next[res.email] = res.pw;
    }

    const end = Date.now();
    return end - start;
}

async function main() {
    const serialTime = await runSerial();
    const parallelTime = await runParallel();
    console.log(`Serial: ${serialTime}ms`);
    console.log(`Parallel: ${parallelTime}ms`);
    console.log(`Improvement: ${serialTime - parallelTime}ms (${((serialTime - parallelTime) / serialTime * 100).toFixed(2)}%)`);
}

main();
