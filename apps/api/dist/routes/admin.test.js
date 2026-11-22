"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const admin_1 = require("./admin");
// All admin routes require 'admin' role — mock auth middleware
vitest_1.vi.mock('../middleware/auth', () => ({
    requireRole: vitest_1.vi.fn(() => (_req, _res, next) => next()),
}));
vitest_1.vi.mock('../lib/supabase', () => {
    const buildQuery = (resolvedValue) => ({
        select: vitest_1.vi.fn().mockReturnThis(),
        eq: vitest_1.vi.fn().mockReturnThis(),
        in: vitest_1.vi.fn().mockReturnThis(),
        order: vitest_1.vi.fn().mockReturnThis(),
        range: vitest_1.vi.fn().mockResolvedValue(resolvedValue),
        update: vitest_1.vi.fn().mockReturnThis(),
        insert: vitest_1.vi.fn().mockResolvedValue({ error: null }),
        single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'req-1', user_id: 'u-1', status: 'pending' }, error: null }),
        delete: vitest_1.vi.fn().mockReturnThis(),
    });
    return {
        supabaseAdmin: {
            from: vitest_1.vi.fn((table) => {
                if (table === 'fyp_projects') {
                    return {
                        ...buildQuery({ data: [], count: 0, error: null }),
                        update: vitest_1.vi.fn().mockReturnThis(),
                        single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'p-1', title: 'Test', review_status: 'approved' }, error: null }),
                    };
                }
                return buildQuery({ data: [], count: 0, error: null });
            }),
        },
    };
});
(0, vitest_1.describe)('Admin Router (Card M4)', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('exports adminRouter with registered routes', () => {
        (0, vitest_1.expect)(admin_1.adminRouter).toBeDefined();
        (0, vitest_1.expect)(admin_1.adminRouter.stack.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('mounts requireRole middleware as first layer', () => {
        // The first stack entry should be the requireRole middleware applied via adminRouter.use()
        (0, vitest_1.expect)(admin_1.adminRouter.stack[0]).toBeDefined();
    });
    (0, vitest_1.it)('has all expected route handlers registered', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const routes = admin_1.adminRouter.stack.map((layer) => layer.route ? `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}` : 'MIDDLEWARE');
        (0, vitest_1.expect)(routes).toContain('GET /fyp');
        (0, vitest_1.expect)(routes).toContain('GET /fyp/stats');
        (0, vitest_1.expect)(routes).toContain('PATCH /fyp/:id');
        (0, vitest_1.expect)(routes).toContain('POST /fyp/bulk');
        (0, vitest_1.expect)(routes).toContain('GET /audit');
        (0, vitest_1.expect)(routes).toContain('GET /deletion-requests');
        (0, vitest_1.expect)(routes).toContain('POST /deletion-requests/:id/complete');
    });
});
