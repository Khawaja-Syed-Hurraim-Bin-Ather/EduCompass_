"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoleSchema = exports.PaginationSchema = exports.ErrorSchema = void 0;
exports.apiError = apiError;
exports.paginate = paginate;
const zod_1 = require("zod");
// ── Standard API response shapes ─────────────────────────────────
exports.ErrorSchema = zod_1.z.object({
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.array(zod_1.z.unknown()).optional(),
    }),
});
function apiError(code, message, details) {
    return { error: { code, message, ...(details ? { details } : {}) } };
}
// ── Pagination ───────────────────────────────────────────────────
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
function paginate(data, total, page, pageSize) {
    return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}
// ── User roles ───────────────────────────────────────────────────
exports.UserRoleSchema = zod_1.z.enum(['public', 'enrolled', 'admin']);
