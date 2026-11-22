"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const shared_1 = require("../shared");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../lib/supabase");
exports.accountRouter = (0, express_1.Router)();
// Zod schemas
const UpdateProfileSchema = zod_1.z.object({
    full_name: zod_1.z.string().min(1).max(100).optional(),
    current_semester: zod_1.z.number().int().min(1).max(8).optional(),
    career_goal: zod_1.z.string().max(250).nullable().optional(),
    interests: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional(),
});
const DeletionRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().max(500).optional(),
});
/**
 * GET /api/v1/account/profile
 */
exports.accountRouter.get('/profile', (0, auth_1.requireRole)('enrolled', 'admin'), async (req, res) => {
    try {
        const userId = req.user.id;
        const { data: profile, error } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error || !profile) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', 'User profile not found'));
            return;
        }
        res.json({
            data: profile,
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to fetch profile'));
    }
});
/**
 * PATCH /api/v1/account/profile
 */
exports.accountRouter.patch('/profile', (0, auth_1.requireRole)('enrolled', 'admin'), async (req, res) => {
    try {
        const userId = req.user.id;
        const parseResult = UpdateProfileSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid profile update payload', parseResult.error.errors));
            return;
        }
        const updates = {
            ...parseResult.data,
            updated_at: new Date().toISOString(),
        };
        const { data: updatedProfile, error } = await supabase_1.supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) {
            res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
            return;
        }
        res.json({
            data: updatedProfile,
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to update profile'));
    }
});
/**
 * POST /api/v1/account/delete-request
 * Rule 9: No self-delete. Users submit a deletion request; Admin completes it within 7 days, logged in audit_log.
 */
exports.accountRouter.post('/delete-request', (0, auth_1.requireRole)('enrolled', 'admin'), async (req, res) => {
    try {
        const userId = req.user.id;
        const parseResult = DeletionRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid deletion request payload', parseResult.error.errors));
            return;
        }
        const reason = parseResult.data.reason ?? 'User requested account closure';
        // Insert deletion request
        const { data: deletionRecord, error: insertError } = await supabase_1.supabaseAdmin
            .from('deletion_requests')
            .insert({
            user_id: userId,
            reason,
            status: 'pending',
        })
            .select()
            .single();
        if (insertError) {
            res.status(500).json((0, shared_1.apiError)('DB_ERROR', insertError.message));
            return;
        }
        // Institutional audit log entry
        await supabase_1.supabaseAdmin.from('audit_log').insert({
            actor_id: userId,
            action: 'DELETION_REQUESTED',
            target_table: 'profiles',
            target_id: userId,
            details: {
                request_id: deletionRecord.id,
                reason,
                timestamp: new Date().toISOString(),
            },
        });
        res.status(201).json({
            data: {
                id: deletionRecord.id,
                status: 'pending',
                message: 'Account deletion request submitted. An administrator will review and purge your data within 7 days.',
                requested_at: deletionRecord.requested_at,
            },
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to submit deletion request'));
    }
});
