"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const admin_permissions_1 = require("./admin-permissions");
(0, vitest_1.describe)('Admin Governance & Permission Matrix (admin_permissions.json)', () => {
    let matrix;
    (0, vitest_1.beforeAll)(() => {
        matrix = (0, admin_permissions_1.loadPermissionMatrix)();
    });
    (0, vitest_1.it)('loads valid permission matrix matching schema_version 1', () => {
        (0, vitest_1.expect)(matrix.schema_version).toBe(1);
        (0, vitest_1.expect)(matrix.roles).toContain('vc');
        (0, vitest_1.expect)(matrix.roles).toContain('chairman');
        (0, vitest_1.expect)(matrix.roles).toContain('operator');
        (0, vitest_1.expect)(matrix.resources).toContain('curriculum');
        (0, vitest_1.expect)(matrix.resources).toContain('fyp');
        (0, vitest_1.expect)(matrix.resources).toContain('chatbot_settings');
    });
    // VC Permissions
    (0, vitest_1.describe)('Vice Chancellor (vc) permissions', () => {
        (0, vitest_1.it)('allows VC full view and draft on curriculum', () => {
            const viewCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'view', { role: 'vc' });
            (0, vitest_1.expect)(viewCheck.allowed).toBe(true);
            const draftCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'draft', { role: 'vc' });
            (0, vitest_1.expect)(draftCheck.allowed).toBe(true);
            const pubCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'publish', { role: 'vc' });
            (0, vitest_1.expect)(pubCheck.allowed).toBe(true);
        });
        (0, vitest_1.it)('allows VC to configure chatbot_settings', () => {
            const pubCheck = (0, admin_permissions_1.checkPermission)('chatbot_settings', 'publish', { role: 'vc' });
            (0, vitest_1.expect)(pubCheck.allowed).toBe(true);
        });
        (0, vitest_1.it)('denies VC drafting student deletion requests directly', () => {
            const draftCheck = (0, admin_permissions_1.checkPermission)('student_deletion_requests', 'draft', { role: 'vc' });
            (0, vitest_1.expect)(draftCheck.allowed).toBe(false);
            (0, vitest_1.expect)(draftCheck.decision).toBe('deny');
        });
        (0, vitest_1.it)('allows VC purging records after cooling off', () => {
            const purgeCheck = (0, admin_permissions_1.checkPermission)('fyp', 'purge', { role: 'vc' });
            (0, vitest_1.expect)(purgeCheck.allowed).toBe(true);
            (0, vitest_1.expect)(purgeCheck.decision).toBe('allow_after_cooling_off');
        });
    });
    // Chairman Permissions
    (0, vitest_1.describe)('Department Chairman (chairman) permissions', () => {
        const cisDept = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const eeDept = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
        (0, vitest_1.it)('allows chairman to view and draft in own department', () => {
            const ownCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'view', {
                role: 'chairman',
                userDepartmentId: cisDept,
                targetDepartmentId: cisDept,
            });
            (0, vitest_1.expect)(ownCheck.allowed).toBe(true);
        });
        (0, vitest_1.it)('strictly denies chairman acting on another department', () => {
            const otherCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'view', {
                role: 'chairman',
                userDepartmentId: cisDept,
                targetDepartmentId: eeDept,
            });
            (0, vitest_1.expect)(otherCheck.allowed).toBe(false);
        });
        (0, vitest_1.it)('allows chairman publishing minor curriculum changes directly', () => {
            const minorCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'publish', {
                role: 'chairman',
                userDepartmentId: cisDept,
                targetDepartmentId: cisDept,
                impact: 'minor',
            });
            (0, vitest_1.expect)(minorCheck.allowed).toBe(true);
        });
        (0, vitest_1.it)('routes major curriculum changes to Vice Chancellor approval', () => {
            const majorCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'publish', {
                role: 'chairman',
                userDepartmentId: cisDept,
                targetDepartmentId: cisDept,
                impact: 'major',
            });
            (0, vitest_1.expect)(majorCheck.allowed).toBe(false);
            (0, vitest_1.expect)(majorCheck.decision).toBe('needs_vc_approval');
        });
        (0, vitest_1.it)('denies chairman accessing chatbot_settings or university departments', () => {
            const csCheck = (0, admin_permissions_1.checkPermission)('chatbot_settings', 'view', { role: 'chairman' });
            (0, vitest_1.expect)(csCheck.allowed).toBe(false);
            (0, vitest_1.expect)(csCheck.decision).toBe('deny');
            const deptCheck = (0, admin_permissions_1.checkPermission)('departments', 'view', { role: 'chairman' });
            (0, vitest_1.expect)(deptCheck.allowed).toBe(false);
            (0, vitest_1.expect)(deptCheck.decision).toBe('deny');
        });
        (0, vitest_1.it)('denies chairman purging live records', () => {
            const purgeCheck = (0, admin_permissions_1.checkPermission)('fyp', 'purge', { role: 'chairman' });
            (0, vitest_1.expect)(purgeCheck.allowed).toBe(false);
            (0, vitest_1.expect)(purgeCheck.decision).toBe('deny');
        });
    });
    // Operator Permissions
    (0, vitest_1.describe)('Data-Entry Operator (operator) permissions', () => {
        (0, vitest_1.it)('strictly denies operator any access to curriculum', () => {
            const viewCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'view', { role: 'operator' });
            (0, vitest_1.expect)(viewCheck.allowed).toBe(false);
            (0, vitest_1.expect)(viewCheck.decision).toBe('deny');
            const draftCheck = (0, admin_permissions_1.checkPermission)('curriculum', 'draft', { role: 'operator' });
            (0, vitest_1.expect)(draftCheck.allowed).toBe(false);
            (0, vitest_1.expect)(draftCheck.decision).toBe('deny');
        });
        (0, vitest_1.it)('allows operator drafting only on assigned modules', () => {
            const assignedCheck = (0, admin_permissions_1.checkPermission)('fyp', 'draft', {
                role: 'operator',
                allowedModules: ['fyp', 'professors'],
            });
            (0, vitest_1.expect)(assignedCheck.allowed).toBe(true);
            const unassignedCheck = (0, admin_permissions_1.checkPermission)('career', 'draft', {
                role: 'operator',
                allowedModules: ['fyp', 'professors'],
            });
            (0, vitest_1.expect)(unassignedCheck.allowed).toBe(false);
            (0, vitest_1.expect)(unassignedCheck.decision).toBe('allow_assigned_modules');
        });
        (0, vitest_1.it)('denies operator direct publish — always requires approval', () => {
            const pubCheck = (0, admin_permissions_1.checkPermission)('fyp', 'publish', {
                role: 'operator',
                allowedModules: ['fyp'],
            });
            (0, vitest_1.expect)(pubCheck.allowed).toBe(false);
            (0, vitest_1.expect)(pubCheck.decision).toBe('deny');
        });
        (0, vitest_1.it)('allows operator requesting deletion through approval flow only', () => {
            const delCheck = (0, admin_permissions_1.checkPermission)('fyp', 'request_delete', {
                role: 'operator',
                allowedModules: ['fyp'],
            });
            (0, vitest_1.expect)(delCheck.allowed).toBe(false);
            (0, vitest_1.expect)(delCheck.decision).toBe('needs_approval');
        });
        (0, vitest_1.it)('restricts operator history to own submissions only', () => {
            const ownHist = (0, admin_permissions_1.checkPermission)('fyp', 'view_history', {
                role: 'operator',
                allowedModules: ['fyp'],
                isOwnSubmission: true,
            });
            (0, vitest_1.expect)(ownHist.allowed).toBe(true);
            const otherHist = (0, admin_permissions_1.checkPermission)('fyp', 'view_history', {
                role: 'operator',
                allowedModules: ['fyp'],
                isOwnSubmission: false,
            });
            (0, vitest_1.expect)(otherHist.allowed).toBe(false);
            (0, vitest_1.expect)(otherHist.decision).toBe('own_submissions_only');
        });
    });
});
