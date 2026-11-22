"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const curriculum_1 = require("./curriculum");
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
function mockReq(query = {}, params = {}) {
    return {
        query,
        params,
    };
}
function mockRes() {
    const res = {};
    res.status = vitest_1.vi.fn().mockReturnValue(res);
    res.json = vitest_1.vi.fn().mockReturnValue(res);
    return res;
}
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn(() => ({
            select: vitest_1.vi.fn(() => ({
                eq: vitest_1.vi.fn(() => ({
                    maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                        data: {
                            id: 'b-2022',
                            admission_year: 2022,
                            curriculum_version: {
                                id: 'v-2018',
                                name: 'BE CSE 2018 Onwards',
                                revision: 'v1.0',
                                status: 'published',
                                max_credits_per_semester: 21,
                                passing_grade: 'D',
                            },
                        },
                        error: null,
                    }),
                })),
                order: vitest_1.vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
        })),
    },
}));
(0, vitest_1.describe)('Curriculum Public Router (Card E2)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('GET / returns full curriculum course list with prerequisites', async () => {
        const handler = getRouteHandler(curriculum_1.curriculumRouter, '/', 'get');
        const req = mockReq({ batch: '2022', program: 'CSE' });
        const res = mockRes();
        await handler(req, res, () => { });
        (0, vitest_1.expect)(res.json).toHaveBeenCalled();
        const responseData = res.json.mock.calls[0][0];
        (0, vitest_1.expect)(responseData.success).toBe(true);
        (0, vitest_1.expect)(Array.isArray(responseData.data.courses)).toBe(true);
        (0, vitest_1.expect)(responseData.data.courses.length).toBeGreaterThanOrEqual(30);
        const progCourse = responseData.data.courses.find((c) => c.code === 'CS-115');
        (0, vitest_1.expect)(progCourse).toBeDefined();
        (0, vitest_1.expect)(progCourse.title).toContain('Computer Programming');
        (0, vitest_1.expect)(progCourse.credits).toBe(4);
        const oopCourse = responseData.data.courses.find((c) => c.code === 'CS-116');
        (0, vitest_1.expect)(oopCourse).toBeDefined();
        (0, vitest_1.expect)(oopCourse.prereqs).toContain('CS-115');
    });
    (0, vitest_1.it)('resolves batch information from database or fallback', async () => {
        const handler = getRouteHandler(curriculum_1.curriculumRouter, '/', 'get');
        const req = mockReq({ batch: '2022' });
        const res = mockRes();
        await handler(req, res, () => { });
        (0, vitest_1.expect)(res.json).toHaveBeenCalled();
        const responseData = res.json.mock.calls[0][0];
        (0, vitest_1.expect)(responseData.data.version).toBeDefined();
        (0, vitest_1.expect)(responseData.data.version.batch).toBe(2022);
    });
});
