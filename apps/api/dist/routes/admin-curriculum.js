"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCurriculumRouter = void 0;
exports.validateCurriculumDraft = validateCurriculumDraft;
const express_1 = require("express");
const shared_1 = require("../shared");
const supabase_1 = require("../lib/supabase");
const admin_auth_1 = require("../middleware/admin-auth");
exports.adminCurriculumRouter = (0, express_1.Router)();
// Institutional admin authentication required
exports.adminCurriculumRouter.use(admin_auth_1.requireAdminAuth);
// ── Validation Logic (Pure TypeScript, Section 14 Test 5) ─────────────────────
function validateCurriculumDraft(input) {
    const errors = [];
    const warnings = [];
    const courseMap = new Map();
    const semesterCredits = new Map();
    for (const course of input.courses) {
        courseMap.set(course.code, course);
        const currentSemCreds = semesterCredits.get(course.semester) || 0;
        semesterCredits.set(course.semester, currentSemCreds + course.credits);
    }
    // 1. Grade Scale Validation
    if (input.gradeScale && input.passingGrade) {
        if (!(input.passingGrade in input.gradeScale)) {
            errors.push({
                code: 'INVALID_GRADE_SCALE',
                message: `Passing grade '${input.passingGrade}' is not defined in the version grade scale.`,
            });
        }
    }
    // 2. Semester Credit Limits
    for (const [semester, credits] of semesterCredits.entries()) {
        if (credits > input.maxCreditsPerSemester) {
            errors.push({
                code: 'CREDIT_LIMIT_EXCEEDED',
                message: `Semester ${semester} has ${credits} credits, which exceeds the maximum limit of ${input.maxCreditsPerSemester} credits.`,
                details: { semester, credits, max: input.maxCreditsPerSemester },
            });
        }
    }
    // 3. Backward Prerequisite Check (prerequisite in later or same semester)
    for (const rule of input.rules) {
        const course = courseMap.get(rule.courseCode);
        const prereq = courseMap.get(rule.prereqCourseCode);
        if (course && prereq) {
            if (course.semester <= prereq.semester) {
                errors.push({
                    code: 'BACKWARD_PREREQUISITE',
                    message: `Course ${course.code} (Semester ${course.semester}) requires ${prereq.code} (Semester ${prereq.semester}). Prerequisites must be taken in an earlier semester.`,
                    details: {
                        course: course.code,
                        courseSemester: course.semester,
                        prereq: prereq.code,
                        prereqSemester: prereq.semester,
                    },
                });
            }
        }
        else if (!prereq) {
            warnings.push({
                code: 'EXTERNAL_OR_UNSCHEDULED_PREREQ',
                message: `Prerequisite ${rule.prereqCourseCode} for ${rule.courseCode} is not listed in this curriculum version.`,
            });
        }
    }
    // 4. Circular Dependency Detection (DFS Cycle Detection)
    // Dependency graph: prereq -> course (prereq must precede course)
    const adj = new Map();
    for (const course of input.courses) {
        adj.set(course.code, []);
    }
    for (const rule of input.rules) {
        if (adj.has(rule.prereqCourseCode)) {
            adj.get(rule.prereqCourseCode).push(rule.courseCode);
        }
    }
    // Cycle detection: 0 = unvisited, 1 = visiting (on current stack), 2 = visited
    const visited = new Map();
    let hasCycle = false;
    const cycleNodes = [];
    function dfs(node, path) {
        visited.set(node, 1);
        path.push(node);
        const neighbors = adj.get(node) || [];
        for (const neighbor of neighbors) {
            const state = visited.get(neighbor) || 0;
            if (state === 1) {
                hasCycle = true;
                const cycleStartIndex = path.indexOf(neighbor);
                cycleNodes.push(...path.slice(cycleStartIndex), neighbor);
                return true;
            }
            if (state === 0) {
                if (dfs(neighbor, path))
                    return true;
            }
        }
        path.pop();
        visited.set(node, 2);
        return false;
    }
    for (const course of input.courses) {
        if ((visited.get(course.code) || 0) === 0) {
            if (dfs(course.code, []))
                break;
        }
    }
    if (hasCycle) {
        errors.push({
            code: 'CIRCULAR_DEPENDENCY',
            message: `Circular prerequisite dependency detected: ${cycleNodes.join(' → ')}`,
            details: { cycle: cycleNodes },
        });
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
// ── Middleware: Curriculum Access Protection ───────────────────────────────────
function requireCurriculumRole(req, res) {
    const admin = req.adminUser;
    if (!admin) {
        res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Admin authentication required'));
        return false;
    }
    // Operators have NO access to curriculum (admin_permissions.json: curriculum -> operator: none)
    if (admin.role === 'operator') {
        res.status(403).json((0, shared_1.apiError)('FORBIDDEN', 'Operators do not have permission to manage curriculum versions or prerequisites.', [
            { field: 'role', message: 'Requires Department Chairman or Vice Chancellor role.' },
        ]));
        return false;
    }
    return true;
}
// ── Routes ───────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/admin/curriculum/versions/:id/clone
 * Clones a published scheme into a new draft revision.
 */
exports.adminCurriculumRouter.post('/versions/:id/clone', async (req, res) => {
    if (!requireCurriculumRole(req, res))
        return;
    const { id } = req.params;
    const { name } = req.body || {};
    try {
        // 1. Fetch source version
        const { data: source, error: srcErr } = await supabase_1.supabaseAdmin
            .from('curriculum_versions')
            .select('*')
            .eq('id', id)
            .single();
        if (srcErr || !source) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', `Curriculum version '${id}' not found`));
            return;
        }
        // 2. Fetch latest revision number for this program
        const { data: latest } = await supabase_1.supabaseAdmin
            .from('curriculum_versions')
            .select('revision')
            .eq('program_id', source.program_id)
            .order('revision', { ascending: false })
            .limit(1)
            .maybeSingle();
        const nextRevision = (latest?.revision || source.revision || 1) + 1;
        const targetName = name || `${source.name} (Revision ${nextRevision})`;
        // 3. Create new draft version
        const { data: newVersion, error: createErr } = await supabase_1.supabaseAdmin
            .from('curriculum_versions')
            .insert({
            program_id: source.program_id,
            name: targetName,
            revision: nextRevision,
            status: 'draft',
            based_on: id,
            grade_scale: source.grade_scale,
            passing_grade: source.passing_grade,
            max_credits_per_semester: source.max_credits_per_semester,
            graduation_rules: source.graduation_rules,
            chart_layout: source.chart_layout,
        })
            .select('*')
            .single();
        if (createErr || !newVersion) {
            res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', 'Failed to clone curriculum version', [
                { field: 'curriculum_versions', message: createErr?.message || 'DB error' },
            ]));
            return;
        }
        // 4. Clone curriculum_courses
        const { data: courses } = await supabase_1.supabaseAdmin
            .from('curriculum_courses')
            .select('*')
            .eq('version_id', id);
        if (courses && courses.length > 0) {
            const clonedCourses = courses.map((c) => ({
                version_id: newVersion.id,
                course_id: c.course_id,
                semester: c.semester,
                credits: c.credits,
                theory_credits: c.theory_credits,
                practical_credits: c.practical_credits,
                category: c.category,
                is_elective: c.is_elective,
                elective_group_id: c.elective_group_id,
            }));
            await supabase_1.supabaseAdmin.from('curriculum_courses').insert(clonedCourses);
        }
        res.status(201).json({
            message: `Curriculum version cloned successfully as Revision ${nextRevision} (Draft)`,
            newVersion,
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error cloning curriculum version'));
    }
});
/**
 * POST /api/v1/admin/curriculum/versions/:id/validate
 * Validates a curriculum draft for cycles, backward prereqs, and credit overload.
 */
