"use strict";
// ── Engine contract (SRS 5.4) ──────────────────────────────────
// Pure TypeScript — no database, no network, no side effects.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WEIGHTS = void 0;
exports.DEFAULT_WEIGHTS = {
    downstream: 40,
    chainDepth: 25,
    coreStatus: 20,
    gatekeeping: 15,
};
