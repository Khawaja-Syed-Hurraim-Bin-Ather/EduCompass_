"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const shared_1 = require("../shared");
const supabase_1 = require("../lib/supabase");
/**
 * Extracts Bearer token, validates with Supabase Auth,
 * and fetches the role from public.profiles.
 */
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Authentication token missing or invalid'));
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (authError || !authData.user) {
            res.status(401).json((0, shared_1.apiError)('UNAUTHORIZED', 'Invalid or expired authentication session'));
            return;
        }
        const userId = authData.user.id;
        const email = authData.user.email ?? '';
        // Fetch profile role from public.profiles
        const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
        if (profileError) {
            res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', 'Failed to retrieve user profile data'));
            return;
        }
        const role = profile?.role ?? 'enrolled';
        req.user = {
            id: userId,
            email,
            role,
        };
        next();
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err instanceof Error ? err.message : 'Authentication verification error'));
    }
}
/**
 * Higher-order middleware enforcing role access: requireRole('enrolled' | 'admin')
 * Per AGENTS.md rule: requireRole('enrolled' | 'admin') helper on every protected route.
 */
function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        // Ensure authenticated first
        if (!req.user) {
            await authenticate(req, res, () => {
                if (!req.user)
                    return;
                verifyRole();
            });
        }
        else {
            verifyRole();
        }
        function verifyRole() {
            if (!req.user)
                return;
            // Admin has full access to enrolled routes as well
            const hasPermission = allowedRoles.includes(req.user.role) ||
                req.user.role === 'admin';
            if (!hasPermission) {
                res.status(403).json((0, shared_1.apiError)('FORBIDDEN', `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]`));
                return;
            }
            next();
        }
    };
}