exports.adminCurriculumRouter.post('/versions/:id/validate', async (req, res) => {
    if (!requireCurriculumRole(req, res))
        return;
    const { id } = req.params;
    try {
        const { data: version, error: vErr } = await supabase_1.supabaseAdmin
            .from('curriculum_versions')
            .select('*')
            .eq('id', id)
            .single();
        if (vErr || !version) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', `Curriculum version '${id}' not found`));
            return;
        }
        // Fetch courses with course_master codes
        const { data: courses } = await supabase_1.supabaseAdmin
            .from('curriculum_courses')
            .select(`
        course_id,
        semester,
        credits,
        course:course_master(id, code, title, owner_department_id)
      `)
            .eq('version_id', id);
        // Fetch prerequisite rules
        const { data: rules } = await supabase_1.supabaseAdmin
            .from('prerequisite_rules')
            .select(`
        course_id,
        course_code,
        prereq_course_code,
        min_grade
      `);
        const courseInputs = (courses || []).map((c) => ({
            courseId: c.course_id,
            code: c.course?.code || 'UNKNOWN',
            semester: c.semester,
            credits: c.credits,
            ownerDepartmentId: c.course?.owner_department_id,
        }));
        const ruleInputs = (rules || []).map((r) => ({
            courseId: r.course_id,
            courseCode: r.course_code,
            prereqCourseCode: r.prereq_course_code,
            minGrade: r.min_grade,
        }));
        const result = validateCurriculumDraft({
            courses: courseInputs,
            rules: ruleInputs,
            maxCreditsPerSemester: version.max_credits_per_semester || 21,
            gradeScale: version.grade_scale || {},
            passingGrade: version.passing_grade || 'D',
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error validating curriculum'));
    }
});
/**
 * GET /api/v1/admin/curriculum/versions/:id/impact
 * Generates impact preview of a draft version compared to its base version.
 * Adheres to Section 12 (Aggregates only, zero student PII, small numbers suppressed).
 */
exports.adminCurriculumRouter.get('/versions/:id/impact', async (req, res) => {
    if (!requireCurriculumRole(req, res))
        return;
    const { id } = req.params;
    try {
        const { data: version, error: vErr } = await supabase_1.supabaseAdmin
            .from('curriculum_versions')
            .select('*')
            .eq('id', id)
            .single();
        if (vErr || !version) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', `Curriculum version '${id}' not found`));
            return;
        }
        const { data: currentCourses } = await supabase_1.supabaseAdmin
            .from('curriculum_courses')
            .select('course_id, semester, credits')
            .eq('version_id', id);
        let baseCourses = [];
        if (version.based_on) {
            const { data: bCourses } = await supabase_1.supabaseAdmin
                .from('curriculum_courses')
                .select('course_id, semester, credits')
                .eq('version_id', version.based_on);
            baseCourses = bCourses || [];
        }
        const currentMap = new Map((currentCourses || []).map((c) => [c.course_id, c]));
        const baseMap = new Map(baseCourses.map((c) => [c.course_id, c]));
        const added = [];
        const removed = [];
        const shifted = [];
        for (const [courseId, c] of currentMap.entries()) {
            if (!baseMap.has(courseId)) {
                added.push(courseId);
            }
            else {
                const base = baseMap.get(courseId);
                if (base.semester !== c.semester) {
                    shifted.push({ courseId, fromSemester: base.semester, toSemester: c.semester });
                }
            }
        }
        for (const [courseId] of baseMap.entries()) {
            if (!currentMap.has(courseId)) {
                removed.push(courseId);
            }
        }
        // Aggregate affected batches
        const { data: batches } = await supabase_1.supabaseAdmin
            .from('batches')
            .select('id, year, student_count')
            .eq('curriculum_version_id', version.based_on || id);
        const totalStudents = (batches || []).reduce((acc, b) => acc + (b.student_count || 0), 0);
        res.json({
            versionId: id,
            versionName: version.name,
            basedOn: version.based_on,
            diff: {
                coursesAddedCount: added.length,
                coursesRemovedCount: removed.length,
                coursesShiftedCount: shifted.length,
                shifted,
            },
            affectedBatches: (batches || []).map((b) => ({
                batchId: b.id,
                year: b.year,
                // Privacy: suppress small groups (<5)
                studentCountEstimate: b.student_count < 5 ? '<5' : b.student_count,
            })),
            totalEstimatedStudentsAffected: totalStudents < 5 ? '<5' : totalStudents,
            estimateNotice: 'Impact metrics are guidance estimates based on enrolled batch sizes (Rule 7).',
        });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message || 'Error generating impact preview'));
    }
});
/**
 * GET /api/v1/admin/curriculum/equivalences
 * List course equivalences.
 */
exports.adminCurriculumRouter.get('/equivalences', async (req, res) => {
    if (!requireCurriculumRole(req, res))
        return;
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('course_equivalences')
            .select('*')
            .range(0, 99);
        if (error) {
            res.status(500).json((0, shared_1.apiError)('DB_ERROR', error.message));
            return;
        }
        res.json({ data: data || [] });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err.message));
    }
});
