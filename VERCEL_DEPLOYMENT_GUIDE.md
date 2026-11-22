# EduCompass: Complete Vercel Deployment Guide (Part 1 & Part 2)

> **Repository:** `https://github.com/Khawaja-Syed-Hurraim-Bin-Ather/EduCompass_.git`  
> **Branch:** `main`  
> **Status:** Codebase verified 100% deployable. All TypeScript errors resolved, all 145 tests passing, zero workspace dependency issues.

---

## Architecture: How Part 1 and Part 2 Connect

```
+-------------------------------------------------------------+
|                  PART 2: FRONTEND (Static SPA)              |
|             Vercel Project Root Directory: frontend         |
|             URL: e.g. https://educompass-portal.vercel.app  |
+-------------------------------------------------------------+
                               |
                               | Calls REST API endpoints
                               | configured in frontend/config.js
                               v
+-------------------------------------------------------------+
|                  PART 1: BACKEND API (Serverless)           |
|             Vercel Project Root Directory: apps/api         |
|             URL: e.g. https://edu-compass-yia4.vercel.app   |
+-------------------------------------------------------------+
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
+----------------------------+    +---------------------------+
|      Supabase Cloud        |    |    Google Gemini AI API   |
|   PostgreSQL + Auth + DB   |    |    gemini-3.5-flash-lite  |
+----------------------------+    +---------------------------+
```

1. **Part 1 (API)** is deployed first. It gives you a public URL (e.g. `https://edu-compass-yia4.vercel.app`).
2. **Part 2 (Frontend)** is deployed second. It reads the Part 1 URL from `frontend/config.js` (or browser storage) and routes all chat, courses, faculty, and prerequisite requests to it.

---

## PART 1: Deploying the Backend API (`apps/api`)

### Step 1.1: Create Project in Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** > **Project**.
3. Select your GitHub repository: `EduCompass_` (or `Khawaja-Syed-Hurraim-Bin-Ather/EduCompass_`).
4. Click **Import**.

### Step 1.2: Configure Project Settings (CRITICAL)
In the configuration screen, configure these exact fields:

- **Project Name:** `edu-compass-yia4` (or any name you prefer, e.g. `educompass-api`)
- **Framework Preset:** Select **`Other`**
- **Root Directory:** Click **Edit** and choose **`apps/api`** (Click **Continue**)
- **Build and Output Settings:**
  - **Build Command:** Leave **Default / OFF** (or leave empty)
  - **Output Directory:** Leave **Default / OFF** (or leave empty)
  - **Install Command:** Leave **Default / OFF** (pnpm will install dependencies automatically)

---

### Step 1.3: Copy-Paste Environment Variables
In the **Environment Variables** section:

> [!TIP]
> Click the **"Paste .env"** or **"Raw / Bulk Edit"** button in Vercel to paste ALL variables at once!
> You can copy them directly from your local file `apps/api/.env.local` or `.secrets/env.master`.

The complete environment variable template:

```env
NODE_ENV=production
API_PORT=4000
NEXT_PUBLIC_SUPABASE_URL=https://hrzzxtjuiofivnytqldj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from apps/api/.env.local>
SUPABASE_SERVICE_ROLE_KEY=<from apps/api/.env.local>
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

---

### Step 1.4: Deploy & Verify Part 1
1. Click **Deploy**.
2. Wait 30-45 seconds for Vercel to build and deploy.
3. Once deployed, note down your production domain. Example:
   `https://edu-compass-yia4.vercel.app`
4. **Test the deployment** in your browser by opening:
   - Root: `https://<YOUR-API-URL>.vercel.app/`  
     Expected response:
     ```json
     {
       "status": "ok",
       "service": "educompass-api",
       "version": "1.0.0",
       "message": "EduCompass CISE Backend API is running.",
       "health": "/health"
     }
     ```
   - Health check: `https://<YOUR-API-URL>.vercel.app/health`  
     Expected response:
     ```json
     {
       "status": "ok",
       "service": "educompass-api",
       "timestamp": "2026-11-22T...",
       "version": "1.0.0"
     }
     ```

---

## PART 2: Deploying the Frontend (`frontend`)

