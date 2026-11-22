"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Robustly load env files regardless of execution root or ES module hoisting
const candidatePaths = [
    path_1.default.resolve(process.cwd(), 'apps/api/.env.local'),
    path_1.default.resolve(process.cwd(), '.env.local'),
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(__dirname, '../../.env.local'),
    path_1.default.resolve(__dirname, '../../../.env'),
    path_1.default.resolve(__dirname, '../../../../.env'),
];
for (const p of candidatePaths) {
    if (fs_1.default.existsSync(p)) {
        dotenv_1.default.config({ path: p });
    }
}
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[Supabase Warning] SUPABASE_URL or keys not fully set in environment.');
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceRoleKey || 'placeholder-key', {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
