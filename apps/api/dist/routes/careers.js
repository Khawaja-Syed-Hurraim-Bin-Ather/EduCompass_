"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.careersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const shared_1 = require("../shared");
const supabase_1 = require("../lib/supabase");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TracksData = require('../../../../docs/data/career_tracks.json');
exports.careersRouter = (0, express_1.Router)();
// FYP domain_tag → career track slug mapping
const DOMAIN_TO_SLUG_MAP = {
    'ai-ml': ['ai-ml-engineering', 'data-science'],
    'healthcare-tech': ['ai-ml-engineering', 'data-science'],
    'web-mobile': ['frontend-development', 'backend-development', 'mobile-development'],
    'robotics-embedded': ['embedded-iot', 'systems-hardware-design'],
    cybersecurity: ['cybersecurity'],
};
const QuerySchema = zod_1.z.object({
    slug: zod_1.z.string().optional(),
});
/**
 * GET /api/v1/careers
 * Returns all 12 career tracks enriched with FYP domain counts.
 * Static data — no live scraping (Rule #1).
 */
exports.careersRouter.get('/', async (_req, res) => {
    try {
        // Pull published FYP domain_tags counts from Supabase
        // Only published records are visible to users (Rule #2)
        const { data: fypRows, error } = await supabase_1.supabaseAdmin
            .from('fyp_projects')
            .select('domain_tags')
            .eq('review_status', 'published');
        // Build slug → count map even if Supabase fails (graceful degradation)
        const slugCountMap = {};
        if (!error && fypRows) {
            for (const row of fypRows) {
                const tags = row.domain_tags ?? [];
                for (const tag of tags) {
                    const slugs = DOMAIN_TO_SLUG_MAP[tag] ?? [];
                    for (const slug of slugs) {
                        slugCountMap[slug] = (slugCountMap[slug] ?? 0) + 1;
                    }
                }
            }
        }
        const enriched = TracksData.tracks.map((t) => ({
            ...t,
            fyp_count: slugCountMap[t.slug] ?? 0,
        }));
        res.json({ data: enriched, meta: { total: enriched.length } });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to load career tracks'));
    }
});
/**
 * GET /api/v1/careers/:slug
 * Returns a single career track with its full detail.
 */
exports.careersRouter.get('/:slug', async (req, res) => {
    try {
        const parseResult = QuerySchema.safeParse(req.params);
        const slug = parseResult.success ? parseResult.data.slug : req.params.slug;
        const track = TracksData.tracks.find((t) => t.slug === slug);
        if (!track) {
            res.status(404).json((0, shared_1.apiError)('NOT_FOUND', `Career track '${slug}' not found`));
            return;
        }
        // Related FYP count for this specific track
        const relatedDomains = Object.entries(DOMAIN_TO_SLUG_MAP)
            .filter(([, slugs]) => slugs.includes(track.slug))
            .map(([domain]) => domain);
        let fypCount = 0;
        if (relatedDomains.length > 0) {
            const { count } = await supabase_1.supabaseAdmin
                .from('fyp_projects')
                .select('id', { count: 'exact', head: true })
                .eq('review_status', 'published')
                .overlaps('domain_tags', relatedDomains);
            fypCount = count ?? 0;
        }
        res.json({ data: { ...track, fyp_count: fypCount } });
    }
    catch (err) {
        res.status(500).json((0, shared_1.apiError)('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to load career track'));
    }
});