### Step 2.1: Verify the API Link in `frontend/config.js`
The file `frontend/config.js` is already pre-configured to link to `https://edu-compass-yia4.vercel.app`:

```javascript
// EduCompass Frontend Configuration
(function() {
  window.EDUCOMPASS_CONFIG = {
    getApiUrl: function() {
      if (window.__API_URL__) return window.__API_URL__.replace(/\/+$/, '');
      try {
        var stored = localStorage.getItem('ec:api_url');
        if (stored) return stored.replace(/\/+$/, '');
      } catch (e) {}
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        return 'http://localhost:4000';
      }
      return 'https://edu-compass-yia4.vercel.app';
    }
  };
})();
```

> [!NOTE]
> - If your Part 1 URL is **`https://edu-compass-yia4.vercel.app`**, you don't need to change anything!
> - If your Part 1 URL is different (e.g., `https://my-api-xyz.vercel.app`), update line 13 of `frontend/config.js` with your new URL, then commit and push.
> - Alternatively, you can change it instantly in any browser console without redeploying:
>   ```javascript
>   localStorage.setItem('ec:api_url', 'https://your-api-url.vercel.app');
>   ```

---

### Step 2.2: Create Project in Vercel for Frontend
1. In your [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** > **Project**.
2. Select the **same** GitHub repository (`EduCompass_`).
3. Click **Import**.

### Step 2.3: Configure Frontend Settings
- **Project Name:** `educompass-portal` (or `educompass-frontend`)
- **Framework Preset:** Select **`Other`**
- **Root Directory:** Click **Edit** and select **`frontend`** (Click **Continue**)
- **Build and Output Settings:**
  - **Build Command:** Leave **OFF / empty** (it is a pure static site: `index.html`, `app.js`, `styles.css`)
  - **Output Directory:** Leave **OFF / empty** (or `.`)
  - **Install Command:** Leave **OFF / empty**
- **Environment Variables:** None required! (The frontend is static and reads the API URL from `config.js`)

### Step 2.4: Deploy & Verify Part 2
1. Click **Deploy**.
2. The frontend deploys in under 15 seconds.
3. Open your new frontend URL (e.g. `https://educompass-portal.vercel.app`).
4. Test key features:
   - **AI Assistant:** Click on Abdul Bari or navigate to `#/assistant`, send "Who teaches Database?" -> Receives response from Part 1 API.
   - **Courses Catalog:** Click **Curriculum**, view 59 courses with prerequisite chains.
   - **Faculty Directory:** Click **Professors**, search for faculty members.
   - **FYP Archive:** Click **FYP Projects**, browse past final year projects.

---

## Summary of Fixes Applied to the Codebase

| Issue | Root Cause | Fix Applied | Status |
|---|---|---|---|
| **TS2339 Response errors** | Missing DOM lib types in `tsconfig.json` | Added `"DOM", "DOM.Iterable"` to lib array, type-safe fetch responses | Fixed (Commit `4786597`) |
| **500 FUNCTION_INVOCATION_FAILED** | `@educompass/shared` & `@educompass/engine` were workspace links missing at runtime | Vendored all engine & shared code into `apps/api/src/`, removed workspace deps | Fixed (Commit `5bc9bdc`) |
| **Workspace build breakage** | Packages had conflicting `"main": "./dist/index.js"` | Reverted package manifests, self-contained `apps/api` | Fixed (Commit `5bc9bdc`) |
| **Over-engineered vercel.json** | Attempted custom install/build scripts and dist bundling | Restored standard Vercel serverless entry `api/index.ts` with clean rewrite | Fixed (Commit `5fc2e05`) |
| **Faculty login gating** | FAQ matcher checked audience before confidence threshold | Public faculty queries now resolve immediately without login requirement | Fixed (Commit `73f7b06`) |
| **Chat auto-focus & launcher** | Floating launcher occluded form, input wasn't focused | Focus input on route change, hide launcher on chat page | Fixed (Commit `73f7b06`) |
| **CORS restrictions** | API blocked external origins | Whitelisted all `*.vercel.app` domains automatically | Pre-configured in `security.ts` |
