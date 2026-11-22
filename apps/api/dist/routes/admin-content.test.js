"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const admin_content_1 = require("./admin-content");
// ── Supabase Mock Setup ───────────────────────────────────────────────────────
const mockChangeItemSingle = vitest_1.vi.fn().mockResolvedValue({
    data: { id: 'ci-1', change_set_id: 'cs-100', table_name: 'fyp_projects', record_id: 'fyp-1', op: 'update' },
    error: null,
});
const mockChangeItemInsert = vitest_1.vi.fn().mockReturnValue({
    select: vitest_1.vi.fn().mockReturnValue({
        single: mockChangeItemSingle,
    }),
});
const mockChangeSetSingle = vitest_1.vi.fn().mockResolvedValue({
    data: { id: 'cs-100', status: 'draft', impact: 'minor', created_by: 'op-1', department_id: 'dept-cis' },
    error: null,
});
const mockLiveUpdate = vitest_1.vi.fn();
const mockLiveInsert = vitest_1.vi.fn();
const mockLiveDelete = vitest_1.vi.fn();
const mockLiveFypSingle = vitest_1.vi.fn().mockResolvedValue({
    data: {
        id: 'fyp-1',
        title: 'Autonomous Navigation Robot',
        abstract: 'Vision-based SLAM robot',
        year: 2024,
        supervisor: 'Dr. Maria',
        domain_tags: ['Robotics', 'AI'],
        tools: ['ROS', 'Python'],
        proposal_outcome: 'accepted',
        review_status: 'published',
    },
    error: null,
});
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn((table) => {
            if (table === 'change_items') {
                return {
                    insert: mockChangeItemInsert,
                };
            }
            if (table === 'change_sets') {
                return {
                    insert: vitest_1.vi.fn().mockReturnValue({
                        select: vitest_1.vi.fn().mockReturnValue({
                            single: mockChangeSetSingle,
                        }),
                    }),
                    select: vitest_1.vi.fn().mockReturnValue({
                        eq: vitest_1.vi.fn().mockReturnValue({
                            single: mockChangeSetSingle,
                        }),
                        single: mockChangeSetSingle,
                    }),
                    update: vitest_1.vi.fn().mockReturnValue({
                        eq: vitest_1.vi.fn().mockResolvedValue({ error: null }),
                    }),
                };
            }
            if (table === 'fyp_projects') {
                const queryBuilder = {
                    eq: vitest_1.vi.fn().mockImplementation((_col, _val) => ({
                        ...queryBuilder,
                        single: mockLiveFypSingle,
                    })),
                    order: vitest_1.vi.fn().mockReturnThis(),
                    range: vitest_1.vi.fn().mockResolvedValue({
                        data: [
                            { id: 'fyp-1', title: 'Autonomous Navigation Robot', year: 2024, supervisor: 'Dr. Maria', review_status: 'extracted' }
                        ],
                        count: 1,
                        error: null,
                    }),
                    single: mockLiveFypSingle,
                };
                return {
                    select: vitest_1.vi.fn().mockReturnValue(queryBuilder),
                    update: mockLiveUpdate,
                    insert: mockLiveInsert,
                    delete: mockLiveDelete,
                };
            }
            if (table === 'professors') {
                const queryBuilder = {
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    order: vitest_1.vi.fn().mockReturnThis(),
                    range: vitest_1.vi.fn().mockResolvedValue({
                        data: [
                            { id: 'prof-1', name: 'Dr. Maria', designation: 'Associate Professor', department_id: 'dept-cis' }
                        ],
                        count: 1,
                        error: null,
                    }),
                };
                return {
                    select: vitest_1.vi.fn().mockReturnValue(queryBuilder),
                    update: mockLiveUpdate,
                    insert: mockLiveInsert,
                    delete: mockLiveDelete,
                };
            }
            const defaultBuilder = {
                eq: vitest_1.vi.fn().mockReturnThis(),
                order: vitest_1.vi.fn().mockReturnThis(),
                range: vitest_1.vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
            };
            return {
                select: vitest_1.vi.fn().mockReturnValue(defaultBuilder),
                update: mockLiveUpdate,
                insert: mockLiveInsert,
                delete: mockLiveDelete,
            };
        }),
    },
}));
// Mock admin auth middleware so we can control req.adminUser directly
vitest_1.vi.mock('../middleware/admin-auth', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        requireAdminAuth: (req, _res, next) => {
            // By default pass through; user is injected in tests
            if (!req.adminUser) {
                req.adminUser = {
                    adminId: 'op-1',
                    email: 'operator@nedut.edu.pk',
                    role: 'operator',
                    departmentId: 'dept-cis',
                    allowedModules: ['fyp'],
                };
            }
            next();
        },
    };
});
// ── Test Request/Response Helpers ─────────────────────────────────────────────
function createMockReqRes(options) {
    const req = {
        method: options.method || 'GET',
        url: options.url || '/',
        params: options.params || {},
        query: options.query || {},
        body: options.body || {},
        adminUser: options.adminUser,
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
    const layer = admin_content_1.adminContentRouter.stack.find((l) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]);
    if (!layer || !layer.route)
        return undefined;
    const handlers = layer.route.stack;
    return handlers[handlers.length - 1]?.handle;
}
// ── Test Suite ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Admin Content Modules Router (Card A7)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('1. Operator Module Access Control (Section 3 & admin_permissions.json)', () => {
        (0, vitest_1.it)('allows operator to read a module included in allowed_modules', async () => {
            const operator = {
                adminId: 'op-1',
                email: 'operator@nedut.edu.pk',
                role: 'operator',
                departmentId: 'dept-cis',
                allowedModules: ['fyp'],
            };
            const { req, res } = createMockReqRes({
                adminUser: operator,
                params: { module: 'fyp' },
                query: { page: 1, pageSize: 25 },
            });
            const handler = getRouteHandler('/:module', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().data).toHaveLength(1);
            (0, vitest_1.expect)(res.getData().meta.module).toBe('fyp');
        });
        (0, vitest_1.it)('rejects operator attempting to access a module NOT in allowed_modules with 403', async () => {
            const operator = {
                adminId: 'op-1',
                email: 'operator@nedut.edu.pk',
                role: 'operator',
                departmentId: 'dept-cis',
                allowedModules: ['fyp'], // only fyp!
            };
            const { req, res } = createMockReqRes({
                adminUser: operator,
                params: { module: 'professors' },
                query: { page: 1, pageSize: 25 },
            });
            const handler = getRouteHandler('/:module', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(403);
            (0, vitest_1.expect)(res.getData().error.code).toBe('FORBIDDEN');
            (0, vitest_1.expect)(res.getData().error.message).toContain('allowed_modules');
        });
        (0, vitest_1.it)('allows Chairman to access any module within their own department', async () => {
            const chairman = {
                adminId: 'chair-cis',
                email: 'chairman.cis@nedut.edu.pk',
                role: 'chairman',
                departmentId: 'dept-cis',
                allowedModules: [],
            };
            const { req, res } = createMockReqRes({
                adminUser: chairman,
                params: { module: 'professors' },
                query: { page: 1, pageSize: 25 },
            });
            const handler = getRouteHandler('/:module', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
        });
    });
    (0, vitest_1.describe)('2. Live Table Immutability & Draft Generation (Golden Rule 1)', () => {
        (0, vitest_1.it)('creates a change_item and draft change_set without touching live table on draft update', async () => {
            const operator = {
                adminId: 'op-1',
                email: 'operator@nedut.edu.pk',
                role: 'operator',
                departmentId: 'dept-cis',
                allowedModules: ['fyp'],
            };
            const { req, res } = createMockReqRes({
                adminUser: operator,
                method: 'POST',
                params: { module: 'fyp' },
                body: {
                    action: 'update',
                    targetTable: 'fyp_projects',
                    recordId: '123e4567-e89b-12d3-a456-426614174000',
                    title: 'Update FYP Abstract',
                    after: {
                        title: 'Autonomous Navigation Robot v2',
                        abstract: 'Updated SLAM algorithms for indoor quadrotors',
                    },
                },
            });
            const handler = getRouteHandler('/:module/draft', 'post');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(201);
            (0, vitest_1.expect)(res.getData().changeItem).toBeDefined();
            // Golden Rule 1: live fyp_projects table was NEVER updated directly!
            (0, vitest_1.expect)(mockLiveUpdate).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockLiveInsert).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockLiveDelete).not.toHaveBeenCalled();
            // change_items table received the draft item
            (0, vitest_1.expect)(mockChangeItemInsert).toHaveBeenCalledTimes(1);
        });
    });
    (0, vitest_1.describe)('3. Pagination & Privacy Safeguards (Section 12)', () => {
        (0, vitest_1.it)('enforces maximum pagination limit of 100', async () => {
            const chairman = {
                adminId: 'chair-cis',
                email: 'chairman.cis@nedut.edu.pk',
                role: 'chairman',
                departmentId: 'dept-cis',
                allowedModules: [],
            };
            const { req, res } = createMockReqRes({
                adminUser: chairman,
                params: { module: 'fyp' },
                query: { page: 1, pageSize: 250 }, // exceeds 100!
            });
            const handler = getRouteHandler('/:module', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(400);
            (0, vitest_1.expect)(res.getData().error.code).toBe('VALIDATION_ERROR');
        });
        (0, vitest_1.it)('ensures zero student personal records or PII are exposed in content response', async () => {
            const chairman = {
                adminId: 'chair-cis',
                email: 'chairman.cis@nedut.edu.pk',
                role: 'chairman',
                departmentId: 'dept-cis',
                allowedModules: [],
            };
            const { req, res } = createMockReqRes({
                adminUser: chairman,
                params: { module: 'fyp' },
                query: { page: 1, pageSize: 25 },
            });
            const handler = getRouteHandler('/:module', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            const jsonStr = JSON.stringify(res.getData());
            // Verification: no student IDs, student emails, or grades
            (0, vitest_1.expect)(jsonStr).not.toMatch(/@student\.nedut\.edu\.pk/i);
            (0, vitest_1.expect)(jsonStr).not.toMatch(/student_id/i);
            (0, vitest_1.expect)(jsonStr).not.toMatch(/cgpa/i);
        });
    });
    (0, vitest_1.describe)('4. Impact Classification Logic (Section 2.3)', () => {
        (0, vitest_1.it)('classifies text updates as minor impact', () => {
            const impact = (0, admin_content_1.classifyImpact)('update', 'fyp_projects', {
                abstract: 'New abstract description for the project',
            });
            (0, vitest_1.expect)(impact).toBe('minor');
        });
        (0, vitest_1.it)('classifies deletions as major impact', () => {
            const impact = (0, admin_content_1.classifyImpact)('delete', 'fyp_projects', {});
            (0, vitest_1.expect)(impact).toBe('major');
        });
    });
    (0, vitest_1.describe)('5. Data Import Review Queue & Staging (Section 3 & Rule 2)', () => {
        (0, vitest_1.it)('allows operator with data_imports permission to query the unreviewed extraction queue', async () => {
            const operator = {
                adminId: 'op-1',
                email: 'operator@nedut.edu.pk',
                role: 'operator',
                departmentId: 'dept-cis',
                allowedModules: ['data_imports', 'imports'],
            };
            const { req, res } = createMockReqRes({
                adminUser: operator,
                query: { page: 1, pageSize: 25 },
            });
            const handler = getRouteHandler('/imports/queue', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
            (0, vitest_1.expect)(res.getData().queue).toBeDefined();
        });
        (0, vitest_1.it)('stages an extracted record into a draft change item for Chairman review', async () => {
            const operator = {
                adminId: 'op-1',
                email: 'operator@nedut.edu.pk',
                role: 'operator',
                departmentId: 'dept-cis',
                allowedModules: ['data_imports', 'imports'],
            };
            const { req, res } = createMockReqRes({
                adminUser: operator,
                method: 'POST',
                params: { id: 'fyp-1' },
                body: {
                    title: 'Autonomous Navigation Robot (Corrected Title)',
                    domain_tags: ['Robotics', 'Autonomous Systems'],
                    proposal_outcome: 'accepted',
                    review_note: 'Verified supervisor and tags',
                },
            });
            const handler = getRouteHandler('/imports/:id/stage', 'post');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(201);
            (0, vitest_1.expect)(res.getData().changeItem).toBeDefined();
            (0, vitest_1.expect)(mockLiveUpdate).not.toHaveBeenCalled(); // Golden Rule 1: live row untouched
        });
    });
});
