"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const careers_1 = require("./careers");
// Mock supabaseAdmin so no live DB is hit in CI (Rule #15)
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn(() => ({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            overlaps: vitest_1.vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
        })),
    },
}));
(0, vitest_1.describe)('Careers Router (Card E2)', () => {
    (0, vitest_1.it)('exports careersRouter with registered routes', () => {
        (0, vitest_1.expect)(careers_1.careersRouter).toBeDefined();
        (0, vitest_1.expect)(careers_1.careersRouter.stack.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('has GET / and GET /:slug handlers', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const routes = careers_1.careersRouter.stack.map((layer) => layer.route ? `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}` : null).filter(Boolean);
        (0, vitest_1.expect)(routes).toContain('GET /');
        (0, vitest_1.expect)(routes).toContain('GET /:slug');
    });
});
