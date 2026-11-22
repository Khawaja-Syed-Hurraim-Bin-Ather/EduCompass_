"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const publish_cascade_1 = require("./publish-cascade");
// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockJobUpdate = vitest_1.vi.fn().mockReturnValue({
    eq: vitest_1.vi.fn().mockResolvedValue({ error: null }),
});
const mockJobsOrder = vitest_1.vi.fn().mockResolvedValue({ data: [], error: null });
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn((table) => {
            if (table === 'publish_jobs') {
                const queryBuilder = {
                    eq: vitest_1.vi.fn().mockImplementation(() => queryBuilder),
                    order: mockJobsOrder,
                };
                return {
                    select: vitest_1.vi.fn().mockReturnValue(queryBuilder),
                    update: mockJobUpdate,
                };
            }
            if (table === 'releases') {
                return {
                    select: vitest_1.vi.fn().mockReturnValue({
                        eq: vitest_1.vi.fn().mockReturnValue({
                            single: vitest_1.vi.fn().mockResolvedValue({
                                data: { id: 'rel-1', tag: 'cis-2026-v1', snapshot: { courses: ['CS-115', 'CS-116'] } },
                                error: null,
                            }),
                        }),
                    }),
                    insert: vitest_1.vi.fn().mockReturnValue({
                        select: vitest_1.vi.fn().mockReturnValue({
                            single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'rel-rollback-1' }, error: null }),
                        }),
                    }),
                };
            }
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                update: vitest_1.vi.fn().mockReturnThis(),
                insert: vitest_1.vi.fn().mockResolvedValue({ error: null }),
            };
        }),
    },
}));
(0, vitest_1.describe)('Publish Cascade Engine (Card A9, Section 8)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('1. Cascade Job Execution & Idempotency', () => {
        (0, vitest_1.it)('executes a queued job step and marks it done', async () => {
            const job = {
                id: 'job-1',
                release_id: 'rel-1',
                step: 'rebuild_graph',
                status: 'queued',
            };
            const result = await (0, publish_cascade_1.executePublishJob)(job);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.status).toBe('done');
            // Verifies update was called to set status = 'running' then 'done'
            (0, vitest_1.expect)(mockJobUpdate).toHaveBeenCalled();
        });
        (0, vitest_1.it)('is idempotent: skips execution if job is already marked done', async () => {
            const completedJob = {
                id: 'job-done',
                release_id: 'rel-1',
                step: 'refresh_caches',
                status: 'done',
            };
            const result = await (0, publish_cascade_1.executePublishJob)(completedJob);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.status).toBe('done');
            (0, vitest_1.expect)(result.skipped).toBe(true);
        });
        (0, vitest_1.it)('handles side job failure gracefully without crashing the runner', async () => {
            const faultyJob = {
                id: 'job-err',
                release_id: 'rel-1',
                step: 'invalid_unknown_step',
                status: 'queued',
            };
            const result = await (0, publish_cascade_1.executePublishJob)(faultyJob);
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.status).toBe('failed');
            (0, vitest_1.expect)(result.error).toBeDefined();
            // Section 8: Failed side job records failure detail but does not undo the publish
            (0, vitest_1.expect)(mockJobUpdate).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'failed' }));
        });
    });
    (0, vitest_1.describe)('2. Batch Cascade Runner', () => {
        (0, vitest_1.it)('executes all pending jobs for a release in order', async () => {
            mockJobsOrder.mockResolvedValueOnce({
                data: [
                    { id: 'j-3', release_id: 'rel-1', step: 'rebuild_graph', status: 'queued' },
                    { id: 'j-4', release_id: 'rel-1', step: 'recompute_scores', status: 'queued' },
                    { id: 'j-5', release_id: 'rel-1', step: 'refresh_caches', status: 'queued' },
                ],
                error: null,
            });
            const summary = await (0, publish_cascade_1.runPendingJobs)('rel-1');
            (0, vitest_1.expect)(summary.total).toBe(3);
            (0, vitest_1.expect)(summary.completed).toBe(3);
            (0, vitest_1.expect)(summary.failed).toBe(0);
        });
    });
});
