"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load env robustly
for (const envPath of [
    path_1.default.resolve(process.cwd(), 'apps/api/.env.local'),
    path_1.default.resolve(process.cwd(), '.env.local'),
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(__dirname, '../.env.local'),
    path_1.default.resolve(__dirname, '../../.env'),
]) {
    if (fs_1.default.existsSync(envPath)) {
        dotenv_1.default.config({ path: envPath });
    }
}
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const security_1 = require("./middleware/security");
const app = (0, express_1.default)();
const PORT = process.env.API_PORT || 4000;
// ── F6: Security middleware stack ────────────────────────────────────────
// 1. Helmet: sets many secure HTTP headers (X-DNS-Prefetch, X-XSS-Protection, etc.)
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // CSP is set in Next.js next.config.js for the web app
}));
// 2. CORS: strict allow-list
app.use((0, cors_1.default)({
    origin: security_1.corsOriginValidator,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // preflight cache 24h
}));
// 3. Request body size limit — 10kb prevents large payload DoS
app.use(express_1.default.json({ limit: '10kb' }));
app.use((0, cookie_parser_1.default)());
// 4. Request sanitizer — strip null bytes and control chars (Rule #14)
app.use(security_1.requestSanitizer);
// 5. Security event logger — no secrets ever logged (Rule #11)
app.use(security_1.securityLogger);
// ── Root & Health checks (not rate-limited) ─────────────────────────────
app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'educompass-api',
        version: '1.0.0',
        message: 'EduCompass CISE Backend API is running.',
        health: '/health',
    });
});
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'educompass-api',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
// ── Routers ──────────────────────────────────────────────────────────────
const account_1 = require("./routes/account");
const fyp_1 = require("./routes/fyp");
const careers_1 = require("./routes/careers");
const admin_1 = require("./routes/admin");
const chat_1 = require("./routes/chat");
const prereq_1 = require("./routes/prereq");
const professors_1 = require("./routes/professors");
const planner_1 = require("./routes/planner");
const batches_1 = require("./routes/batches");
const curriculum_1 = require("./routes/curriculum");
const admin_auth_1 = require("./routes/admin-auth");
const workflow_1 = require("./routes/workflow");
const admin_content_1 = require("./routes/admin-content");
const admin_curriculum_1 = require("./routes/admin-curriculum");
const releases_jobs_1 = require("./routes/releases-jobs");
const deletions_1 = require("./routes/deletions");
const health_report_1 = require("./routes/health-report");
// ── API v1 health (read limiter) ─────────────────────────────────────────
app.get('/api/v1/health', security_1.readLimiter, (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});
// Auth routes — strictest rate limit
app.use('/api/v1/account', security_1.authRateLimiter, account_1.accountRouter);
// LLM/AI routes — chat-specific limiter
app.use('/api/v1/chat', security_1.chatRateLimiter, chat_1.chatRouter);
// Admin — write limiter (protected by requireRole('admin') inside router)
app.use('/api/v1/admin/auth', security_1.authRateLimiter, admin_auth_1.adminAuthRouter);
app.use('/api/v1/admin/content', security_1.writeLimiter, admin_content_1.adminContentRouter);
app.use('/api/v1/admin/curriculum', security_1.writeLimiter, admin_curriculum_1.adminCurriculumRouter);
app.use('/api/v1/admin/deletions', security_1.writeLimiter, deletions_1.deletionsRouter);
app.use('/api/v1/admin/health', security_1.writeLimiter, health_report_1.healthReportRouter);
app.use('/api/v1/admin', security_1.writeLimiter, releases_jobs_1.releasesJobsRouter);
app.use('/api/v1/admin', security_1.writeLimiter, workflow_1.workflowRouter);
app.use('/api/v1/admin', security_1.writeLimiter, admin_1.adminRouter);
// Read-heavy routes — generous limiter
app.use('/api/v1/fyp', security_1.readLimiter, fyp_1.fypRouter);
app.use('/api/v1/careers', security_1.readLimiter, careers_1.careersRouter);
app.use('/api/v1/prereq', security_1.readLimiter, prereq_1.prereqRouter);
app.use('/api/v1/professors', security_1.readLimiter, professors_1.professorsRouter);
app.use('/api/v1/planner', security_1.readLimiter, planner_1.plannerRouter);
app.use('/api/v1/batches', security_1.readLimiter, batches_1.batchesRouter);
app.use('/api/v1/curriculum', security_1.readLimiter, curriculum_1.curriculumRouter);
// ── 404 handler ──────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
});
// ── F6: Centralised error sanitizer — strips stack traces in prod ─────────
app.use(security_1.errorSanitizer);
// ── Start ────────────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log(`✅  EduCompass API v1.0 running on http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/health`);
        console.log(`   Security: helmet ✓ | CORS allow-list ✓ | rate-limits ✓ | sanitizer ✓`);
        // Bootstrap initial admin accounts (VC + Chairman)
        try {
            await (0, admin_auth_1.bootstrapAdminAccounts)();
        }
        catch (err) {
            console.error('Failed to bootstrap admin accounts:', err);
        }
    });
}
exports.default = app;
