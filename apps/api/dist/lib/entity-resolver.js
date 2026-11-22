"use strict";
/**
 * EduCompass Entity & Faculty Resolver
 * Source of truth: EDUCOMPASS_KB_EXPANSION_SPEC.md
 * Resolves faculty names, course codes, Roman Urdu queries, and stress detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectLanguage = detectLanguage;
exports.checkStress = checkStress;
exports.resolveFacultyQuery = resolveFacultyQuery;
const supabase_1 = require("./supabase");
// ─── Roman Urdu Normalizer & Detector ────────────────────────────────────────
const RU_MARKERS = new Set([
    'kya', 'kia', 'kyaa',
    'hai', 'hay', 'hy',
    'hain', 'hen', 'hyn',
    'mein', 'main', 'men',
    'kaise', 'kese', 'kaisay', 'kesay', 'kaisy',
    'kab', 'kub',
    'kahan', 'kahaan', 'kaha', 'kidhar',
    'kaun', 'kon', 'konsa', 'kounsa', 'konsay', 'kounse',
    'mujhe', 'mjhe', 'mujay', 'mujhey',
    'batao', 'bataen', 'bataein', 'batayein', 'bataiye',
    'parhna', 'parh', 'parhain',
    'chahiye', 'chahye', 'chahey',
    'hoga', 'hogi', 'honge', 'hoge',
    'karna', 'karo', 'karein',
    'seekhein', 'seekhna',
    'rukega', 'ruk', 'rok',
    'kitne', 'kitna', 'kitni',
    'kyun', 'kyu', 'q',
    'kuch', 'koi',
    'sirf', 'shuru', 'khatam',
    'pehlay', 'pehle', 'baad',
    'sath', 'walay', 'wali', 'wala',
    'tension', 'ghabra', 'dar', 'himmat'
]);
function detectLanguage(text) {
    if (!text)
        return 'en';
    // Strip punctuation and split into tokens
    const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const tokens = clean.split(/\s+/).filter(Boolean);
    let ruHits = 0;
    for (const t of tokens) {
        if (RU_MARKERS.has(t)) {
            ruHits++;
        }
    }
    // Token-based rule (Section 3 Bug F1): >=2 hits, or >=1 hit if short query (<=4 tokens)
    if (ruHits >= 2 || (tokens.length <= 4 && ruHits >= 1)) {
        return 'ru';
    }
    return 'en';
}
// ─── Stress Detection & Reassurance ──────────────────────────────────────────
const STRESS_REGEX = /\b(stress|stressed|panic|panicking|scared|dar lag|dar lagta|tension|ghabra|ghabrahat|failing everything|fail ho gaya|himmat|depressed|tired of this|khof|peryshan|pareshan)\b/i;
function checkStress(query, lang) {
    if (!STRESS_REGEX.test(query))
        return null;
    if (lang === 'ru') {
        return 'Hosla rakho! Engineering mein ups and downs aate hain, par har mushkil ka hal nikalta hai. Deep breath lo aur dekho:';
    }
    return 'Take a deep breath! Engineering challenges and tough semesters happen to everyone at NED, and students bounce back every single year. Here is the clear path forward:';
}
// ─── Faculty Cache & Fuzzy Matching ──────────────────────────────────────────
let facultyCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 60 seconds
async function getFacultyProfiles() {
    const now = Date.now();
    if (facultyCache && now - cacheTimestamp < CACHE_TTL_MS) {
        return facultyCache;
    }
    try {
        const { data } = await supabase_1.supabaseAdmin
            .from('professors')
            .select('name, title, rank, department, research_areas, domain_tags, highlights, review_status')
            .in('review_status', ['approved', 'published']);
        if (data && data.length > 0) {
            facultyCache = data;
            cacheTimestamp = now;
            return facultyCache;
        }
    }
    catch (err) {
        console.warn('[EntityResolver] Failed to fetch professors:', err);
    }
    return facultyCache || [];
}
function cleanPersonName(raw) {
    return raw
        .toLowerCase()
        .replace(/\b(dr|doctor|prof|professor|engr|engineer|mr|ms|mrs|syed)\b\.?/gi, '')
        .replace(/[^\w\s]/g, '')
        .trim();
}
/**
 * Trigram overlap similarity
 */
