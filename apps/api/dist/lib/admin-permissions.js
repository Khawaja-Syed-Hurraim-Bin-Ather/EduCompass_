"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPermissionMatrix = loadPermissionMatrix;
exports.checkPermission = checkPermission;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cachedMatrix = null;
function loadPermissionMatrix() {
    if (cachedMatrix)
        return cachedMatrix;
    const candidatePaths = [
        path_1.default.resolve(process.cwd(), 'docs/admin/admin_permissions.json'),
        path_1.default.resolve(process.cwd(), 'docs/admin/admin_permissions (1).json'),
        path_1.default.resolve(__dirname, '../../../../docs/admin/admin_permissions.json'),
    ];
    for (const p of candidatePaths) {
        if (fs_1.default.existsSync(p)) {
            const raw = fs_1.default.readFileSync(p, 'utf8');
            cachedMatrix = JSON.parse(raw);
            return cachedMatrix;
        }
    }
    throw new Error('admin_permissions.json could not be loaded from docs/admin/');
}
/**
 * Checks whether an action is permitted based on the matrix and context.
 */
function checkPermission(resource, action, ctx) {
    const matrix = loadPermissionMatrix().matrix;
    const roleRules = matrix[ctx.role];
    if (!roleRules) {
        return { allowed: false, decision: 'deny', reason: `Unknown role: ${ctx.role}` };
    }
    const resourceRules = roleRules[resource];
    if (!resourceRules) {
        return { allowed: false, decision: 'deny', reason: `Unknown resource: ${resource}` };
    }
    const decision = resourceRules[action];
    if (!decision || decision === 'deny') {
        return {
            allowed: false,
            decision: 'deny',
            reason: `Action '${action}' on '${resource}' is not permitted for role '${ctx.role}'.`,
        };
    }
    if (decision === 'allow') {
        return { allowed: true, decision };
    }
    if (decision === 'allow_own_department') {
        if (ctx.role === 'vc')
            return { allowed: true, decision };
        if (ctx.userDepartmentId && ctx.targetDepartmentId && ctx.userDepartmentId === ctx.targetDepartmentId) {
            return { allowed: true, decision };
        }
        // If targetDepartmentId is not specified, scope query to user's department
        if (!ctx.targetDepartmentId) {
            return { allowed: true, decision };
        }
        return {
            allowed: false,
            decision,
            reason: `Access restricted to own department only (${ctx.userDepartmentId}).`,
        };
    }
    if (decision === 'allow_assigned_modules') {
        const modules = ctx.allowedModules || [];
        if (modules.includes(resource)) {
            return { allowed: true, decision };
        }
        return {
            allowed: false,
            decision,
            reason: `Module '${resource}' is not assigned to this operator. Assigned modules: ${modules.join(', ') || 'none'}.`,
        };
    }
    if (decision === 'allow_own_department_operators') {
        return { allowed: true, decision };
    }
    if (decision === 'minor_only_major_needs_vc') {
        if (ctx.impact === 'major') {
            return {
                allowed: false,
                decision: 'needs_vc_approval',
                reason: 'Major changes require Vice Chancellor approval.',
            };
        }
        return { allowed: true, decision };
    }
    if (decision === 'needs_approval' || decision === 'needs_vc_approval') {
        return {
            allowed: false,
            decision,
            reason: `Action requires approval (${decision === 'needs_vc_approval' ? 'Vice Chancellor' : 'Chairman'}).`,
        };
    }
    if (decision === 'own_submissions_only') {
        if (ctx.isOwnSubmission)
            return { allowed: true, decision };
        return {
            allowed: false,
            decision,
            reason: 'Operators may only view their own submissions.',
        };
    }
    if (decision === 'allow_after_cooling_off') {
        return { allowed: true, decision };
    }
    return { allowed: false, decision: 'deny', reason: 'Action not permitted.' };
}
