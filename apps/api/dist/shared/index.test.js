"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
(0, vitest_1.describe)('Shared API Schemas & Helpers', () => {
    (0, vitest_1.it)('formats an apiError correctly matching ErrorSchema', () => {
        const err = (0, index_1.apiError)('UNAUTHORIZED', 'Access denied', [{ field: 'role' }]);
        (0, vitest_1.expect)(err).toEqual({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Access denied',
                details: [{ field: 'role' }],
            },
        });
        (0, vitest_1.expect)(index_1.ErrorSchema.safeParse(err).success).toBe(true);
    });
    (0, vitest_1.it)('paginates collections correctly', () => {
        const items = [1, 2, 3];
        const res = (0, index_1.paginate)(items, 10, 1, 3);
        (0, vitest_1.expect)(res).toEqual({
            data: items,
            total: 10,
            page: 1,
            pageSize: 3,
            totalPages: 4,
        });
    });
    (0, vitest_1.it)('validates user roles strictly', () => {
        (0, vitest_1.expect)(index_1.UserRoleSchema.safeParse('public').success).toBe(true);
        (0, vitest_1.expect)(index_1.UserRoleSchema.safeParse('enrolled').success).toBe(true);
        (0, vitest_1.expect)(index_1.UserRoleSchema.safeParse('admin').success).toBe(true);
        (0, vitest_1.expect)(index_1.UserRoleSchema.safeParse('superadmin').success).toBe(false);
    });
});
