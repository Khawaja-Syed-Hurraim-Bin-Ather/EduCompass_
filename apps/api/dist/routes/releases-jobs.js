"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releasesJobsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const shared_1 = require("../shared");
const supabase_1 = require("../lib/supabase");
const admin_auth_1 = require("../middleware/admin-auth");
const publish_cascade_1 = require("../lib/publish-cascade");
exports.releasesJobsRouter = (0, express_1.Router)();
// Require admin authentication for all release and job operations
exports.releasesJobsRouter.use(admin_auth_1.requireAdminAuth);
// ── Validation Schemas ────────────────────────────────────────────────────────
const ListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(25),
    status: zod_1.z.string().optional(),
    releaseId: zod_1.z.string().uuid().optional(),
    departmentId: zod_1.z.string().uuid().optional(),
});
const RollbackSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5, 'A clear reason is required for executing a rollback').max(500),
});
// ── Releases Routes ───────────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/releases
 * List historical release snapshots (Section 13).
 */
exports.releasesJobsRouter.get('/releases', async (req, res) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.errors));
        return;
    }
    const { page, pageSize, departmentId } = parsed.data;
    const admin = req.adminUser;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    try {
        let query = supabase_1.supabaseAdmin
            .from('releases')
            .select('id, tag, department_id, notes, created_by, created_at', { count: 'exact' });
        // Scoping
        if (admin.role !== 'vc') {
            if (admin.departmentId) {
                query = query.eq('department_id', admin.departmentId);
            }
        }
        else if (departmentId) {
            query = query.eq('department_id', departmentId);
        }
        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) {
            res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
            return;
        }
        res.json({
            data: data || [],
            meta: {
                page,
                pageSize,
                total: count ?? (data?.length || 0),
            },
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error fetching releases'));
    }
});
/**
 * GET /api/v1/admin/releases/:id
 * Retrieve a single release with its snapshot and cascade publish jobs.
 */
exports.releasesJobsRouter.get('/releases/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: release, error: rErr } = await supabase_1.supabaseAdmin
            .from('releases')
            .select('*')
            .eq('id', id)
            .single();
        if (rErr || !release) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', `Release '${id}' not found`));
            return;
        }
        // Fetch jobs for this release
        const { data: jobs } = await supabase_1.supabaseAdmin
            .from('publish_jobs')
            .select('id, step, status, detail, created_at')
            .eq('release_id', id);
        res.json({
            release,
            jobs: jobs || [],
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error fetching release detail'));
    }
});
/**
 * POST /api/v1/admin/releases/:id/rollback
 * Atomically rolls back to a previous release snapshot (Section 8).
 * Requires step-up challenge and VC role authorization.
 */
exports.releasesJobsRouter.post('/releases/:id/rollback', admin_auth_1.requireStepUp, async (req, res) => {
    const admin = req.adminUser;
    const { id } = req.params;
    // Authorization check (Section 8): Rollback needs VC role
    if (admin.role !== 'vc') {
        res.status(403).json((0, shared_1.apiError)('FORBIDDEN', 'Rollback requires Vice Chancellor authorization.', [
            { field: 'role', message: 'Current role is not Vice Chancellor.' },
        ]));
        return;
    }
    const parsed = RollbackSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'A valid rollback reason is required', parsed.error.errors));
        return;
    }
    const { reason } = parsed.data;
    try {
        // 1. Fetch target release to restore
        const { data: targetRelease, error: tErr } = await supabase_1.supabaseAdmin
            .from('releases')
            .select('*')
            .eq('id', id)
            .single();
        if (tErr || !targetRelease) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', `Target release '${id}' not found`));
            return;
        }
        // 2. Create a new rollback release record (Never edit history - Section 8)
        const shortRand = Math.random().toString(36).substring(2, 6);
        const rollbackTag = `rollback-${targetRelease.tag}-${shortRand}`;
        const { data: rollbackRelease, error: createErr } = await supabase_1.supabaseAdmin
            .from('releases')
            .insert({
            tag: rollbackTag,
            department_id: targetRelease.department_id,
            program_id: targetRelease.program_id,
            snapshot: targetRelease.snapshot,
            notes: `Rollback to ${targetRelease.tag}: ${reason}`,
            created_by: admin.adminId,
        })
            .select('*')
            .single();
        if (createErr || !rollbackRelease) {
            res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', 'Failed to create rollback release record', [
                { field: 'releases', message: createErr?.message || 'DB error' },
            ]));
            return;
        }
        // 3. Enqueue steps 3 through 10 in publish_jobs
        const cascadeSteps = [
            'rebuild_graph',
            'recompute_scores',
            'refresh_caches',
            'reembed_chatbot',
            'faq_staleness',
            'career_links',
            'student_notice',
            'health_report',
        ];
        const jobsToInsert = cascadeSteps.map((step) => ({
            release_id: rollbackRelease.id,
            step,
            status: 'queued',
            detail: { enqueued_reason: `Rollback to ${targetRelease.tag}` },
        }));
        await supabase_1.supabaseAdmin.from('publish_jobs').insert(jobsToInsert);
        // 4. Trigger runner in background
        (0, publish_cascade_1.runPendingJobs)(rollbackRelease.id).catch((err) => {
            console.error('Background cascade run error after rollback:', err);
        });
        res.json({
            message: `Rollback release created successfully as '${rollbackTag}'. Cascade steps 3-10 enqueued.`,
            rollbackRelease,
            enqueuedJobsCount: cascadeSteps.length,
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error executing rollback'));
    }
});
// ── Publish Jobs Routes ───────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/jobs
 * List cascade jobs with status and release filters (Section 13).
 */
exports.releasesJobsRouter.get('/jobs', async (req, res) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.errors));
        return;
    }
    const { page, pageSize, status, releaseId } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    try {
        let query = supabase_1.supabaseAdmin.from('publish_jobs').select('*', { count: 'exact' });
        if (status) {
            query = query.eq('status', status);
        }
        if (releaseId) {
            query = query.eq('release_id', releaseId);
        }
        const { data, count, error } = await query
            .order('id', { ascending: false })
            .range(from, to);
        if (error) {
            res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
            return;
        }
        res.json({
            data: data || [],
            meta: {
                page,
                pageSize,
                total: count ?? (data?.length || 0),
            },
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error fetching jobs'));
    }
});
/**
 * POST /api/v1/admin/jobs/:id/retry
 * Re-runs a failed or queued cascade job step.
 */
exports.releasesJobsRouter.post('/jobs/:id/retry', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: job, error: jErr } = await supabase_1.supabaseAdmin
            .from('publish_jobs')
            .select('*')
            .eq('id', id)
            .single();
        if (jErr || !job) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', `Publish job '${id}' not found`));
            return;
        }
        // Reset status to queued and execute
        const result = await (0, publish_cascade_1.executePublishJob)({
            ...job,
            status: 'queued',
        });
        res.json({
            message: `Job '${id}' re-executed with status '${result.status}'`,
            result,
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error retrying job'));
    }
});
/**
 * POST /api/v1/admin/jobs/run
 * Manually triggers processing of all pending queued jobs.
 */
exports.releasesJobsRouter.post('/jobs/run', async (req, res) => {
    const releaseId = req.body?.releaseId;
    try {
        const summary = await (0, publish_cascade_1.runPendingJobs)(releaseId);
        res.json({
            message: 'Pending jobs executed',
            summary,
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error running pending jobs'));
    }
});
