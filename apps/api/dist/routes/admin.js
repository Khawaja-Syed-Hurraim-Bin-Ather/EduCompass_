"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const shared_1 = require("../shared");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
exports.adminRouter = (0, express_1.Router)();
// All admin routes require 'admin' role (Rule #2)
exports.adminRouter.use((0, auth_1.requireRole)('admin'));
// ─── Schemas ──────────────────────────────────────────────────────────────────
const ReviewStatusSchema = zod_1.z.enum(['extracted', 'approved', 'published', 'rejected']);
const ListQuerySchema = zod_1.z.object({
    status: ReviewStatusSchema.optional().default('extracted'),
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(25),
});
const BulkActionSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(100),
    action: zod_1.z.enum(['approve', 'publish', 'reject', 'reset']),
    note: zod_1.z.string().max(500).optional(),
});
const PatchRecordSchema = zod_1.z.object({
    review_status: ReviewStatusSchema.optional(),
    title: zod_1.z.string().min(3).max(300).optional(),
    supervisor: zod_1.z.string().min(2).max(200).optional(),
    domain_tags: zod_1.z.array(zod_1.z.string()).optional(),
    tools: zod_1.z.array(zod_1.z.string()).optional(),
    proposal_outcome: zod_1.z.enum(['accepted', 'rejected', 'unknown']).optional(),
    outcome_reason: zod_1.z.string().max(500).nullable().optional(),
    review_note: zod_1.z.string().max(500).nullable().optional(),
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusFromAction(action) {
    switch (action) {
        case 'approve': return 'approved';
        case 'publish': return 'published';
        case 'reject': return 'rejected';
        case 'reset': return 'extracted';
        default: return 'extracted';
    }
}
async function writeAuditLog(adminId, action, targetIds, meta = {}) {
    await supabase_1.supabaseAdmin.from('audit_log').insert({
        actor_id: adminId,
        action,
        target_table: 'fyp_projects',
        target_ids: targetIds,
        meta,
    });
}
// ─── Routes ───────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/fyp
 * List FYP records by review status — for the Admin review queue.
 */
exports.adminRouter.get('/fyp', async (req, res) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid query params', parsed.error.errors));
        return;
    }
    const { status, page, pageSize } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await supabase_1.supabaseAdmin
        .from('fyp_projects')
        .select('id, title, year, supervisor, domain_tags, proposal_outcome, review_status, source_file, created_at, review_note', { count: 'exact' })
        .eq('review_status', status)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);
    if (error) {
        res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
        return;
    }
    res.json({
        data,
        meta: { total: count ?? 0, page, pageSize, status },
    });
});
/**
 * GET /api/v1/admin/fyp/stats
 * Quick count per review_status for the dashboard header.
 */
exports.adminRouter.get('/fyp/stats', async (_req, res) => {
    const statuses = ['extracted', 'approved', 'published', 'rejected'];
    const counts = {};
    for (const s of statuses) {
        const { count } = await supabase_1.supabaseAdmin
            .from('fyp_projects')
            .select('id', { count: 'exact', head: true })
            .eq('review_status', s);
        counts[s] = count ?? 0;
    }
    res.json({ data: counts });
});
/**
 * PATCH /api/v1/admin/fyp/:id
 * Edit a single FYP record (correct domain tags, title, etc.).
 */
exports.adminRouter.patch('/fyp/:id', async (req, res) => {
    const parsed = PatchRecordSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid update payload', parsed.error.errors));
        return;
    }
    const id = req.params.id;
    const adminId = req.user.id;
    const { data, error } = await supabase_1.supabaseAdmin
        .from('fyp_projects')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, title, review_status')
        .single();
    if (error) {
        res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
        return;
    }
    await writeAuditLog(adminId, 'admin.fyp.patch', [id], { fields: Object.keys(parsed.data) });
    res.json({ data });
});
/**
 * POST /api/v1/admin/fyp/bulk
 * Bulk approve / publish / reject / reset FYP records.
 * Rule #8: Failure simulation never touches real records.
 */
exports.adminRouter.post('/fyp/bulk', async (req, res) => {
    const parsed = BulkActionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid bulk action payload', parsed.error.errors));
        return;
    }
    const { ids, action, note } = parsed.data;
    const adminId = req.user.id;
    const newStatus = statusFromAction(action);
    const updatePayload = {
        review_status: newStatus,
        updated_at: new Date().toISOString(),
    };
    if (note)
        updatePayload.review_note = note;
    const { data, error } = await supabase_1.supabaseAdmin
        .from('fyp_projects')
        .update(updatePayload)
        .in('id', ids)
        .select('id, title, review_status');
    if (error) {
        res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
        return;
    }
    await writeAuditLog(adminId, `admin.fyp.bulk_${action}`, ids, { note, newStatus });
    res.json({
        data: { updated: data?.length ?? 0, action, newStatus },
    });
});
/**
 * GET /api/v1/admin/audit
 * Paginated audit log — admin-only.
 */
exports.adminRouter.get('/audit', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const from = (page - 1) * pageSize;
    const { data, count, error } = await supabase_1.supabaseAdmin
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
    if (error) {
        res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
        return;
    }
    res.json({ data, meta: { total: count ?? 0, page, pageSize } });
});
/**
 * GET /api/v1/admin/deletion-requests
 * List pending account deletion requests.
 */
exports.adminRouter.get('/deletion-requests', async (_req, res) => {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('deletion_requests')
        .select('id, user_id, reason, created_at, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
    if (error) {
        res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
        return;
    }
    res.json({ data });
});
/**
 * POST /api/v1/admin/deletion-requests/:id/complete
 * Mark a deletion request complete and delete the user's data.
 */
exports.adminRouter.post('/deletion-requests/:id/complete', async (req, res) => {
    const id = req.params.id;
    const adminId = req.user.id;
    // Fetch the request
    const { data: reqData, error: reqErr } = await supabase_1.supabaseAdmin
        .from('deletion_requests')
        .select('id, user_id, status')
        .eq('id', id)
        .single();
    if (reqErr || !reqData) {
        res.status(404).json((0, shared_1.apiError)('NOT_FOUND', 'Deletion request not found'));
        return;
    }
    if (reqData.status !== 'pending') {
        res.status(409).json((0, shared_1.apiError)('CONFLICT', 'Request already processed'));
        return;
    }
    const userId = reqData.user_id;
    // 1. Delete user profile & data (cascade deletes via FK)
    await supabase_1.supabaseAdmin.from('profiles').delete().eq('id', userId);
    await supabase_1.supabaseAdmin.from('fyp_shortlists').delete().eq('user_id', userId);
    await supabase_1.supabaseAdmin.from('roadmap_progress').delete().eq('user_id', userId);
    // 2. Mark request complete
    await supabase_1.supabaseAdmin
        .from('deletion_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);
    // 3. Audit log (anonymised — just the request ID, not the user ID in logs)
    await writeAuditLog(adminId, 'admin.account.deleted', [id], { note: 'User-requested deletion' });
    res.json({ data: { message: 'User data deleted successfully', requestId: id } });
});
