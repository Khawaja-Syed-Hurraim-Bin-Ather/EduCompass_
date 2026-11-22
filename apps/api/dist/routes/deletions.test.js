"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const deletions_1 = require("./deletions");
// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockLiveTableUpdate = vitest_1.vi.fn().mockReturnValue({
    eq: vitest_1.vi.fn().mockResolvedValue({ error: null }),
});
const mockDeletionScheduleInsert = vitest_1.vi.fn();
const mockDeletionScheduleSelect = vitest_1.vi.fn();
const mockDeletionScheduleUpdate = vitest_1.vi.fn().mockReturnValue({
    eq: vitest_1.vi.fn().mockResolvedValue({ error: null }),
});
const mockRpcPurge = vitest_1.vi.fn();
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn((table) => {
            if (table === 'deletion_schedule') {
                const queryBuilder = {
                    eq: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                    gte: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                    order: vitest_1.vi.fn().mockReturnValue({
                        range: mockDeletionScheduleSelect,
                    }),
                    single: mockDeletionScheduleSelect,
                };
                return {
                    select: vitest_1.vi.fn().mockReturnValue(queryBuilder),
                    insert: mockDeletionScheduleInsert,
                    update: mockDeletionScheduleUpdate,
                };
            }
            if (table === 'audit_log') {
                return {
                    insert: vitest_1.vi.fn().mockResolvedValue({ error: null }),
                };
            }
            // Any live table being soft-deleted or restored
            return {
                update: mockLiveTableUpdate,
                delete: vitest_1.vi.fn().mockReturnValue({
                    eq: vitest_1.vi.fn().mockResolvedValue({ error: null }),
                }),
                select: vitest_1.vi.fn().mockReturnValue({
                    eq: vitest_1.vi.fn().mockReturnValue({
                        single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'rec-1', name: 'Dr. John' }, error: null }),
                    }),
                }),
            };
        }),
        rpc: vitest_1.vi.fn((name, args) => mockRpcPurge(name, args)),
    },
}));
vitest_1.vi.mock('../middleware/admin-auth', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        requireAdminAuth: (req, _res, next) => {
            if (!req.adminUser) {
                req.adminUser = {
                    adminId: 'chair-cis',
                    email: 'chairman.cis@nedut.edu.pk',
                    role: 'chairman',
                    departmentId: 'dept-cis',
                    allowedModules: [],
                };
            }
            next();
        },
        requireStepUp: (req, res, next) => {
            if (req.headers['x-admin-step-up-token'] === 'valid-step-up-token') {
                return next();
            }
            res.status(403).json({ error: { code: 'STEP_UP_REQUIRED', message: 'Step-up required' } });
        },
    };
});
function createMockReqRes(options) {
    const defaultAdminUser = {
        adminId: 'chair-cis',
        email: 'chairman.cis@nedut.edu.pk',
        role: 'chairman',
        departmentId: 'dept-cis',
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
    const layer = deletions_1.deletionsRouter.stack.find((l) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]);
    if (!layer || !layer.route)
        return undefined;
    const handlers = layer.route.stack;
    return handlers[handlers.length - 1]?.handle;
}
// ── Tests ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Deletion Lifecycle & Cooling-Off (Card A10, Section 5, Section 14 Test 4)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('1. Cooling-Off Duration Logic (Section 5)', () => {
        (0, vitest_1.it)('applies 7 days for career and chatbot content', () => {
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('career')).toBe(7);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('chatbot_content')).toBe(7);
        });
        (0, vitest_1.it)('applies 14 days for fyp and professors', () => {
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('fyp')).toBe(14);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('professors')).toBe(14);
        });
        (0, vitest_1.it)('applies 30 days for curriculum and 90 days for curriculum versions', () => {
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('curriculum')).toBe(30);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('curriculum_version')).toBe(90);
        });
    });
    (0, vitest_1.describe)('2. Soft Deletion Scheduling', () => {
        (0, vitest_1.it)('schedules a soft deletion and immediately hides the item by setting deleted_at', async () => {
            mockDeletionScheduleInsert.mockReturnValueOnce({
                select: vitest_1.vi.fn().mockReturnValueOnce({
                    single: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            id: 'del-1',
                            table_name: 'professors',
                            record_id: '123e4567-e89b-12d3-a456-426614174000',
                            state: 'cooling_off',
                            cooling_off_days: 14,
                        },
                        error: null,
                    }),
                }),
            });
            const { req, res } = createMockReqRes({
                method: 'POST',
                body: {
                    tableName: 'professors',
                    recordId: '123e4567-e89b-12d3-a456-426614174000',
                    resource: 'professors',
                    reason: 'Faculty member retired from university',
                },
            });
            const handler = getRouteHandler('/', 'post');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(201);
            (0, vitest_1.expect)(res.getData().deletion).toBeDefined();
            // Golden Rule: soft delete hides the item from students immediately
            (0, vitest_1.expect)(mockLiveTableUpdate).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ deleted_at: vitest_1.expect.any(String) }));
        });
    });
    (0, vitest_1.describe)('3. Restoration Before Purge', () => {
        (0, vitest_1.it)('restores a soft-deleted item by clearing deleted_at and marking state as restored', async () => {
            mockDeletionScheduleSelect.mockResolvedValueOnce({
                data: {
                    id: 'del-1',
                    table_name: 'professors',
                    record_id: '123e4567-e89b-12d3-a456-426614174000',
                    state: 'cooling_off',
                    department_id: 'dept-cis',
                },
                error: null,
            });
            const { req, res } = createMockReqRes({
                method: 'POST',
                params: { id: 'del-1' },
            });
            const handler = getRouteHandler('/:id/restore', 'post');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().restored).toBe(true);
            // Verifies deleted_at was set back to null
            (0, vitest_1.expect)(mockLiveTableUpdate).toHaveBeenCalledWith({ deleted_at: null });
            (0, vitest_1.expect)(mockDeletionScheduleUpdate).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ state: 'restored' }));
        });
    });
    (0, vitest_1.describe)('4. Final Purge Constraints (VC only, step-up, cooling-off elapsed, daily cap)', () => {
        (0, vitest_1.it)('rejects purge if cooling-off period has not elapsed', async () => {
            const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days left
            mockDeletionScheduleSelect.mockResolvedValueOnce({
                data: {
                    id: 'del-1',
                    table_name: 'professors',
                    record_id: '123e4567-e89b-12d3-a456-426614174000',
                    state: 'cooling_off',
                    cooling_off_until: futureDate,
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
                params: { id: 'del-1' },
                headers: { 'x-admin-step-up-token': 'valid-step-up-token' },
            });
            const layer = deletions_1.deletionsRouter.stack.find((l) => l.route?.path === '/:id/purge' && l.route?.methods?.post);
            const routeHandler = layer.route.stack[1].handle;
            await routeHandler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(400);
            (0, vitest_1.expect)(res.getData().error.code).toBe('COOLING_OFF_NOT_ELAPSED');
        });
        (0, vitest_1.it)('rejects purge if attempted by non-VC role', async () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // already elapsed
            mockDeletionScheduleSelect.mockResolvedValueOnce({
                data: {
                    id: 'del-1',
                    table_name: 'professors',
                    record_id: '123e4567-e89b-12d3-a456-426614174000',
                    state: 'cooling_off',
                    cooling_off_until: pastDate,
                },
                error: null,
            });
            const chairmanSession = {
                adminId: 'chair-1',
                email: 'chairman.cis@nedut.edu.pk',
                role: 'chairman',
                departmentId: 'dept-cis',
                allowedModules: [],
            };
            const { req, res } = createMockReqRes({
                adminUser: chairmanSession,
                method: 'POST',
                params: { id: 'del-1' },
                headers: { 'x-admin-step-up-token': 'valid-step-up-token' },
            });
            const layer = deletions_1.deletionsRouter.stack.find((l) => l.route?.path === '/:id/purge' && l.route?.methods?.post);
            const routeHandler = layer.route.stack[1].handle;
            await routeHandler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(403);
            (0, vitest_1.expect)(res.getData().error.code).toBe('FORBIDDEN');
        });
        (0, vitest_1.it)('executes purge when cooling-off has elapsed and caller is VC with step-up', async () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            mockDeletionScheduleSelect.mockResolvedValueOnce({
                data: {
                    id: 'del-1',
                    table_name: 'professors',
                    record_id: '123e4567-e89b-12d3-a456-426614174000',
                    state: 'cooling_off',
                    cooling_off_until: pastDate,
                    department_id: 'dept-cis',
                    resource: 'professors',
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
                params: { id: 'del-1' },
                headers: { 'x-admin-step-up-token': 'valid-step-up-token' },
            });
            const layer = deletions_1.deletionsRouter.stack.find((l) => l.route?.path === '/:id/purge' && l.route?.methods?.post);
            const routeHandler = layer.route.stack[1].handle;
            await routeHandler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().purged).toBe(true);
            (0, vitest_1.expect)(mockDeletionScheduleUpdate).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ state: 'purged' }));
        });
    });
});
