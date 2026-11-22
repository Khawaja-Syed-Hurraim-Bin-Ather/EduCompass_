"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const health_report_1 = require("./health-report");
// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSupabaseCount = vitest_1.vi.fn();
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn((table) => {
            const queryBuilder = {
                select: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                eq: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                is: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                or: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                then: (resolve) => resolve({ count: mockSupabaseCount(table) || 0, data: [], error: null }),
            };
            return queryBuilder;
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
                    adminId: 'chair-cis',
                    email: 'chairman.cis@nedut.edu.pk',
                    role: 'chairman',
                    departmentId: 'dept-cis',
                    allowedModules: [],
                };
            }
            next();
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
    const layer = health_report_1.healthReportRouter.stack.find((l) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]);
    if (!layer || !layer.route)
        return undefined;
    const handlers = layer.route.stack;
    return handlers[handlers.length - 1]?.handle;
}
// ── Tests ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Data Health & Audit Report (Card A11, Section 11)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('1. Health Metrics Calculation Logic', () => {
        (0, vitest_1.it)('reports healthy status when there are zero broken prereqs and minimal unreviewed items', () => {
            const report = (0, health_report_1.calculateDataHealth)({
                unreviewedFypCount: 2,
                coursesWithoutCredits: 0,
                coolingOffCount: 1,
                brokenPrereqCount: 0,
            });
            (0, vitest_1.expect)(report.overallStatus).toBe('healthy');
            (0, vitest_1.expect)(report.issues).toHaveLength(0);
        });
        (0, vitest_1.it)('flags warning status when broken prerequisites are detected', () => {
            const report = (0, health_report_1.calculateDataHealth)({
                unreviewedFypCount: 0,
                coursesWithoutCredits: 0,
                coolingOffCount: 0,
                brokenPrereqCount: 3,
            });
            (0, vitest_1.expect)(report.overallStatus).toBe('warning');
            (0, vitest_1.expect)(report.issues.some((i) => i.code === 'BROKEN_PREREQUISITES')).toBe(true);
        });
    });
    (0, vitest_1.describe)('2. Health Report Endpoint', () => {
        (0, vitest_1.it)('returns structured institutional data health metrics', async () => {
            mockSupabaseCount.mockImplementation((table) => {
                if (table === 'fyp_projects')
                    return 12; // 12 unreviewed
                if (table === 'course_master')
                    return 0;
                if (table === 'deletion_schedule')
                    return 3;
                return 0;
            });
            const { req, res } = createMockReqRes({});
            const handler = getRouteHandler('/report', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().metrics).toBeDefined();
            (0, vitest_1.expect)(res.getData().metrics.unreviewedFypCount).toBe(12);
            (0, vitest_1.expect)(res.getData().overallStatus).toBe('healthy');
        });
    });
});
