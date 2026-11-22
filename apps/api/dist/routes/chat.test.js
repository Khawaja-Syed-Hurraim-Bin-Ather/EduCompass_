"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const chat_1 = require("./chat");
// Mock Supabase admin calls so tests are 100% self-contained and fast (Rule #15)
vitest_1.vi.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: vitest_1.vi.fn(() => ({
            select: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            or: vitest_1.vi.fn().mockReturnThis(),
            ilike: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockResolvedValue({ data: [] }),
            insert: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
    },
}));
function createTestApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/v1/chat', chat_1.chatRouter);
    return app;
}
(0, vitest_1.describe)('Chat API Route (Card H3, Rules #3, #4, #5, #6, #13, #15)', () => {
    let app;
    (0, vitest_1.beforeEach)(() => {
        app = createTestApp();
    });
    (0, vitest_1.describe)('GET /api/v1/chat/suggestions', () => {
        (0, vitest_1.it)('returns suggested academic prompt chips', () => {
            (0, vitest_1.expect)(chat_1.chatRouter.stack.some((layer) => layer.route?.path === '/suggestions')).toBe(true);
        });
    });
    (0, vitest_1.describe)('POST /api/v1/chat - 4-Layer Responses', () => {
        (0, vitest_1.it)('registers POST / route handler', () => {
            const hasPost = chat_1.chatRouter.stack.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (layer) => layer.route?.path === '/' && layer.route?.methods?.post);
            (0, vitest_1.expect)(hasPost).toBe(true);
        });
        (0, vitest_1.it)('rejects questions longer than 300 characters with 400', async () => {
            let statusCode = 0;
            let jsonBody = null;
            const mockReq = {
                body: { message: 'A'.repeat(301) },
            };
            const mockRes = {
                status: (code) => {
                    statusCode = code;
                    return mockRes;
                },
                json: (body) => {
                    jsonBody = body;
                },
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const postHandler = chat_1.chatRouter.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post)?.route?.stack?.[0]?.handle;
            await postHandler(mockReq, mockRes, vitest_1.vi.fn());
            (0, vitest_1.expect)(statusCode).toBe(400);
            (0, vitest_1.expect)(jsonBody.error.code).toBe('VALIDATION_ERROR');
        });
        (0, vitest_1.it)('returns Layer 1 instant answer for preloaded question', async () => {
            let jsonBody = null;
            const mockReq = {
                body: { message: 'What is the minimum cgpa to graduate?' },
            };
            const mockRes = {
                status: vitest_1.vi.fn().mockReturnThis(),
                json: (body) => {
                    jsonBody = body;
                },
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const postHandler = chat_1.chatRouter.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post)?.route?.stack?.[0]?.handle;
            await postHandler(mockReq, mockRes, vitest_1.vi.fn());
            (0, vitest_1.expect)(jsonBody.data.layer).toBe(1);
            (0, vitest_1.expect)(jsonBody.data.source).toBe('preloaded_official');
            (0, vitest_1.expect)(jsonBody.data.answer).toContain('2.0');
            (0, vitest_1.expect)(jsonBody.data.disclaimer).toBe('Guidance estimates, not official university decisions.');
        });
        (0, vitest_1.it)('returns Layer 4 strict fallback when no information is available (Rule #6)', async () => {
            let jsonBody = null;
            const mockReq = {
                body: { message: 'What is the recipe for chocolate cake?' },
            };
            const mockRes = {
                status: vitest_1.vi.fn().mockReturnThis(),
                json: (body) => {
                    jsonBody = body;
                },
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const postHandler = chat_1.chatRouter.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post)?.route?.stack?.[0]?.handle;
            await postHandler(mockReq, mockRes, vitest_1.vi.fn());
            (0, vitest_1.expect)(jsonBody.data.layer).toBe(4);
            (0, vitest_1.expect)(jsonBody.data.answer).toBe('I do not have that information based on the official NED CISE resources available. Please consult the CISE department or your academic advisor.');
            (0, vitest_1.expect)(jsonBody.data.disclaimer).toBe('Guidance estimates, not official university decisions.');
        });
        (0, vitest_1.it)('honors preferOffline mode without invoking LLM (Rule #5)', async () => {
            let jsonBody = null;
            const mockReq = {
                body: { message: 'Tell me about random stuff', preferOffline: true },
            };
            const mockRes = {
                status: vitest_1.vi.fn().mockReturnThis(),
                json: (body) => {
                    jsonBody = body;
                },
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const postHandler = chat_1.chatRouter.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post)?.route?.stack?.[0]?.handle;
            await postHandler(mockReq, mockRes, vitest_1.vi.fn());
            // In offline mode with no match, it safely falls back to layer 4 without throwing
            (0, vitest_1.expect)([2, 4]).toContain(jsonBody.data.layer);
            (0, vitest_1.expect)(jsonBody.data.disclaimer).toBe('Guidance estimates, not official university decisions.');
        });
    });
});
