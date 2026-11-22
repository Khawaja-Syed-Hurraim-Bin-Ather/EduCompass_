"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const planner_1 = require("./planner");
// ─── Mock Supabase admin client (Rule #15 — no live DB in tests) ─────────────
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn(() => ({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
            upsert: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({
                data: {
                    id: 'mock-plan-id',
                    user_id: 'mock-user-id',
                    plan_name: 'My Degree Plan',
                    target_graduation_term: 'Spring 2028',
                    slots: [],
                    notes: 'Test notes',
                    is_valid: true,
                    total_planned_credits: 136,
                    updated_at: new Date().toISOString(),
                },
                error: null,
            }),
        })),
    },
}));
vitest_1.vi.mock('../middleware/auth', () => ({
    requireRole: vitest_1.vi.fn(() => (_req, _res, next) => next()),
}));
(0, vitest_1.describe)('Planner API Router (Card M3, Rules #7, #8, #13, #15)', () => {
    (0, vitest_1.it)('exports plannerRouter as an Express Router instance', () => {
        (0, vitest_1.expect)(planner_1.plannerRouter).toBeDefined();
        (0, vitest_1.expect)(typeof planner_1.plannerRouter).toBe('function');
    });
    (0, vitest_1.it)('registers GET /template route handler', () => {
        const hasGetTemplate = planner_1.plannerRouter.stack.some((layer) => layer.route?.path === '/template' && layer.route?.methods?.get);
        (0, vitest_1.expect)(hasGetTemplate).toBe(true);
    });
    (0, vitest_1.it)('registers POST /validate route handler for schedule validation', () => {
        const hasPostValidate = planner_1.plannerRouter.stack.some((layer) => layer.route?.path === '/validate' && layer.route?.methods?.post);
        (0, vitest_1.expect)(hasPostValidate).toBe(true);
    });
    (0, vitest_1.it)('registers GET /my-plan route handler for student saved plan', () => {
        const hasGetMyPlan = planner_1.plannerRouter.stack.some((layer) => layer.route?.path === '/my-plan' && layer.route?.methods?.get);
        (0, vitest_1.expect)(hasGetMyPlan).toBe(true);
    });
    (0, vitest_1.it)('registers PUT /my-plan route handler for saving custom plan', () => {
        const hasPutMyPlan = planner_1.plannerRouter.stack.some((layer) => layer.route?.path === '/my-plan' && layer.route?.methods?.put);
        (0, vitest_1.expect)(hasPutMyPlan).toBe(true);
    });
    (0, vitest_1.it)('has all 4 required planner endpoints mounted', () => {
        const paths = planner_1.plannerRouter.stack
            .filter((layer) => layer.route)
            .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
        (0, vitest_1.expect)(paths).toContain('GET /template');
        (0, vitest_1.expect)(paths).toContain('POST /validate');
        (0, vitest_1.expect)(paths).toContain('GET /my-plan');
        (0, vitest_1.expect)(paths).toContain('PUT /my-plan');
    });
});
