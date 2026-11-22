"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.answerQuestion = answerQuestion;
// Mock implementation — used until the real gateway exists (H3)
async function answerQuestion(req, _user) {
    // Validate input length
    if (req.question.length > 300) {
        return {
            text: 'Please keep your question under 300 characters.',
            sourceType: 'preloaded',
            sources: [],
        };
    }
    // Mock responses for development
    const q = req.question.toLowerCase();
    if (q.includes('fyp') || q.includes('final year project')) {
        return {
            text: 'You can browse FYP projects in the FYP Portal. Use the search and filters to find projects by domain, supervisor, or technology stack.',
            sourceType: 'preloaded',
            sources: [{ title: 'FYP Portal', url: '/fyp' }],
        };
    }
    if (q.includes('prerequisite') || q.includes('course')) {
        return {
            text: 'Check the Prerequisite Explorer to see which courses you need before taking a specific course. It also shows what you might be blocking if you have a backlog.',
            sourceType: 'preloaded',
            sources: [{ title: 'Prerequisite Explorer', url: '/prerequisites' }],
        };
    }
    if (q.includes('professor') || q.includes('supervisor')) {
        return {
            text: 'Browse the Professor Directory to find supervisors whose research matches your interests. You can generate a personalised outreach email draft.',
            sourceType: 'preloaded',
            sources: [{ title: 'Professor Directory', url: '/professors' }],
        };
    }
    // Default: no context available
    return {
        text: 'I do not have that information. Please browse the relevant section of EduCompass or contact your department directly.',
        sourceType: 'preloaded',
        sources: [],
        fallbackReason: 'no_context',
    };
}
