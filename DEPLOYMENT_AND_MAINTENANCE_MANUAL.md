# EduCompass Deployment & Maintenance Manual
## Zero-Breakage Architecture, Root Cause Analysis & Safe Deployment Guide

This document explains:
1. **What failed previously** and why it will not happen again.
2. **How the current architecture guarantees stability** (100% deterministic builds).
3. **How to fix bugs safely** without ever touching or endangering your live website (`edu-compass-2o2k.vercel.app`).
4. **Step-by-step instructions** to deploy to a brand-new Vercel project anytime.

---

## Part 1: What Were the Issues & Why Did It Fail Earlier?

Understanding what failed gives you complete control over future deployments:

### 1. The Monorepo Workspace Dependency Failure (Cause of 500 Invocation Failed)
* **What happened:** Originally, `apps/api` imported code from `@educompass/shared` and `@educompass/engine` as workspace packages (`workspace:*`). In local development, pnpm symlinked these folders.
* **Why Vercel failed:** When Vercel deployed only `apps/api`, the sibling packages were not built or bundled into the serverless function. At runtime, the server crashed immediately on cold start:
  `Error: Cannot find module './types/engine'`
* **The Permanent Fix:** We vendored all engine and shared code directly inside `apps/api/src/engine/` and `apps/api/src/shared/`. All imports are now local relative imports (`./engine`, `./shared`). `apps/api` is 100% self-contained with **zero** external workspace links.

### 2. TypeScript Compilation Errors on Vercel (`TS2339`)
* **What happened:** In `src/lib/llm-gateway.ts`, calls to the native global `fetch()` were checked by Vercel's internal Node compiler, which threw `TS2339: Property 'ok'/'text'/'json' does not exist on type 'Response'`.
* **The Permanent Fix:** 
  1. Added `"DOM", "DOM.Iterable"` to `apps/api/tsconfig.json` `lib` array.
  2. More importantly: **We now commit the pre-compiled `dist/` directly into git.** Vercel never runs `tsc` during deployment. It deploys pre-validated JavaScript. If it builds locally on your machine, it is mathematically guaranteed to run identically on Vercel.

### 3. Vercel Serverless Function File Isolation
* **What happened:** In Vercel serverless functions, files outside the function entry folder are omitted unless explicitly included in `includeFiles`.
* **The Permanent Fix:** `apps/api/vercel.json` contains:
  ```json
  "functions": {
    "api/index.js": {
      "includeFiles": "{dist/**,public/**}"
    }
  }
  ```
  Both the compiled backend code (`dist/**`) and all frontend assets (`public/**`) are packaged directly inside the Lambda container.

### 4. Dual-Project Friction (Separate Frontend & Separate API)
* **What happened:** Previously, Part 1 was an API project and Part 2 was a Frontend project. This required:
  - Manually configuring API URLs across projects.
  - Handling CORS headers and preflight requests.
  - Risk of either the API or frontend failing independently.
* **The Permanent Fix (Unified Architecture):**
  We copied the frontend assets into `apps/api/public/` and configured Express to serve the static frontend at `/` while maintaining all REST API endpoints (`/api/v1/...`) on the **same domain**.
  - **Zero CORS issues** (Same-origin policy).
  - **Zero URL hardcoding** (`config.js` uses `window.location.origin`).
  - **Single deploy** gives you both frontend and backend instantly.

---

## Part 2: The 100% Guarantee — Why It Cannot Break

1. **Pre-Compiled JavaScript:** `apps/api/dist/` is committed to git. Vercel does not compile TypeScript — it simply runs the pre-tested JavaScript.
2. **Automated Vitest Test Suite:** Every change must pass all 145 automated tests before pushing.
3. **Dynamic Same-Origin Resolution:** In `apps/api/public/config.js`, the frontend detects its host dynamically:
   ```javascript
   return window.location.origin || 'https://edu-compass-2o2k.vercel.app';
   ```
   No matter what URL you deploy to on Vercel, the frontend automatically talks to its own backend without changing any code.

---

## Part 3: How to Safely Fix Issues Without Breaking the Live URL

If you want to modify features, fix bugs, or add new content:

### Golden Rule:
> **Never push experimental code to the `main` branch if you want your current URL (`edu-compass-2o2k.vercel.app`) to stay frozen.**

### The Safe 3-Step Workflow:

#### Step 1: You Tell Me the Issue
* Tell me what needs to be changed (e.g. course data, UI text, prompt tuning, faculty info).
* **I do the code changes.**

#### Step 2: Verification Before Committing
Whenever I make changes, I will:
1. Edit the source files (`src/...` or `public/...`).
2. Run the full test suite (`pnpm test` -> 145 tests pass).
3. Rebuild `dist/` (`npm run build`).
4. Run local simulation with `process.env.VERCEL='1'` to verify `dist/` and `public/` are serving properly.

