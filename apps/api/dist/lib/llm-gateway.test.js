"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const llm_gateway_1 = require("./llm-gateway");
(0, vitest_1.describe)('LLM Gateway (Rules #3, #4, #5, #14, #15)', () => {
    (0, vitest_1.describe)('PII Sanitizer (Rule #3)', () => {
        (0, vitest_1.it)('redacts email addresses', () => {
            const { clean, piiRemoved } = (0, llm_gateway_1.sanitizePromptText)('My email is student123@neduet.edu.pk, help me');
            (0, vitest_1.expect)(piiRemoved).toBe(true);
            (0, vitest_1.expect)(clean).toContain('[EMAIL REDACTED]');
            (0, vitest_1.expect)(clean).not.toContain('student123@neduet.edu.pk');
        });
        (0, vitest_1.it)('redacts student roll numbers', () => {
            const { clean, piiRemoved } = (0, llm_gateway_1.sanitizePromptText)('I am in CSE-042 and my roll is 21CS099');
            (0, vitest_1.expect)(piiRemoved).toBe(true);
            (0, vitest_1.expect)(clean).toContain('[STUDENT ID REDACTED]');
            (0, vitest_1.expect)(clean).not.toContain('21CS099');
        });
        (0, vitest_1.it)('passes clean academic queries without alteration', () => {
            const { clean, piiRemoved } = (0, llm_gateway_1.sanitizePromptText)('What are the prerequisites for Database Management Systems?');
            (0, vitest_1.expect)(piiRemoved).toBe(false);
            (0, vitest_1.expect)(clean).toBe('What are the prerequisites for Database Management Systems?');
        });
    });
    (0, vitest_1.describe)('Hard Caps & Limits (Rule #4)', () => {
        (0, vitest_1.it)('enforces maximum input characters cap of 300', async () => {
            const longQuestion = 'A'.repeat(301);
            await (0, vitest_1.expect)((0, llm_gateway_1.generateChatResponse)({
                question: longQuestion,
                context: 'Some context',
            })).rejects.toThrow('INPUT_TOO_LONG');
        });
        (0, vitest_1.it)('has configured limits conforming to SRS specifications', () => {
            (0, vitest_1.expect)(llm_gateway_1.LLM_CONFIG.maxInputChars).toBe(300);
            (0, vitest_1.expect)(llm_gateway_1.LLM_CONFIG.maxOutputTokens).toBe(500);
            (0, vitest_1.expect)(llm_gateway_1.LLM_CONFIG.userDailyLimit).toBe(20);
            (0, vitest_1.expect)(llm_gateway_1.LLM_CONFIG.globalDailyBudget).toBe(100);
        });
    });
    (0, vitest_1.describe)('Test Mocking (Rule #15)', () => {
        (0, vitest_1.it)('returns mock response in test environment without calling live APIs', async () => {
            const res = await (0, llm_gateway_1.generateChatResponse)({
                question: 'What is the passing grade at NED?',
                context: 'The passing grade is D (1.0).',
            });
            (0, vitest_1.expect)(res.provider).toBe('mock');
            (0, vitest_1.expect)(res.answer).toContain('[MOCK_RESPONSE]');
            (0, vitest_1.expect)(res.tokensIn).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('returns mock embedding vector in test environment', async () => {
            const embedding = await (0, llm_gateway_1.getEmbedding)('Computer Science course query');
            (0, vitest_1.expect)(embedding).toHaveLength(768);
        });
    });
});
