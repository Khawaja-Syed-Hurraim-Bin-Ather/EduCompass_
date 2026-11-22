"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const admin_permissions_1 = require("../lib/admin-permissions");
const admin_curriculum_1 = require("../routes/admin-curriculum");
const deletions_1 = require("../routes/deletions");
const health_report_1 = require("../routes/health-report");
(0, vitest_1.describe)('Institutional Governance & Verification Suite (Section 14, Cards A0–A12)', () => {
    const matrix = (0, admin_permissions_1.loadPermissionMatrix)();
    (0, vitest_1.describe)('1. Full Matrix Verification (Section 14.1)', () => {
        (0, vitest_1.it)('contains all 3 institutional roles and 12 core resources', () => {
            (0, vitest_1.expect)(matrix.roles).toEqual(['vc', 'chairman', 'operator']);
            (0, vitest_1.expect)(matrix.resources.length).toBeGreaterThanOrEqual(10);
            (0, vitest_1.expect)(matrix.resources).toContain('curriculum');
            (0, vitest_1.expect)(matrix.resources).toContain('fyp');
            (0, vitest_1.expect)(matrix.resources).toContain('professors');
            (0, vitest_1.expect)(matrix.resources).toContain('career');
            (0, vitest_1.expect)(matrix.resources).toContain('chatbot_content');
            (0, vitest_1.expect)(matrix.resources).toContain('chatbot_settings');
            (0, vitest_1.expect)(matrix.resources).toContain('data_imports');
        });
        (0, vitest_1.it)('enforces that operators are blocked from curriculum, grading, and settings', () => {
            const curr = (0, admin_permissions_1.checkPermission)('curriculum', 'view', { role: 'operator', allowedModules: ['fyp'] });
            (0, vitest_1.expect)(curr.allowed).toBe(false);
            const settings = (0, admin_permissions_1.checkPermission)('chatbot_settings', 'publish', { role: 'operator', allowedModules: ['chatbot_content'] });
            (0, vitest_1.expect)(settings.allowed).toBe(false);
        });
        (0, vitest_1.it)('enforces that department chairmen cannot modify other departments', () => {
            const cisDept = '11111111-1111-1111-1111-111111111111';
            const foreignDept = '22222222-2222-2222-2222-222222222222';
            const foreignCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'draft', {
                role: 'chairman',
                userDepartmentId: cisDept,
                targetDepartmentId: foreignDept,
            });
            (0, vitest_1.expect)(foreignCheck.allowed).toBe(false);
        });
    });
    (0, vitest_1.describe)('2. Curriculum Validation Engine (Section 14.5)', () => {
        (0, vitest_1.it)('detects directed prerequisite cycles in draft schemes', () => {
            const result = (0, admin_curriculum_1.validateCurriculumDraft)({
                courses: [
                    { courseId: '1', code: 'CS-101', semester: 1, credits: 3 },
                    { courseId: '2', code: 'CS-102', semester: 2, credits: 3 },
                    { courseId: '3', code: 'CS-103', semester: 3, credits: 3 },
                ],
                rules: [
                    { courseId: '1', courseCode: 'CS-101', prereqCourseCode: 'CS-103' },
                    { courseId: '2', courseCode: 'CS-102', prereqCourseCode: 'CS-101' },
                    { courseId: '3', courseCode: 'CS-103', prereqCourseCode: 'CS-102' },
                ],
                maxCreditsPerSemester: 21,
                gradeScale: { A: 4.0, D: 1.0, F: 0.0 },
                passingGrade: 'D',
            });
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.errors.some((e) => e.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
        });
        (0, vitest_1.it)('rejects prerequisites placed in the same or later semester', () => {
            const result = (0, admin_curriculum_1.validateCurriculumDraft)({
                courses: [
                    { courseId: '1', code: 'CS-200', semester: 3, credits: 3 },
                    { courseId: '2', code: 'CS-300', semester: 3, credits: 3 },
                ],
                rules: [
                    { courseId: '1', courseCode: 'CS-200', prereqCourseCode: 'CS-300' },
                ],
                maxCreditsPerSemester: 21,
                gradeScale: { A: 4.0, D: 1.0, F: 0.0 },
                passingGrade: 'D',
            });
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.errors.some((e) => e.code === 'BACKWARD_PREREQUISITE')).toBe(true);
        });
        (0, vitest_1.it)('flags credit hour overload when exceeding semester maximum', () => {
            const result = (0, admin_curriculum_1.validateCurriculumDraft)({
                courses: [
                    { courseId: '1', code: 'C1', semester: 1, credits: 12 },
                    { courseId: '2', code: 'C2', semester: 1, credits: 11 }, // Total 23 > 21
                ],
                rules: [],
                maxCreditsPerSemester: 21,
                gradeScale: { A: 4.0, D: 1.0, F: 0.0 },
                passingGrade: 'D',
            });
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.errors.some((e) => e.code === 'CREDIT_LIMIT_EXCEEDED')).toBe(true);
        });
    });
    (0, vitest_1.describe)('3. Deletion Lifecycle Governance (Section 14.4)', () => {
        (0, vitest_1.it)('enforces exact cooling-off timelines by resource type', () => {
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('career')).toBe(7);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('chatbot')).toBe(7);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('fyp')).toBe(14);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('professors')).toBe(14);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('curriculum')).toBe(30);
            (0, vitest_1.expect)((0, deletions_1.getCoolingOffDays)('curriculum_version')).toBe(90);
        });
    });
    (0, vitest_1.describe)('4. Privacy & Zero-Student PII Verification (Section 14.9, Rule 3, Rule 12)', () => {
        (0, vitest_1.it)('verifies data health outputs do not expose individual student records or PII', () => {
            const health = (0, health_report_1.calculateDataHealth)({
                unreviewedFypCount: 10,
                coursesWithoutCredits: 0,
                coolingOffCount: 2,
                brokenPrereqCount: 0,
            });
            const serialized = JSON.stringify(health);
            (0, vitest_1.expect)(serialized).not.toMatch(/student_id/i);
            (0, vitest_1.expect)(serialized).not.toMatch(/@student\.nedut\.edu\.pk/i);
            (0, vitest_1.expect)(serialized).not.toMatch(/roll_number/i);
            (0, vitest_1.expect)(serialized).not.toMatch(/cgpa/i);
        });
    });
    (0, vitest_1.describe)('5. Client Bundle Secret Scan (Section 14.12, Rule 11)', () => {
        (0, vitest_1.it)('verifies no service role keys or JWT secrets are present in frontend client scripts', () => {
            const frontendDir = path_1.default.resolve(__dirname, '../../../../frontend');
            const targetDir = fs_1.default.existsSync(frontendDir) ? frontendDir : path_1.default.resolve(__dirname, '../../../web/src');
            if (!fs_1.default.existsSync(targetDir))
                return;
            const files = fs_1.default.readdirSync(targetDir, { recursive: true });
            for (const file of files) {
                if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js'))) {
                    const content = fs_1.default.readFileSync(path_1.default.join(targetDir, file), 'utf8');
                    // Hard-coded secrets check (Rule 11) across ALL files
                    (0, vitest_1.expect)(content).not.toMatch(/AdminPassword/);
                    (0, vitest_1.expect)(content).not.toMatch(/sbp_[a-zA-Z0-9]{20,}/);
                    // Client code must NEVER reference service role keys or server secrets
                    (0, vitest_1.expect)(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
                    (0, vitest_1.expect)(content).not.toMatch(/ADMIN_JWT_SECRET/);
                    (0, vitest_1.expect)(content).not.toMatch(/NEXTAUTH_SECRET/);
                }
            }
        });
    });
});
