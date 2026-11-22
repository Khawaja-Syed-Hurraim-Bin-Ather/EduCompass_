"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const admin_content_1 = require("./admin-content");
const supabase_1 = require("../lib/supabase");
// Helper to simulate router execution in tests
function getRouteHandler(router, path, method) {
    const stack = router.stack;
    for (const layer of stack) {
        if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
            const routeStack = layer.route.stack;
            return routeStack[routeStack.length - 1].handle;
        }
    }
    throw new Error(`Handler not found for ${method.toUpperCase()} ${path}`);
}
function mockReq(user, body = {}, params = {}, query = {}) {
    return {
        adminUser: user,
        body,
        params,
        query,
    };
}
function mockRes() {
    const res = {};
    res.status = vitest_1.vi.fn().mockReturnValue(res);
    res.json = vitest_1.vi.fn().mockReturnValue(res);
    return res;
}
(0, vitest_1.describe)('Edit Mode Working Set & saveDraftItem API (Card E1)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('1. Blocks operator from directly editing curriculum in working set (FA, FC)', async () => {
        const handler = getRouteHandler(admin_content_1.adminContentRouter, '/working-set/item', 'post');
        const req = mockReq({ adminId: 'op-1', email: 'op@nedut.edu.pk', role: 'operator', allowedModules: ['fyp'] }, {
            resource: 'curriculum',
            tableName: 'curriculum_courses',
            recordId: '11111111-1111-1111-1111-111111111111',
            patch: { title: 'Hacked Course' },
        });
        const res = mockRes();
        await handler(req, res, vitest_1.vi.fn());
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(403);
        const json = res.json.mock.calls[0][0];
        (0, vitest_1.expect)(json.error.code).toBe('FORBIDDEN');
        (0, vitest_1.expect)(json.error.message).toContain('Operators may not edit curriculum directly');
    });
    (0, vitest_1.it)('2. Blocks operator from editing a module they are not assigned to (FA, FE)', async () => {
        const handler = getRouteHandler(admin_content_1.adminContentRouter, '/working-set/item', 'post');
        const req = mockReq({ adminId: 'op-1', email: 'op@nedut.edu.pk', role: 'operator', allowedModules: ['fyp'] }, {
            resource: 'professors',
            tableName: 'professors',
            recordId: '22222222-2222-2222-2222-222222222222',
            patch: { name: 'Dr. Unassigned' },
        });
        const res = mockRes();
        await handler(req, res, vitest_1.vi.fn());
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(403);
        const json = res.json.mock.calls[0][0];
        (0, vitest_1.expect)(json.error.code).toBe('FORBIDDEN');
        (0, vitest_1.expect)(json.error.message).toContain('not entitled to edit module');
    });
    (0, vitest_1.it)('3. Successfully stages a draft patch in the working change set without writing live tables (FE-05)', async () => {
        const handler = getRouteHandler(admin_content_1.adminContentRouter, '/working-set/item', 'post');
        // Mock supabaseAdmin responses
        vitest_1.vi.spyOn(supabase_1.supabaseAdmin, 'from').mockImplementation((table) => {
            if (table === 'change_sets') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                order: () => ({
                                    limit: () => ({
                                        maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                                            data: { id: 'cs-work-1', title: 'Active Draft', impact: 'minor' },
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'change_items') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: vitest_1.vi.fn().mockReturnValue({
                                eq: vitest_1.vi.fn().mockResolvedValue({ data: [] }),
                            }),
                        }),
                    }),
                    insert: vitest_1.vi.fn().mockReturnValue({
                        select: () => ({
                            single: vitest_1.vi.fn().mockResolvedValue({
                                data: {
                                    id: 'item-1',
                                    change_set_id: 'cs-work-1',
                                    table_name: 'professors',
                                    record_id: 'prof-1',
                                    op: 'update',
                                    after: { highlights: 'Updated research award' },
                                },
                            }),
                        }),
                    }),
                };
            }
            return {
                select: () => ({
                    eq: () => ({
                        maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                            data: { id: 'prof-1', name: 'Dr. Tariq', highlights: 'Old' },
                        }),
                    }),
                }),
            };
        });
        const req = mockReq({ adminId: 'cm-1', email: 'chairman@nedut.edu.pk', role: 'chairman', departmentId: 'dept-cis' }, {
            resource: 'professors',
            tableName: 'professors',
            recordId: 'prof-1',
            op: 'update',
            patch: { highlights: 'Updated research award' },
        });
        const res = mockRes();
        await handler(req, res, vitest_1.vi.fn());
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(201);
        const json = res.json.mock.calls[0][0];
        (0, vitest_1.expect)(json.success).toBe(true);
        (0, vitest_1.expect)(json.changeSetId).toBe('cs-work-1');
        (0, vitest_1.expect)(json.item.after.highlights).toBe('Updated research award');
    });
    (0, vitest_1.it)('4. Returns the caller active working set with pending items (FE-08)', async () => {
        const handler = getRouteHandler(admin_content_1.adminContentRouter, '/working-set', 'get');
        vitest_1.vi.spyOn(supabase_1.supabaseAdmin, 'from').mockImplementation((table) => {
            if (table === 'change_sets') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                order: () => ({
                                    limit: () => ({
                                        maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                                            data: { id: 'cs-work-1', resource: 'fyp', title: 'Draft FYP updates' },
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'change_items') {
                return {
                    select: () => ({
                        eq: () => ({
                            order: vitest_1.vi.fn().mockResolvedValue({
                                data: [
                                    { id: 'i1', table_name: 'fyp_projects', op: 'update', after: { title: 'Autonomous Drone' } },
                                    { id: 'i2', table_name: 'fyp_projects', op: 'insert', after: { title: 'Medical AI' } },
                                ],
                            }),
                        }),
                    }),
                };
            }
            return {};
        });
        const req = mockReq({ adminId: 'cm-1', role: 'chairman' });
        const res = mockRes();
        await handler(req, res, vitest_1.vi.fn());
        (0, vitest_1.expect)(res.json).toHaveBeenCalled();
        const json = res.json.mock.calls[0][0];
        (0, vitest_1.expect)(json.changeSet.id).toBe('cs-work-1');
        (0, vitest_1.expect)(json.pendingCount).toBe(2);
        (0, vitest_1.expect)(json.items[0].after.title).toBe('Autonomous Drone');
    });
    (0, vitest_1.it)('5. Successfully deletes a single item from the working set (FE-10)', async () => {
        const handler = getRouteHandler(admin_content_1.adminContentRouter, '/working-set/items/:itemId', 'delete');
        vitest_1.vi.spyOn(supabase_1.supabaseAdmin, 'from').mockImplementation((table) => {
            if (table === 'change_items') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'item-1', change_set_id: 'cs-1' } }),
                            head: false,
                        }),
                    }),
                    delete: () => ({
                        eq: vitest_1.vi.fn().mockResolvedValue({ error: null }),
                    }),
                };
            }
            if (table === 'change_sets') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'cs-1', created_by: 'cm-1', status: 'draft' } }),
                        }),
                    }),
                };
            }
            return {};
        });
        const req = mockReq({ adminId: 'cm-1', role: 'chairman' }, {}, { itemId: 'item-1' });
        const res = mockRes();
        await handler(req, res, vitest_1.vi.fn());
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ success: true }));
    });
});
