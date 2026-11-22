"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const auth_1 = require("./auth");
// Mock supabaseAdmin
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        auth: {
            getUser: vitest_1.vi.fn(),
        },
        from: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)('Auth Middleware — requireRole', () => {
    (0, vitest_1.it)('returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
        const req = {
            headers: {},
        };
        const jsonMock = vitest_1.vi.fn();
        const statusMock = vitest_1.vi.fn().mockReturnValue({ json: jsonMock });
        const res = {
            status: statusMock,
        };
        const next = vitest_1.vi.fn();
        const middleware = (0, auth_1.requireRole)('enrolled');
        await middleware(req, res, next);
        (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(401);
        (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication token missing or invalid',
            },
        });
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('allows access when user has enrolled role and role enrolled is required', async () => {
        const req = {
            headers: { authorization: 'Bearer dummy-token' },
            user: {
                id: 'user-123',
                email: 'student@university.edu.pk',
                role: 'enrolled',
            },
        };
        const res = {};
        const next = vitest_1.vi.fn();
        const middleware = (0, auth_1.requireRole)('enrolled');
        await middleware(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)('returns 403 FORBIDDEN when user has enrolled role but admin role is required', async () => {
        const req = {
            headers: { authorization: 'Bearer dummy-token' },
            user: {
                id: 'user-123',
                email: 'student@university.edu.pk',
                role: 'enrolled',
            },
        };
        const jsonMock = vitest_1.vi.fn();
        const statusMock = vitest_1.vi.fn().mockReturnValue({ json: jsonMock });
        const res = {
            status: statusMock,
        };
        const next = vitest_1.vi.fn();
        const middleware = (0, auth_1.requireRole)('admin');
        await middleware(req, res, next);
        (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(403);
        (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({
            error: {
                code: 'FORBIDDEN',
                message: 'Access denied. Requires one of the following roles: [admin]',
            },
        });
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('allows admin access even when route only specifies enrolled role', async () => {
        const req = {
            headers: { authorization: 'Bearer dummy-token' },
            user: {
                id: 'admin-123',
                email: 'admin@university.edu.pk',
                role: 'admin',
            },
        };
        const res = {};
        const next = vitest_1.vi.fn();
        const middleware = (0, auth_1.requireRole)('enrolled');
        await middleware(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
});
