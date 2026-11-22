"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const faq_matcher_1 = require("./faq-matcher");
(0, vitest_1.describe)('FAQ Matcher & Preload System', () => {
    (0, vitest_1.describe)('1. Normalization & Roman Urdu Expansion', () => {
        (0, vitest_1.it)('normalizes uppercase and punctuation', () => {
            const result = (0, faq_matcher_1.normalizeText)('What are the Prerequisites of CS-218???');
            (0, vitest_1.expect)(result).toContain('prerequisite');
            (0, vitest_1.expect)(result).toContain('cs-218');
        });
        (0, vitest_1.it)('expands common academic abbreviations', () => {
            (0, vitest_1.expect)((0, faq_matcher_1.normalizeText)('when does fyp start')).toContain('final year project');
            (0, vitest_1.expect)((0, faq_matcher_1.normalizeText)('check my cgpa')).toContain('cumulative gpa');
            (0, vitest_1.expect)((0, faq_matcher_1.normalizeText)('what is the prereq of dsa')).toContain('data structures and algorithms');
        });
        (0, vitest_1.it)('translates Roman Urdu terms into academic intent keywords', () => {
            const urduQuery = 'cs-218 se pehle kya parhna zaroori hai';
            const normalized = (0, faq_matcher_1.normalizeText)(urduQuery);
            (0, vitest_1.expect)(normalized).toContain('before');
            (0, vitest_1.expect)(normalized).toContain('what');
            (0, vitest_1.expect)(normalized).toContain('study');
        });
    });
    (0, vitest_1.describe)('2. Slot Extraction', () => {
        (0, vitest_1.it)('extracts standardized course codes from various formats', () => {
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('prereq for cs 218').course).toBe('CS-218');
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('what unlocks mt-114').course).toBe('MT-114');
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('eligibility for data structures').course).toBe('CS-218');
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('can i take operating systems').course).toBe('CS-329');
        });
        (0, vitest_1.it)('extracts career tracks and academic domains', () => {
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('roadmap for machine learning').track).toBe('ai-ml-engineering');
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('best electives for frontend development').track).toBe('frontend-development');
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('jobs in cybersecurity').track).toBe('cybersecurity');
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('iot and embedded projects').track).toBe('embedded-iot');
        });
        (0, vitest_1.it)('extracts target CGPA and semester numbers', () => {
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('how to reach a cgpa of 3.50').target).toBe(3.50);
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('courses in semester 5').semester).toBe(5);
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('courses in 3rd semester').semester).toBe(3);
        });
        (0, vitest_1.it)('extracts degree programs', () => {
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('difference in cse vs cs').program).toBe('CSE');
            (0, vitest_1.expect)((0, faq_matcher_1.extractSlots)('curriculum for software engineering').program).toBe('SE');
        });
    });
    (0, vitest_1.describe)('3. Near-Miss Disambiguation (Section 4, Item 9)', () => {
        (0, vitest_1.it)('distinguishes D01 (prerequisite of X) vs D02 (what X unlocks) vs E02 (if I fail X)', () => {
            const qD01 = faq_matcher_1.faqMatcher.match('what are the prerequisites of CS-218');
            (0, vitest_1.expect)(qD01.intent?.id).toBe('D01');
            const qD02 = faq_matcher_1.faqMatcher.match('which courses does CS-115 unlock');
            (0, vitest_1.expect)(qD02.intent?.id).toBe('D02');
            const qE02 = faq_matcher_1.faqMatcher.match('if I fail CS-115 which courses will be blocked');
            (0, vitest_1.expect)(qE02.intent?.id).toBe('E02');
        });
        (0, vitest_1.it)('distinguishes E03 (can I take course X) vs E04 (what courses can I take)', () => {
            const qE03 = faq_matcher_1.faqMatcher.match('can I take CS-329 next semester', 'enrolled');
            (0, vitest_1.expect)(qE03.intent?.id).toBe('E03');
            const qE04 = faq_matcher_1.faqMatcher.match('what courses can I take next semester', 'enrolled');
            (0, vitest_1.expect)(qE04.intent?.id).toBe('E04');
        });
        (0, vitest_1.it)('distinguishes G01 (professors in AI) vs G02 (who is best professor in AI)', () => {
            const qG01 = faq_matcher_1.faqMatcher.match('which professors work on artificial intelligence', 'enrolled');
            (0, vitest_1.expect)(qG01.intent?.id).toBe('G01');
            const qG02 = faq_matcher_1.faqMatcher.match('who is the best professor for machine learning', 'enrolled');
            (0, vitest_1.expect)(qG02.intent?.id).toBe('G02');
            (0, vitest_1.expect)(qG02.intent?.answer_mode).toBe('guardrail');
        });
        (0, vitest_1.it)('distinguishes F05 (proposal accepted counts) vs F11 (what accepted proposals have in common)', () => {
            const qF05 = faq_matcher_1.faqMatcher.match('how many fyp proposals were accepted each year');
            (0, vitest_1.expect)(qF05.intent?.id).toBe('F05');
            const qF11 = faq_matcher_1.faqMatcher.match('what do accepted fyp proposals have in common');
            (0, vitest_1.expect)(qF11.intent?.id).toBe('F11');
        });
    });
    (0, vitest_1.describe)('4. Access Control & Role Checks', () => {
        (0, vitest_1.it)('returns login prompt when public user asks enrolled-only question', () => {
            const match = faq_matcher_1.faqMatcher.match('what are the prerequisites of CS-218', 'public');
            (0, vitest_1.expect)(match.status).toBe('direct_match');
            (0, vitest_1.expect)(match.publicBehaviour).toBe('login_prompt');
            (0, vitest_1.expect)(match.renderedAnswer).toContain('sign in with your NED university student credentials');
        });
        (0, vitest_1.it)('returns full answer when enrolled user asks enrolled-only question', () => {
            const match = faq_matcher_1.faqMatcher.match('what are the prerequisites of CS-218', 'enrolled');
            (0, vitest_1.expect)(match.status).toBe('direct_match');
            (0, vitest_1.expect)(match.publicBehaviour).toBe('answer');
            (0, vitest_1.expect)(match.renderedAnswer).toContain('CS-218');
        });
    });
    function resolveTestPath(fileName) {
        const candidates = [
            path_1.default.resolve(process.cwd(), 'docs/data/faq', fileName),
            path_1.default.resolve(process.cwd(), '../../docs/data/faq', fileName),
            path_1.default.resolve(__dirname, '../../../../docs/data/faq', fileName),
        ];
        for (const c of candidates) {
            if (fs_1.default.existsSync(c))
                return c;
        }
        return candidates[0];
    }
    (0, vitest_1.describe)('5. Privacy Scan Over Stored FAQ Answers', () => {
        (0, vitest_1.it)('verifies zero student names, roll numbers, or phone numbers in stored answers', () => {
            const answersPath = resolveTestPath('faq_answers.json');
            (0, vitest_1.expect)(fs_1.default.existsSync(answersPath)).toBe(true);
            const answers = JSON.parse(fs_1.default.readFileSync(answersPath, 'utf8'));
            const rollRegex = /\b\d{2}[A-Za-z]{2}\d{2,4}\b/;
            const phoneRegex = /(?:\+92|03)\d{2}[-\s]?\d{7}/;
            for (const item of answers) {
                (0, vitest_1.expect)(rollRegex.test(item.answer_template)).toBe(false);
                (0, vitest_1.expect)(phoneRegex.test(item.answer_template)).toBe(false);
                (0, vitest_1.expect)(item.answer_template).not.toContain('@student.neduet.edu.pk');
            }
        });
        (0, vitest_1.it)('verifies all 100 answers have valid source labels and related chips', () => {
            const answersPath = resolveTestPath('faq_answers.json');
            const answers = JSON.parse(fs_1.default.readFileSync(answersPath, 'utf8'));
            (0, vitest_1.expect)(answers.length).toBe(100);
            for (const item of answers) {
                (0, vitest_1.expect)(['database', 'roadmap']).toContain(item.source_type);
                (0, vitest_1.expect)(Array.isArray(item.related)).toBe(true);
                (0, vitest_1.expect)(item.related.length).toBeGreaterThanOrEqual(1);
            }
        });
    });
    (0, vitest_1.describe)('6. Held-Out Test Set Accuracy Benchmark', () => {
        (0, vitest_1.it)('answers over 85% of held-out test cases correctly without external network calls', () => {
            const testSetPath = resolveTestPath('faq_held_out_test_set.json');
            (0, vitest_1.expect)(fs_1.default.existsSync(testSetPath)).toBe(true);
            const testSet = JSON.parse(fs_1.default.readFileSync(testSetPath, 'utf8'));
            let correct = 0;
            for (const tc of testSet) {
                const match = faq_matcher_1.faqMatcher.match(tc.query, 'enrolled');
                if (match.intent?.id === tc.expected_intent) {
                    correct++;
                }
            }
            const accuracy = (correct / testSet.length) * 100;
            // Target per Section 7: at least 85% accuracy
            (0, vitest_1.expect)(accuracy).toBeGreaterThanOrEqual(85.0);
        });
    });
});