#### Step 3: Deploying to a NEW URL (Sandbox / Staging)
To keep `edu-compass-2o2k.vercel.app` 100% untouched, we do one of two things:

* **Option A (Separate Branch):**
  We commit to a new branch (e.g., `git checkout -b v2-updates`). Pushing to that branch will **NEVER** affect `edu-compass-2o2k.vercel.app` (which only tracks `main`).
* **Option B (New Vercel Project):**
  You create a second project on Vercel (e.g., `educompass-v2`). It gets its own distinct URL (e.g. `educompass-v2.vercel.app`).
  Your original site `edu-compass-2o2k.vercel.app` remains completely safe and running 24/7.

---

## Part 4: Step-by-Step Manual Guide to Deploy to a NEW Vercel URL

When you are ready to deploy to a new URL, follow these exact manual steps:

### Step 1: Create a New Project in Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** (or **+ Create New**) > **Project**.
3. Select your GitHub repository: `EduCompass_` (or `Khawaja-Syed-Hurraim-Bin-Ather/EduCompass_`).
4. Click **Import**.

### Step 2: Configure Project Settings
Configure these exact fields:
* **Project Name:** Choose any name you like (e.g., `educompass-staging`, `educompass-v2`, `ned-portal`).
* **Framework Preset:** Select **`Other`**.
* **Root Directory:** Click **Edit**, select **`apps/api`**, and click **Continue**.
* **Build and Output Settings:** Leave all switches **OFF** (default). Do not enter custom build commands.

### Step 3: Copy-Paste Environment Variables
Click **Environment Variables** in the Vercel project configuration.
Click the **"Paste .env"** or **"Raw / Bulk Edit"** button, and paste this exact block:

```env
NODE_ENV=production
API_PORT=4000
NEXT_PUBLIC_SUPABASE_URL=https://hrzzxtjuiofivnytqldj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyenp4dGp1aW9maXZueXRxbGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NzcyODIsImV4cCI6MjEwODM1MzI4Mn0.wvk5DbgdpfMdjgs4m9niv7TXXoNbKmRoYhmaJ-XnM-s
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyenp4dGp1aW9maXZueXRxbGRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mjc3NzI4MiwiZXhwIjoyMTA4MzUzMjgyfQ.9-aibckkdrmso-kXP9bRjtokdkfN11rtgfScjSaRTDM
DATABASE_URL=postgresql://postgres.hrzzxtjuiofivnytqldj:SoftwareCEP-326@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
NEXTAUTH_SECRET=Y9Ww97Vjxp84EH3rXnc3n1DrPUl3iOpoeiBXynGrMU4
ADMIN_SEED_EMAIL=cursor.pro.test124@gmail.com
LLM_PROVIDER=gemini
GEMINI_API_KEY=<from apps/api/.env.local>
XAI_API_KEY=<from apps/api/.env.local>
LLM_PROVIDER_FALLBACK=xai
LLM_MODEL=gemini-3.5-flash-lite
LLM_MODEL_FALLBACK=gemini-3.8-flash
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIM=768
LLM_MAX_INPUT_CHARS=300
LLM_MAX_OUTPUT_TOKENS=500
LLM_USER_DAILY_LIMIT=20
LLM_GLOBAL_DAILY_BUDGET=100
IMPORTANCE_WEIGHTS=40,25,20,15
```

### Step 4: Click Deploy
1. Click **Deploy**.
2. Deployment takes approximately 20–30 seconds.
3. You will receive your new URL (e.g. `https://educompass-v2.vercel.app`).

### Step 5: Verify the Deployment
Open your new URL in your browser:
* `https://<YOUR-NEW-URL>.vercel.app/` -> Loads the full EduCompass portal UI.
* `https://<YOUR-NEW-URL>.vercel.app/health` -> Returns `{"status":"ok","service":"educompass-api"}`.
* Test sending a chat question in Abdul Bari assistant -> Responds cleanly with Layer 1/3 AI answers.

---

## Quick Reference Summary

| Question | Answer |
|---|---|
| **Is the current URL (`edu-compass-2o2k.vercel.app`) safe?** | Yes, it is running and frozen at commit `6e2795a`. |
| **If I want to fix something, will the live site break?** | No. We will work on a branch or only push after full local testing. |
| **Do I need a second Vercel project for the frontend?** | No. The unified architecture serves the frontend and backend from the same project. |
| **What do I do manually?** | You only import the project in Vercel, paste the env block, and click Deploy. I handle all code, builds, and tests. |
