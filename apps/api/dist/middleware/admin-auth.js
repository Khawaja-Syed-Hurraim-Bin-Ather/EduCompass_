"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_JWT_SECRET = void 0;
exports.requireAdminAuth = requireAdminAuth;
exports.requireAdminPermission = requireAdminPermission;
exports.requireStepUp = requireStepUp;
exports.hashAuditIdentifier = hashAuditIdentifier;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const shared_1 = require("../shared");
const admin_permissions_1 = require("../lib/admin-permissions");
exports.ADMIN_JWT_SECRET = process.env.NEXTAUTH_SECRET || 'educompass-admin-secret-2026';
/**
 * Validates the admin session token from header or cookie.
 */
async function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    }
    else if (req.cookies?.['educompass_admin_token']) {
        token = req.cookies['educompass_admin_token'];
    }
    if (!token) {
        res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Admin session token required.'));
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, exports.ADMIN_JWT_SECRET);
        // Check 8-hour absolute timeout (Section 6.4)
        const now = Date.now();
        if (now - payload.sessionStartedAt > 8 * 60 * 60 * 1000) {
            res.status(401).json((0, shared_1.apiError)('SESSION_EXPIRED', 'Session absolute timeout reached (8 hours). Please sign in again.'));
            return;
        }
        req.adminUser = {
            adminId: payload.adminId,
            email: payload.email,
            role: payload.role,
            departmentId: payload.departmentId,
            allowedModules: payload.allowedModules || [],
        };
        next();
    }
    catch (err) {
        res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Invalid or expired admin session token.'));
    }
}
/**
 * Helper to enforce permission matrix dynamically.
 */
function requireAdminPermission(resource, action) {
    return async (req, res, next) => {
        if (!req.adminUser) {
            res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Admin authentication required.'));
            return;
        }
        const { role, departmentId, allowedModules } = req.adminUser;
        const targetDept = (req.query.departmentId || req.body?.departmentId);
        const check = (0, admin_permissions_1.checkPermission)(resource, action, {
            role,
            userDepartmentId: departmentId,
            targetDepartmentId: targetDept,
            allowedModules,
            impact: req.body?.impact || 'minor',
        });
        if (!check.allowed) {
            res.status(403).json((0, shared_1.apiError)('FORBIDDEN', check.reason || 'Permission denied by institutional governance matrix.', [
                { field: resource, message: `Role: ${role}, Action: ${action}, Decision: ${check.decision}` },
            ]));
            return;
        }
        next();
    };
}
/**
 * Step-Up verification check: ensures a fresh verification code was verified in last 5 minutes.
 */
async function requireStepUp(req, res, next) {
    if (!req.adminUser) {
        res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Admin session required.'));
        return;
    }
    const stepUpHeader = req.headers['x-admin-step-up-token'];
    if (!stepUpHeader) {
        res.status(403).json((0, shared_1.apiError)('STEP_UP_REQUIRED', 'Step-up verification required. Please verify fresh one-time code to proceed.'));
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(stepUpHeader, exports.ADMIN_JWT_SECRET);
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - payload.verifiedAt > fiveMinutes || payload.adminId !== req.adminUser.adminId) {
            res.status(403).json((0, shared_1.apiError)('STEP_UP_EXPIRED', 'Step-up verification token expired (valid 5 minutes).'));
            return;
        }
        next();
    }
    catch (_) {
        res.status(403).json((0, shared_1.apiError)('STEP_UP_INVALID', 'Invalid step-up verification token.'));
    }
}
/**
 * Helper to hash email/IP for secure audit logging (Section 6.4).
 */
function hashAuditIdentifier(val) {
    return crypto_1.default.createHash('sha256').update(val.toLowerCase().trim()).digest('hex');
}
