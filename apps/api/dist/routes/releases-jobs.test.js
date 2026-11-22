"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const releases_jobs_1 = require("./releases-jobs");
// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockReleaseSingle = vitest_1.vi.fn();
const mockReleasesSelect = vitest_1.vi.fn();
const mockJobsSelect = vitest_1.vi.fn();
const mockJobSingle = vitest_1.vi.fn();
const mockJobUpdate = vitest_1.vi.fn().mockReturnValue({
    eq: vitest_1.vi.fn().mockResolvedValue({ error: null }),
});
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn((table) => {
            if (table === 'releases') {
                return {
                    select: vitest_1.vi.fn().mockReturnValue({
                        order: vitest_1.vi.fn().mockReturnValue({
                            range: mockReleasesSelect,
                        }),
                        eq: vitest_1.vi.fn().mockReturnValue({
                            single: mockReleaseSingle,
                        }),
                    }),
                    insert: vitest_1.vi.fn().mockReturnValue({
                        select: vitest_1.vi.fn().mockReturnValue({
                            single: vitest_1.vi.fn().mockResolvedValue({
                                data: { id: 'rel-rollback-1', tag: 'rollback-cis-v1', notes: 'Rollback to cis-v1' },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            if (table === 'publish_jobs') {
                const queryBuilder = {
                    eq: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                    order: vitest_1.vi.fn().mockReturnValue({
                        range: mockJobsSelect,
                    }),
                    single: mockJobSingle,
                };
                return {
                    select: vitest_1.vi.fn().mockReturnValue(queryBuilder),
                    insert: vitest_1.vi.fn().mockResolvedValue({ error: null }),
                    update: mockJobUpdate,
                };
            }
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                insert: vitest_1.vi.fn().mockResolvedValue({ error: null }),
            };
        }),
    },
}));
vitest_1.vi.mock('../middleware/admin-auth', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        requireAdminAuth: (req, _res, next) => {
            if (!req.adminUser) {
                req.adminUser = {
                    adminId: 'vc-1',
                    email: 'vc@nedut.edu.pk',
                    role: 'vc',
                    departmentId: null,
                    allowedModules: [],
                };
            }
            next();
        },
        requireStepUp: (req, res, next) => {
            // Step-up verification header check
            if (req.headers['x-admin-step-up-token'] === 'valid-step-up-token') {
                return next();
            }
            res.status(403).json({ error: { code: 'STEP_UP_REQUIRED', message: 'Step-up required' } });
        },
    };
});
function createMockReqRes(options) {
    const defaultAdminUser = {
        adminId: 'vc-1',
        email: 'vc@nedut.edu.pk',
        role: 'vc',
        departmentId: null,
        allowedModules: [],
    };
    const req = {
        method: options.method || 'GET',
        url: options.url || '/',
        headers: options.headers || {},
        params: options.params || {},
        query: options.query || {},
        body: options.body || {},
        adminUser: options.adminUser || defaultAdminUser,
    };
    let statusCode = 200;
    let responseData = null;
    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        json: (data) => {
            responseData = data;
            return res;
        },
        getStatusCode: () => statusCode,
        getData: () => responseData,
    };
    return { req, res };
}
function getRouteHandler(path, method) {
    const layer = releases_jobs_1.releasesJobsRouter.stack.find((l) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]);
    if (!layer || !layer.route)
        return undefined;
    const handlers = layer.route.stack;
    return handlers[handlers.length - 1]?.handle;
}
// ── Tests ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Releases & Publish Jobs Router (Card A9)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('1. Releases Listing & Inspection', () => {
        (0, vitest_1.it)('returns paginated releases for admin dashboard', async () => {
            mockReleasesSelect.mockResolvedValueOnce({
                data: [
                    { id: 'rel-1', tag: 'cis-scheme2022-r1', created_at: new Date().toISOString() },
                ],
                count: 1,
                error: null,
            });
            const { req, res } = createMockReqRes({
                query: { page: 1, pageSize: 25 },
            });
            const handler = getRouteHandler('/releases', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().data).toHaveLength(1);
        });
    });
    (0, vitest_1.describe)('2. Rollback Execution (Section 8 & Section 14 Test 6)', () => {
        (0, vitest_1.it)('blocks rollback if step-up verification is missing', async () => {
            const { req, res } = createMockReqRes({
                method: 'POST',
                params: { id: 'rel-1' },
                headers: {}, // no step-up token!
            });
            // The step-up check is a route middleware
            const layer = releases_jobs_1.releasesJobsRouter.stack.find((l) => l.route?.path === '/releases/:id/rollback' && l.route?.methods?.post);
            (0, vitest_1.expect)(layer).toBeDefined();
            const stepUpMiddleware = layer.route.stack[0].handle;
            let calledNext = false;
            await stepUpMiddleware(req, res, () => { calledNext = true; });
            (0, vitest_1.expect)(res.getStatusCode()).toBe(403);
            (0, vitest_1.expect)(calledNext).toBe(false);
        });
        (0, vitest_1.it)('executes rollback and enqueues cascade jobs 3-10 when VC presents valid step-up', async () => {
            mockReleaseSingle.mockResolvedValueOnce({
                data: {
                    id: 'rel-1',
                    tag: 'cis-scheme2022-r2',
                    department_id: 'dept-cis',
                    snapshot: { courses: ['CS-115'] },
                },
                error: null,
            });
            const vcSession = {
                adminId: 'vc-1',
                email: 'vc@nedut.edu.pk',
                role: 'vc',
                departmentId: null,
                allowedModules: [],
            };
            const { req, res } = createMockReqRes({
                adminUser: vcSession,
                method: 'POST',
                params: { id: 'rel-1' },
                headers: { 'x-admin-step-up-token': 'valid-step-up-token' },
                body: { reason: 'Emergency rollback due to prerequisite error' },
            });
            const layer = releases_jobs_1.releasesJobsRouter.stack.find((l) => l.route?.path === '/releases/:id/rollback' && l.route?.methods?.post);
            const routeHandler = layer.route.stack[1].handle;
            await routeHandler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().rollbackRelease).toBeDefined();
            (0, vitest_1.expect)(res.getData().enqueuedJobsCount).toBe(8); // steps 3 through 10
        });
    });
    (0, vitest_1.describe)('3. Jobs Queue Monitoring & Retries', () => {
        (0, vitest_1.it)('lists jobs in the cascade queue with status filter', async () => {
            mockJobsSelect.mockResolvedValueOnce({
                data: [
                    { id: 'j-1', release_id: 'rel-1', step: 'rebuild_graph', status: 'done' },
                    { id: 'j-2', release_id: 'rel-1', step: 'recompute_scores', status: 'queued' },
                ],
                count: 2,
                error: null,
            });
            const { req, res } = createMockReqRes({
                query: { page: 1, pageSize: 25 },
            });
            const handler = getRouteHandler('/jobs', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().data).toHaveLength(2);
        });
    });
});
