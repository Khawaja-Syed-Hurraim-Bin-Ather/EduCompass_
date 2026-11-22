"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const admin_curriculum_1 = require("./admin-curriculum");
// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockVersionSingle = vitest_1.vi.fn();
const mockVersionMaybeSingle = vitest_1.vi.fn().mockResolvedValue({ data: { revision: 1 }, error: null });
const mockVersionInsert = vitest_1.vi.fn();
const mockCoursesSelect = vitest_1.vi.fn();
const mockCoursesInsert = vitest_1.vi.fn();
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn((table) => {
            if (table === 'curriculum_versions') {
                const queryBuilder = {
                    eq: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                    order: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                    limit: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                    single: mockVersionSingle,
                    maybeSingle: mockVersionMaybeSingle,
                };
                return {
                    select: vitest_1.vi.fn().mockReturnValue(queryBuilder),
                    insert: vitest_1.vi.fn().mockReturnValue({
                        select: vitest_1.vi.fn().mockReturnValue({
                            single: mockVersionInsert,
                        }),
                    }),
                };
            }
            if (table === 'curriculum_courses') {
                return {
                    select: vitest_1.vi.fn().mockReturnValue({
                        eq: mockCoursesSelect,
                    }),
                    insert: vitest_1.vi.fn().mockResolvedValue({ error: null }),
                };
            }
            if (table === 'batches') {
                return {
                    select: vitest_1.vi.fn().mockReturnValue({
                        eq: vitest_1.vi.fn().mockReturnValue({
                            range: vitest_1.vi.fn().mockResolvedValue({ data: [{ id: 'b-2022', year: 2022, student_count: 140 }], error: null }),
                        }),
                    }),
                };
            }
            if (table === 'course_equivalences') {
                return {
                    select: vitest_1.vi.fn().mockReturnValue({
                        range: vitest_1.vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                    insert: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'eq-1' }, error: null }),
                };
            }
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                insert: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
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
    const layer = admin_curriculum_1.adminCurriculumRouter.stack.find((l) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]);
    if (!layer || !layer.route)
        return undefined;
    const handlers = layer.route.stack;
    return handlers[handlers.length - 1]?.handle;
}
// ── Test Suite ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Curriculum Admin Module (Card A8)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('1. Role-Based Access Control (admin_permissions.json)', () => {
        (0, vitest_1.it)('blocks operators from accessing curriculum administration with 403', async () => {
            const operator = {
                adminId: 'op-1',
                email: 'operator@nedut.edu.pk',
                role: 'operator',
                departmentId: 'dept-cis',
                allowedModules: ['fyp', 'career'],
            };
            const { req, res } = createMockReqRes({
                adminUser: operator,
                params: { id: 'v-1' },
            });
            const handler = getRouteHandler('/versions/:id/impact', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(403);
            (0, vitest_1.expect)(res.getData().error.code).toBe('FORBIDDEN');
        });
        (0, vitest_1.it)('allows Chairman and VC to access curriculum management', async () => {
            const chairman = {
                adminId: 'chair-cis',
                email: 'chairman.cis@nedut.edu.pk',
                role: 'chairman',
                departmentId: 'dept-cis',
                allowedModules: [],
            };
            mockVersionSingle.mockResolvedValueOnce({
                data: {
                    id: 'v-1',
                    name: 'Scheme 2022',
                    revision: 1,
                    status: 'published',
                    grade_scale: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
                    passing_grade: 'D',
                    max_credits_per_semester: 21,
                    department_id: 'dept-cis',
                },
                error: null,
            });
            mockCoursesSelect.mockResolvedValueOnce({
                data: [],
                error: null,
            });
            const { req, res } = createMockReqRes({
                adminUser: chairman,
                params: { id: 'v-1' },
            });
            const handler = getRouteHandler('/versions/:id/impact', 'get');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(200);
        });
    });
    (0, vitest_1.describe)('2. Curriculum Validation Engine (Section 14 Test 5)', () => {
        (0, vitest_1.it)('catches circular prerequisite dependencies', () => {
            const courses = [
                { courseId: 'c1', code: 'CS-101', semester: 1, credits: 3 },
                { courseId: 'c2', code: 'CS-102', semester: 2, credits: 3 },
            ];
            // Circular: CS-101 requires CS-102, and CS-102 requires CS-101
            const rules = [
                { courseId: 'c1', courseCode: 'CS-101', prereqCourseCode: 'CS-102' },
                { courseId: 'c2', courseCode: 'CS-102', prereqCourseCode: 'CS-101' },
            ];
            const result = (0, admin_curriculum_1.validateCurriculumDraft)({
                courses,
                rules,
                maxCreditsPerSemester: 21,
                gradeScale: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
                passingGrade: 'D',
            });
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.errors.some((e) => e.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
        });
        (0, vitest_1.it)('catches backward prerequisites (prerequisite in later or same semester)', () => {
            const courses = [
                { courseId: 'c1', code: 'CS-101', semester: 1, credits: 3 },
                { courseId: 'c2', code: 'CS-201', semester: 3, credits: 3 },
            ];
            // Backward: CS-101 (sem 1) requires CS-201 (sem 3)
            const rules = [
                { courseId: 'c1', courseCode: 'CS-101', prereqCourseCode: 'CS-201' },
            ];
            const result = (0, admin_curriculum_1.validateCurriculumDraft)({
                courses,
                rules,
                maxCreditsPerSemester: 21,
                gradeScale: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
                passingGrade: 'D',
            });
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.errors.some((e) => e.code === 'BACKWARD_PREREQUISITE')).toBe(true);
        });
        (0, vitest_1.it)('catches semester credit overload exceeding maximum allowed limit', () => {
            const courses = [
                { courseId: 'c1', code: 'CS-101', semester: 1, credits: 4 },
                { courseId: 'c2', code: 'CS-102', semester: 1, credits: 4 },
                { courseId: 'c3', code: 'CS-103', semester: 1, credits: 4 },
                { courseId: 'c4', code: 'CS-104', semester: 1, credits: 4 },
                { courseId: 'c5', code: 'CS-105', semester: 1, credits: 4 },
                { courseId: 'c6', code: 'CS-106', semester: 1, credits: 4 }, // 24 credits > 21
            ];
            const result = (0, admin_curriculum_1.validateCurriculumDraft)({
                courses,
                rules: [],
                maxCreditsPerSemester: 21,
                gradeScale: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
                passingGrade: 'D',
            });
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.errors.some((e) => e.code === 'CREDIT_LIMIT_EXCEEDED')).toBe(true);
        });
        (0, vitest_1.it)('validates clean, correctly ordered curriculum successfully', () => {
            const courses = [
                { courseId: 'c1', code: 'CS-115', semester: 1, credits: 4 },
                { courseId: 'c2', code: 'CS-116', semester: 2, credits: 4 },
            ];
            const rules = [
                { courseId: 'c2', courseCode: 'CS-116', prereqCourseCode: 'CS-115' },
            ];
            const result = (0, admin_curriculum_1.validateCurriculumDraft)({
                courses,
                rules,
                maxCreditsPerSemester: 21,
                gradeScale: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
                passingGrade: 'D',
            });
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.errors).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)('3. Scheme Cloning (Section 2.1)', () => {
        (0, vitest_1.it)('clones a published scheme into a new draft revision', async () => {
            const chairman = {
                adminId: 'chair-cis',
                email: 'chairman.cis@nedut.edu.pk',
                role: 'chairman',
                departmentId: 'dept-cis',
                allowedModules: [],
            };
            mockVersionSingle.mockResolvedValueOnce({
                data: {
                    id: 'v-2022',
                    program_id: 'prog-cse',
                    name: 'Scheme 2022',
                    revision: 1,
                    grade_scale: { A: 4.0, D: 1.0, F: 0.0 },
                    passing_grade: 'D',
                    max_credits_per_semester: 21,
                },
                error: null,
            });
            mockCoursesSelect.mockResolvedValueOnce({
                data: [
                    { course_id: 'c1', semester: 1, credits: 3, category: 'core_computing' },
                ],
                error: null,
            });
            mockVersionInsert.mockResolvedValueOnce({
                data: {
                    id: 'v-2026',
                    name: 'Scheme 2026',
                    revision: 2,
                    status: 'draft',
                    based_on: 'v-2022',
                },
                error: null,
            });
            const { req, res } = createMockReqRes({
                adminUser: chairman,
                method: 'POST',
                params: { id: 'v-2022' },
                body: { name: 'Scheme 2026' },
            });
            const handler = getRouteHandler('/versions/:id/clone', 'post');
            (0, vitest_1.expect)(handler).toBeDefined();
            await handler(req, res);
            (0, vitest_1.expect)(res.getStatusCode()).toBe(201);
            (0, vitest_1.expect)(res.getData().newVersion.status).toBe('draft');
            (0, vitest_1.expect)(res.getData().newVersion.based_on).toBe('v-2022');
        });
    });
});
