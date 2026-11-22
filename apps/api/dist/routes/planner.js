"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plannerRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const shared_1 = require("../shared");
const engine_1 = require("../engine");
const prereq_1 = require("./prereq");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../lib/supabase");
exports.plannerRouter = (0, express_1.Router)();
const curriculumGraph = (0, prereq_1.buildDefaultCurriculumGraph)();
// ─── Input Validation Schemas ─────────────────────────────────────────────────
const SlotSchema = zod_1.z.object({
    semesterNumber: zod_1.z.number().int().min(1).max(12),
    courseCodes: zod_1.z.array(zod_1.z.string().trim()),
});
const ValidatePlanSchema = zod_1.z.object({
    slots: zod_1.z.array(SlotSchema).min(1, 'Provide at least one semester slot'),
    priorCompletedCourses: zod_1.z.array(zod_1.z.string().trim()).optional().default([]),
    maxCreditsPerSemester: zod_1.z.number().int().min(12).max(25).optional().default(18),
    overloadLimit: zod_1.z.number().int().min(18).max(30).optional().default(21),
});
const SavePlanSchema = zod_1.z.object({
    planName: zod_1.z.string().trim().max(100).optional().default('My Degree Plan'),
    targetGraduationTerm: zod_1.z.string().trim().max(50).optional(),
    slots: zod_1.z.array(SlotSchema).min(1, 'Provide at least one semester slot'),
    notes: zod_1.z.string().trim().max(1000).optional(),
    maxCreditsPerSemester: zod_1.z.number().int().min(12).max(25).optional().default(18),
});
// ─── 1. GET /template ─────────────────────────────────────────────────────────
// Returns default 8-semester schedule template from verified NED CISE curriculum
exports.plannerRouter.get('/template', (_req, res) => {
    const defaultPlan = (0, engine_1.generateDefaultSchedulePlan)(curriculumGraph);
    const validation = (0, engine_1.validateSemesterPlan)(defaultPlan, curriculumGraph);
    const coursesList = Array.from(curriculumGraph.courses.values()).map((c) => ({
        code: c.code,
        title: c.title,
        credits: c.credits,
        theoryCredits: c.theoryCredits,
        practicalCredits: c.practicalCredits,
        semester: c.semester,
        category: c.category,
        isElective: c.isElective,
        electiveDomain: c.electiveDomain,
    }));
    res.json({
        program: 'BE Computer Systems Engineering (CISE), NED University',
        degreeTargetCredits: 136,
        defaultPlan,
        validation,
        courses: coursesList,
        disclaimer: 'Curriculum estimates based on NED CISE Scheme of Studies. Not an official university transcript.',
    });
});
// ─── 2. POST /validate ────────────────────────────────────────────────────────
// Validates a candidate multi-semester plan for prerequisite & workload constraints
exports.plannerRouter.post('/validate', (req, res) => {
    const parseResult = ValidatePlanSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid plan payload', parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }))));
        return;
    }
    const { slots, priorCompletedCourses, maxCreditsPerSemester, overloadLimit } = parseResult.data;
    const plan = {
        slots,
        priorCompletedCourses,
        maxCreditsPerSemester,
        overloadLimit,
    };
    const validationResult = (0, engine_1.validateSemesterPlan)(plan, curriculumGraph, 136);
    res.json({
        ...validationResult,
        disclaimer: 'Guidance estimate only. Registration is subject to official NED University prerequisite rules.',
    });
});
// ─── 3. GET /my-plan ──────────────────────────────────────────────────────────
// Retrieves the authenticated student's saved custom degree plan
exports.plannerRouter.get('/my-plan', (0, auth_1.requireRole)('enrolled'), async (req, res) => {
    const user = req.user;
    if (!user) {
        res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Authentication required'));
        return;
    }
    const { data, error } = await supabase_1.supabaseAdmin
        .from('student_custom_plans')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) {
        res.status(500).json((0, shared_1.apiError)('DATABASE_ERROR', 'Failed to retrieve saved plan'));
        return;
    }
    if (!data) {
        res.json({
            hasCustomPlan: false,
            plan: null,
            message: 'No custom plan saved yet. Use the default template to begin planning.',
        });
        return;
    }
    res.json({
        hasCustomPlan: true,
        plan: {
            id: data.id,
            planName: data.plan_name,
            targetGraduationTerm: data.target_graduation_term,
            maxCreditsPerSemester: data.max_credits_per_semester,
            slots: data.slots,
            notes: data.notes,
            isValid: data.is_valid,
            totalPlannedCredits: data.total_planned_credits,
            updatedAt: data.updated_at,
        },
        disclaimer: 'Guidance estimates only. Consult with your academic advisor before official enrollment.',
    });
});
// ─── 4. PUT /my-plan ──────────────────────────────────────────────────────────
// Upserts the authenticated student's custom degree plan
exports.plannerRouter.put('/my-plan', (0, auth_1.requireRole)('enrolled'), async (req, res) => {
    const user = req.user;
    if (!user) {
        res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Authentication required'));
        return;
    }
    const parseResult = SavePlanSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json((0, shared_1.apiError)('VALIDATION_ERROR', 'Invalid plan payload', parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }))));
        return;
    }
    const { planName, targetGraduationTerm, slots, notes, maxCreditsPerSemester } = parseResult.data;
    // Validate the plan before saving
    const plan = {
        slots,
        maxCreditsPerSemester,
    };
    const validation = (0, engine_1.validateSemesterPlan)(plan, curriculumGraph, 136);
    const { data, error } = await supabase_1.supabaseAdmin
        .from('student_custom_plans')
        .upsert({
        user_id: user.id,
        plan_name: planName,
        target_graduation_term: targetGraduationTerm ?? null,
        max_credits_per_semester: maxCreditsPerSemester,
        slots: slots,
        notes: notes ?? null,
        is_valid: validation.isValid,
        total_planned_credits: validation.totalCredits,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
        .select()
        .single();
    if (error) {
        res.status(500).json((0, shared_1.apiError)('DATABASE_ERROR', 'Failed to save student plan: ' + error.message));
        return;
    }
    res.json({
        success: true,
        message: 'Degree plan saved successfully',
        plan: {
            id: data.id,
            planName: data.plan_name,
            targetGraduationTerm: data.target_graduation_term,
            slots: data.slots,
            notes: data.notes,
            isValid: data.is_valid,
            totalPlannedCredits: data.total_planned_credits,
            updatedAt: data.updated_at,
        },
        validation,
        disclaimer: 'Guidance estimate only. Registration is subject to official NED University prerequisite rules.',
    });
});
