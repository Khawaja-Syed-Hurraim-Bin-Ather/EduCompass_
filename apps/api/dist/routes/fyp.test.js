"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fyp_1 = require("./fyp");
// ─── Mock Supabase (Rule #15 — no live DB) ────────────────────────────────────
const sampleFyp = {
    id: 'fyp-001',
    title: 'Autonomous Drone Surveillance with Edge AI',
    abstract: 'A drone system using YOLO for real-time object detection at the edge.',
    year: 2024,
    supervisor: 'Dr. Ali',
    domain_tags: ['robotics-embedded', 'ai-ml'],
    proposal_outcome: 'accepted',
    embedding: null,
};
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn((table) => {
            if (table === 'fyp_projects') {
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    neq: vitest_1.vi.fn().mockReturnThis(),
                    ilike: vitest_1.vi.fn().mockReturnThis(),
                    contains: vitest_1.vi.fn().mockReturnThis(),
                    order: vitest_1.vi.fn().mockReturnThis(),
                    range: vitest_1.vi.fn().mockResolvedValue({ data: [sampleFyp], count: 1, error: null }),
                    maybeSingle: vitest_1.vi.fn().mockResolvedValue({ data: sampleFyp, error: null }),
                    limit: vitest_1.vi.fn().mockResolvedValue({ data: [sampleFyp], error: null }),
                    insert: vitest_1.vi.fn().mockReturnThis(),
                    delete: vitest_1.vi.fn().mockReturnThis(),
                    update: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({ data: sampleFyp, error: null }),
                };
            }
            if (table === 'fyp_team_ideas') {
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    order: vitest_1.vi.fn().mockReturnThis(),
                    range: vitest_1.vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
                    insert: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({
                        data: { id: 'idea-001', title: 'NLP Team', is_open: true },
                        error: null,
                    }),
                    maybeSingle: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
                    update: vitest_1.vi.fn().mockReturnThis(),
                    delete: vitest_1.vi.fn().mockReturnThis(),
                };
            }
            if (table === 'fyp_shortlists') {
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    order: vitest_1.vi.fn().mockReturnThis(),
                    maybeSingle: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
                    insert: vitest_1.vi.fn().mockReturnThis(),
                    delete: vitest_1.vi.fn().mockReturnThis(),
                };
            }
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
            };
        }),
        rpc: vitest_1.vi.fn().mockResolvedValue({ data: [], error: null }),
        auth: { getUser: vitest_1.vi.fn() },
    },
}));
vitest_1.vi.mock('../lib/llm-gateway', () => ({
    getEmbedding: vitest_1.vi.fn().mockResolvedValue(new Array(768).fill(0.01)),
}));
vitest_1.vi.mock('../middleware/auth', () => ({
    requireRole: vitest_1.vi.fn(() => (_req, _res, next) => next()),
}));
(0, vitest_1.describe)('FYP Router (Cards E5 + M1)', () => {
    (0, vitest_1.it)('exports fypRouter as an Express Router', () => {
        (0, vitest_1.expect)(fyp_1.fypRouter).toBeDefined();
        (0, vitest_1.expect)(typeof fyp_1.fypRouter).toBe('function');
        (0, vitest_1.expect)(fyp_1.fypRouter.stack.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('registers GET / route for project listing', () => {
        const hasGet = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/' && layer.route?.methods?.get);
        (0, vitest_1.expect)(hasGet).toBe(true);
    });
    (0, vitest_1.it)('registers GET /team-ideas route for team board', () => {
        const hasTeamGet = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/team-ideas' && layer.route?.methods?.get);
        (0, vitest_1.expect)(hasTeamGet).toBe(true);
    });
    (0, vitest_1.it)('registers POST /team-ideas route for creating a team idea', () => {
        const hasTeamPost = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/team-ideas' && layer.route?.methods?.post);
        (0, vitest_1.expect)(hasTeamPost).toBe(true);
    });
    (0, vitest_1.it)('registers PATCH /team-ideas/:id route for editing a team idea', () => {
        const hasTeamPatch = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/team-ideas/:id' && layer.route?.methods?.patch);
        (0, vitest_1.expect)(hasTeamPatch).toBe(true);
    });
    (0, vitest_1.it)('registers DELETE /team-ideas/:id route for removing a team idea', () => {
        const hasTeamDelete = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/team-ideas/:id' && layer.route?.methods?.delete);
        (0, vitest_1.expect)(hasTeamDelete).toBe(true);
    });
    (0, vitest_1.it)('registers GET /:id/similar route for similarity search', () => {
        const hasSimilar = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/:id/similar' && layer.route?.methods?.get);
        (0, vitest_1.expect)(hasSimilar).toBe(true);
    });
    (0, vitest_1.it)('registers GET /:id route for individual project detail', () => {
        const hasDetail = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/:id' && layer.route?.methods?.get);
        (0, vitest_1.expect)(hasDetail).toBe(true);
    });
    (0, vitest_1.it)('registers GET /user/shortlist route for user shortlists', () => {
        const hasShortlist = fyp_1.fypRouter.stack.some((layer) => layer.route?.path === '/user/shortlist' && layer.route?.methods?.get);
        (0, vitest_1.expect)(hasShortlist).toBe(true);
    });
});
