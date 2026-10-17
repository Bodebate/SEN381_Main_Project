// Operation: GET /api/requests as a manager, i.e. the staff/manager request queue. It is the
// most frequently loaded screen, it reads and maps every visible request, and it gets slower
// as the number of requests grows, so it is where load shows first.
//
// What it does:
//   1. starts its own test API on port 3200 (in-memory MongoDB, demo accounts; never Atlas)
//   2. seeds SEED_REQUESTS requests as "requester"
//   3. signs in as "manager" and runs autocannon against GET /api/requests
//   4. writes the results (environment, workload, latency, throughput, errors, verdict) to
//      perf/results/<timestamp>.md and .json as evidence
//
// Usage: npm run perf     (optional: PERF_CONNECTIONS=20 PERF_DURATION=30 SEED_REQUESTS=200)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const autocannon = require('autocannon');

const PORT = 3200;
const BASE = `http://localhost:${PORT}/api`;
const CONNECTIONS = Number(process.env.PERF_CONNECTIONS || 20);
const DURATION = Number(process.env.PERF_DURATION || 30);
const SEED_REQUESTS = Number(process.env.SEED_REQUESTS || 200);
// Target: 95th-percentile response under 500 ms for the queue at this workload.
const TARGET_P97_5_MS = Number(process.env.PERF_TARGET_MS || 500);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForHealth(timeoutMs = 180000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up yet */ }
        await sleep(500);
    }
    throw new Error('Test API did not start in time');
}

async function login(username) {
    const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'demo' }),
    });
    if (!res.ok) throw new Error(`Login as ${username} failed: ${res.status}`);
    return (await res.json()).token;
}

async function seedRequests(token) {
    for (let i = 1; i <= SEED_REQUESTS; i++) {
        const res = await fetch(`${BASE}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                title: `Load test request ${i}`, details: 'Seeded for the M3 load exercise.',
                address: `${i} Test Street`, contact: { email: null, phone: null },
            }),
        });
        if (res.status !== 201) throw new Error(`Seeding request ${i} failed: ${res.status}`);
    }
}

(async () => {
    const api = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'start-test-api.js')], {
        env: { ...process.env, E2E_API_PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'inherit'],
    });
    const stopApi = () => { if (!api.killed) api.kill('SIGTERM'); };
    process.on('exit', stopApi);

    try {
        console.log('Starting test API (first run downloads MongoDB)...');
        await waitForHealth();
        console.log(`Seeding ${SEED_REQUESTS} requests...`);
        await seedRequests(await login('requester'));
        const managerToken = await login('manager');

        // Sanity check before measuring: the queue really returns the seeded data
        const check = await fetch(`${BASE}/requests`, { headers: { Authorization: `Bearer ${managerToken}` } });
        const listed = (await check.json()).length;
        console.log(`Queue returns ${listed} requests. Running ${CONNECTIONS} connections for ${DURATION}s...`);

        const r = await autocannon({
            url: `${BASE}/requests`,
            connections: CONNECTIONS,
            duration: DURATION,
            headers: { Authorization: `Bearer ${managerToken}` },
        });

        const total = r.requests.total;
        const failed = r.non2xx + r.errors + r.timeouts;
        const verdict = r.latency.p97_5 <= TARGET_P97_5_MS && failed === 0 ? 'PASS' : 'FAIL';
        const result = {
            date: new Date().toISOString(),
            operation: 'GET /api/requests (manager queue)',
            environment: {
                node: process.version, os: `${os.type()} ${os.release()} (${os.arch()})`,
                cpu: `${os.cpus()[0]?.model} x${os.cpus().length}`,
                memoryGb: Math.round(os.totalmem() / 1e9),
                database: 'mongodb-memory-server on the same machine (no network latency to Atlas)',
            },
            workload: { connections: CONNECTIONS, durationSeconds: DURATION, requestsInDatabase: listed },
            latencyMs: { average: r.latency.average, p50: r.latency.p50, p90: r.latency.p90,
                p97_5: r.latency.p97_5, p99: r.latency.p99, max: r.latency.max },
            throughput: { requestsPerSecondAvg: r.requests.average, totalRequests: total },
            failures: { non2xx: r.non2xx, errors: r.errors, timeouts: r.timeouts },
            target: `p97.5 <= ${TARGET_P97_5_MS} ms and no failed requests`,
            verdict,
        };

        const stamp = result.date.replace(/[:.]/g, '-');
        const outDir = path.join(__dirname, 'results');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, `${stamp}.json`), JSON.stringify(result, null, 2));
        fs.writeFileSync(path.join(outDir, `${stamp}.md`), [
            `# Load test: ${result.operation}`,
            '',
            `Date: ${result.date}  `,
            `Verdict: **${verdict}** (target: ${result.target})`,
            '',
            '| Measure | Value |',
            '| --- | --- |',
            `| Workload | ${CONNECTIONS} concurrent connections for ${DURATION} s, ${listed} requests in the database |`,
            `| Latency p50 / p90 / p97.5 / p99 / max | ${r.latency.p50} / ${r.latency.p90} / ${r.latency.p97_5} / ${r.latency.p99} / ${r.latency.max} ms |`,
            `| Throughput | ${r.requests.average} requests/s average, ${total} requests in total |`,
            `| Failures | ${r.non2xx} non-2xx, ${r.errors} errors, ${r.timeouts} timeouts |`,
            `| Environment | ${result.environment.os}, ${result.environment.cpu}, ${result.environment.memoryGb} GB, Node ${process.version} |`,
            `| Database | ${result.environment.database} |`,
            '',
            '## What this does not prove',
            '',
            '- Production scale: one machine, one API process, a small dataset and no real municipal traffic pattern.',
            '- Atlas behaviour: the in-memory database removes network latency; the deployed system will be slower.',
            '- Other operations: only the queue read was measured (no writes, dashboard or export).',
            '- Growth: the queue returns every visible request without paging, so latency will rise with data volume.',
            '',
        ].join('\n'));

        console.log(`\n${verdict}: p50 ${r.latency.p50} ms, p97.5 ${r.latency.p97_5} ms, p99 ${r.latency.p99} ms, ` +
            `${r.requests.average} req/s, failures ${failed}`);
        console.log(`Results written to perf/results/${stamp}.md`);
        stopApi();
        process.exit(0);
    } catch (err) {
        console.error(err);
        stopApi();
        process.exit(1);
    }
})();