function trigramSim(a, b) {
    if (a === b)
        return 1.0;
    if (a.length < 2 || b.length < 2)
        return a.includes(b) || b.includes(a) ? 0.8 : 0;
    const setA = new Set();
    const setB = new Set();
    for (let i = 0; i < a.length - 2; i++)
        setA.add(a.slice(i, i + 3));
    for (let i = 0; i < b.length - 2; i++)
        setB.add(b.slice(i, i + 3));
    let inter = 0;
    for (const tri of setA)
        if (setB.has(tri))
            inter++;
    return (2 * inter) / (setA.size + setB.size);
}
async function resolveFacultyQuery(query) {
    const lower = query.toLowerCase();
    const isFacultyIntent = /\b(who is|tell me about|profile of|know about|research area|supervisor|dr|prof|professor)\b/i.test(query);
    if (!isFacultyIntent) {
        return { matched: false };
    }
    const profs = await getFacultyProfiles();
    if (!profs.length)
        return { matched: false };
    const cleanQuery = cleanPersonName(query);
    const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 3 && !['who', 'is', 'about', 'tell', 'the', 'his', 'her', 'know', 'can'].includes(w));
    if (!queryWords.length) {
        return { matched: false };
    }
    const scored = [];
    for (const p of profs) {
        const profClean = cleanPersonName(p.name);
        const profWords = profClean.split(/\s+/).filter(Boolean);
        let maxScore = 0;
        // Check exact word matches
        for (const qw of queryWords) {
            for (const pw of profWords) {
                if (qw === pw) {
                    maxScore = Math.max(maxScore, 1.0);
                }
                else if (pw.includes(qw) || qw.includes(pw)) {
                    maxScore = Math.max(maxScore, 0.85);
                }
                else {
                    // Trigram fuzzy match (e.g. "fakra" vs "fakhra")
                    const sim = trigramSim(qw, pw);
                    if (sim > 0.6) {
                        maxScore = Math.max(maxScore, sim);
                    }
                }
            }
        }
        if (maxScore >= 0.70) {
            scored.push({ prof: p, score: maxScore });
        }
    }
    scored.sort((a, b) => b.score - a.score);
    if (!scored.length) {
        return { matched: false };
    }
    // Check for ambiguity (e.g. "Dr. Ali" matching both Dr. Muhammad Ali and Dr. Muhammad Ali Ismail)
    if (scored.length > 1 && scored[0].score - scored[1].score < 0.05 && scored[0].score < 0.95) {
        const names = scored.slice(0, 3).map(s => s.prof.name).join(' or ');
        return {
            matched: true,
            ambiguous: scored.slice(0, 3).map(s => s.prof),
            renderedAnswer: `Did you mean ${names}? Please specify the full name so I can give you their exact research areas and supervisor profile.`,
        };
    }
    const best = scored[0].prof;
    const lang = detectLanguage(query);
    const areas = (best.research_areas || []).slice(0, 4).join(', ');
    const rank = best.rank || 'Faculty Member';
    const title = best.title || 'Dr.';
    const name = best.name.startsWith(title) ? best.name : `${title} ${best.name}`;
    let answer = '';
    if (lang === 'ru') {
        answer = `${name} NED University ke ${best.department || 'CISE'} department mein ${rank} hain. Unke main research domains mein ${areas} shamil hain.${best.highlights ? ` Khasosi focus: ${best.highlights}.` : ''} Outreach ke liye official email par project abstract ke sath rabta karein.`;
    }
    else {
        answer = `${name} is a ${rank} in the ${best.department || 'Computer & Information Systems Engineering (CISE)'} department at NED University. Key research areas include ${areas}.${best.highlights ? ` Notable focus: ${best.highlights}.` : ''} Students interested in supervision should contact via official NED email with their CV and project idea.`;
    }
    return {
        matched: true,
        professor: best,
        renderedAnswer: answer,
    };
}
