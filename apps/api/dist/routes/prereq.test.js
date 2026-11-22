"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prereq_1 = require("./prereq");
(0, vitest_1.describe)('Prerequisite API Router (Card H1, Rules #7, #8, #13, #15)', () => {
    (0, vitest_1.it)('registers all required prerequisite endpoints', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const routes = prereq_1.prereqRouter.stack.map((layer) => layer.route ? `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}` : '').filter(Boolean);
        (0, vitest_1.expect)(routes).toContain('GET /graph');
        (0, vitest_1.expect)(routes).toContain('POST /evaluate');
        (0, vitest_1.expect)(routes).toContain('POST /simulate-failure');
        (0, vitest_1.expect)(routes).toContain('GET /importance/:code');
        (0, vitest_1.expect)(routes).toContain('GET /critical-path');
    });
    (0, vitest_1.it)('GET /graph returns curriculum with verified acyclic DAG', async () => {
        let jsonBody = null;
        const mockReq = {};
        const mockRes = {
            json: (body) => {
                jsonBody = body;
            },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = prereq_1.prereqRouter.stack.find((l) => l.route?.path === '/graph')?.route?.stack?.[0]?.handle;
        await handler(mockReq, mockRes);
        (0, vitest_1.expect)(jsonBody.data.isValidDAG).toBe(true);
        (0, vitest_1.expect)(jsonBody.data.courses.length).toBeGreaterThan(30);
        (0, vitest_1.expect)(jsonBody.data.disclaimer).toBe('Guidance estimates, not official university decisions.');
    });
    (0, vitest_1.it)('POST /evaluate returns course eligibility based on completed prerequisites', async () => {
        let jsonBody = null;
        const mockReq = {
            body: {
                completedCourses: [
                    { code: 'CS-115', grade: 'A', creditHours: 4 },
                    { code: 'CS-116', grade: 'B', creditHours: 4 },
                ],
                currentSemester: 3,
            },
        };
        const mockRes = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: (body) => {
                jsonBody = body;
            },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = prereq_1.prereqRouter.stack.find((l) => l.route?.path === '/evaluate')?.route?.stack?.[0]?.handle;
        await handler(mockReq, mockRes);
        (0, vitest_1.expect)(jsonBody.data.evaluations).toBeDefined();
        // CS-218 requires CS-116 which is completed -> eligible
        const cs218 = jsonBody.data.evaluations.find((e) => e.code === 'CS-218');
        (0, vitest_1.expect)(cs218.isEligible).toBe(true);
        // CS-115 is already completed
        const cs115 = jsonBody.data.evaluations.find((e) => e.code === 'CS-115');
        (0, vitest_1.expect)(cs115.isCompleted).toBe(true);
    });
    (0, vitest_1.it)('POST /simulate-failure returns in-memory simulation cascade (Rule #8)', async () => {
        let jsonBody = null;
        const mockReq = {
            body: {
                failedCourseCodes: ['CS-115'],
                completedCourses: [],
                currentSemester: 1,
            },
        };
        const mockRes = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: (body) => {
                jsonBody = body;
            },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = prereq_1.prereqRouter.stack.find((l) => l.route?.path === '/simulate-failure')?.route?.stack?.[0]?.handle;
        await handler(mockReq, mockRes);
        (0, vitest_1.expect)(jsonBody.data.simulationResults).toHaveLength(1);
        const sim = jsonBody.data.simulationResults[0];
        (0, vitest_1.expect)(sim.simulationLabel).toBe('Simulation (in-memory estimate)');
        (0, vitest_1.expect)(sim.blockedDirectly).toContain('CS-116');
        (0, vitest_1.expect)(sim.blockedDownstreamCascade).toContain('CS-218');
        (0, vitest_1.expect)(sim.delayedCredits).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('GET /importance/:code returns score with breakdown labeled as Estimate (Rule #7)', async () => {
        let jsonBody = null;
        const mockReq = {
            params: { code: 'CS-115' },
        };
        const mockRes = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: (body) => {
                jsonBody = body;
            },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = prereq_1.prereqRouter.stack.find((l) => l.route?.path === '/importance/:code')?.route?.stack?.[0]?.handle;
        await handler(mockReq, mockRes);
        (0, vitest_1.expect)(jsonBody.data.code).toBe('CS-115');
        (0, vitest_1.expect)(jsonBody.data.label).toBe('Estimate');
        (0, vitest_1.expect)(jsonBody.data.breakdown.directUnlocks).toBeDefined();
        (0, vitest_1.expect)(jsonBody.data.breakdown.downstreamReach).toBeDefined();
        (0, vitest_1.expect)(jsonBody.data.breakdown.creditWeight).toBeDefined();
        (0, vitest_1.expect)(jsonBody.data.breakdown.earlinessWeight).toBeDefined();
    });
});
