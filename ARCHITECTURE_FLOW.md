# PrepWise - Complete Architecture & Data Flow

**Comprehensive System Design with Every Function Call, Input/Output, and Integration**

---

## 2026 Canonical Update (Current Source of Truth)

This section reflects the latest implementation and should be treated as the primary flow reference.

### What changed

- Interview generation now accepts **job description context** for downstream feedback:
  - user can select a predefined company profile (`google`, `startup`, `corporate`)
  - or paste a custom job description
  - custom JD takes priority over company profile JD
- `jobDescription` and `companyType` are persisted in interview documents.
- Feedback generation now reads interview-level `jobDescription` and applies it specifically to **Cultural & Role Fit** scoring.
- Resume extraction pipeline now uses a **Python FastAPI microservice** (`pdf_server.py`) with `pypdf`, called from Node via `extract-pdf-text.ts`.

---

## Updated End-to-End Flow

### 1) Interview Generation UI (`app/(root)/interview/page.tsx`)

User inputs:
- mode: `standard` or `resume`
- role, type, level, techstack, amount
- company profile dropdown (`companyType`) OR custom JD textarea (`customJD`)
- resume PDF (resume mode only)

Computed on submit:
- `jobDescription = customJD.trim() || COMPANY_JDS[companyType] || ""`

Request payload:
- Standard mode (JSON): includes `companyType`, `jobDescription`
- Resume mode (FormData): includes `companyType`, `jobDescription` + `resumePdf`

---

### 2) Interview API (`app/api/vapi/generate/route.ts`)

The API now parses and stores:
- `companyType`
- `jobDescription`

Mode handling:
- `standard`: JSON body only, generic role/tech prompt flow
- `resume`: multipart upload, required PDF, extract text via Python service, project extraction/filtering, resume-grounded prompt flow

Interview document now includes:
- `companyType: string`
- `jobDescription: string`
- existing fields (`role`, `type`, `level`, `techstack`, `questions`, `userId`, `createdAt`, `interviewMode`, etc.)

---

### 3 Resume PDF Extraction Pipeline (Updated)

Current path:
`Browser -> app/api/vapi/generate/route.ts -> lib/rag/extract-pdf-text.ts -> lib/rag/pdf_server.py -> lib/rag/resume-rag.ts -> app/api/vapi/generate/route.ts -> Groq`

#### Actual function-by-function flow

1. **Receive uploaded file**
   - **File:** `app/api/vapi/generate/route.ts`
   - **Function:** `POST(request: Request)`
   - **What it does:** parses `multipart/form-data`, validates resume mode, validates uploaded PDF, converts uploaded `File` into a Node `Buffer`
   - **Input:** `Request` containing `resumePdf`, `role`, `type`, `level`, `techstack`, `amount`, `userid`, `companyType`, `jobDescription`, `mode`
   - **Output:** `buf: Buffer`
   - **Goes to:** `lib/rag/extract-pdf-text.ts -> extractTextFromPdfBuffer(buffer)`

2. **Send PDF bytes to Python service**
   - **File:** `lib/rag/extract-pdf-text.ts`
   - **Function:** `extractTextFromPdfBuffer(buffer: Buffer): Promise<string>`
   - **What it does:** validates that the PDF buffer is not empty, wraps it in `FormData`, sends `POST http://127.0.0.1:8001/extract-pdf`, applies a 10 second timeout using `AbortController`, reads JSON response
   - **Input:** `buffer: Buffer`
   - **Output:** `Promise<string>` containing extracted PDF text
   - **Goes to:** `lib/rag/pdf_server.py -> extract_pdf(file)`

3. **Extract text from PDF pages**
   - **File:** `lib/rag/pdf_server.py`
   - **Function:** `extract_pdf(file: UploadFile = File(...))`
   - **What it does:** receives uploaded PDF, validates file presence and content, reads bytes in memory, parses PDF using `PdfReader(io.BytesIO(contents))`, loops over pages with `page.extract_text()`, joins extracted text, returns structured JSON
   - **Input:** multipart field `file: UploadFile`
   - **Output:** JSON `{ "text": string, "error": null | string }`
   - **Goes to:** `lib/rag/extract-pdf-text.ts -> const data = await response.json()`

4. **Normalize extracted resume text**
   - **File:** `lib/rag/resume-rag.ts`
   - **Function:** `normalizeResumeText(raw: string): string`
   - **What it does:** converts `\r\n` to `\n`, replaces tabs with spaces, trims edges, compresses 3+ blank lines into 2
   - **Input:** raw extracted text string from PDF service
   - **Output:** cleaned resume text string
   - **Goes to:** `app/api/vapi/generate/route.ts -> resumeText` and later `fullResumeText`

5. **Extract project blocks from resume**
   - **File:** `lib/rag/resume-rag.ts`
   - **Function:** `extractProjectsWithTech(text: string, maxProjects = 5): { name: string; tech: string[]; fullText: string }[]`
   - **What it does:** finds the `Projects` section, detects project title rows that contain `|`, collects description lines, extracts technologies from the title row and bullet lines like `Tech Stack:`
   - **Input:** normalized resume text
   - **Output:** array of project objects:
     - `{ name, tech, fullText }[]`
   - **Goes to:** `app/api/vapi/generate/route.ts -> const allProjects = extractProjectsWithTech(fullResumeText)`

6. **Filter projects against requested stack**
   - **File:** `lib/rag/resume-rag.ts`
   - **Function:** `filterProjectsByTech(projects, userTechStack): { name: string; tech: string[]; fullText: string }[]`
   - **What it does:** compares extracted project tech lists with requested tech stack from the form, returns only matching projects, or falls back to top 2 projects if none match
   - **Input:** 
     - `projects: { name: string; tech: string[]; fullText: string }[]`
     - `userTechStack: string[]`
   - **Output:** filtered project array used for prompt context
   - **Goes to:** `app/api/vapi/generate/route.ts -> const matchedProjects = filterProjectsByTech(allProjects, requestedTech)`

7. **Build prompt and generate interview questions**
   - **File:** `app/api/vapi/generate/route.ts`
   - **Function:** `POST(request: Request)`
   - **What it does:** builds `projectsDisplay`, creates the resume-grounded LLM prompt, calls `generateText(...)`, parses the JSON array of questions, saves the interview document
   - **Input:** filtered project context + interview metadata
   - **Output:** Firestore interview document and API JSON response `{ success: true, interviewId }`
   - **Goes to:** `interviews` collection in Firestore and frontend response

---

### 4) Interview Call + Transcript

- During interview, transcript messages are collected in `components/Agent.tsx`.
- On call finish, transcript is sent to `createFeedback()` in `lib/actions/general.action.ts`.

---

### 5) Feedback Generation (Updated Cultural Fit)

`createFeedback()` now:
1. formats transcript
2. fetches interview doc by `interviewId`
3. reads:
   - `jobDescription` from interview doc
   - fallback: `"No job description provided. Evaluate based on general professional standards."`
4. builds cultural-fit guidance prompt using:
   - Job Description
   - Interview Transcript
   - evaluation dimensions:
     - communication clarity
     - problem solving approach
     - ownership/accountability
     - collaboration signals
     - growth mindset
5. injects this guidance into the full Groq evaluation prompt
6. receives strict JSON feedback
7. saves feedback to Firestore

Result:
- **Cultural & Role Fit** is now explicitly evaluated against JD/company expectations + transcript evidence.

---

## 2. NEW SYSTEM (PDF Extraction Redesign)

The old Node-only `pdf-parse` path has been replaced because it was inconsistent on many real resumes (especially Canva/complex layouts).  
The current pipeline is:

`Browser (Upload Resume)`  
`-> Next.js route.ts (receives file buffer)`  
`-> extract-pdf-text.ts (calls Python service)`  
`-> FastAPI /extract-pdf (pypdf extracts text)`  
`-> returns JSON { text, error }`  
`-> resume-rag.ts (extract projects/tech context)`  
`-> prompt builder in route.ts`  

This split gives stronger PDF compatibility and cleaner error handling while keeping the interview generation API unchanged for the frontend.

---

## 4. KEY COMPONENTS

### FastAPI PDF Service

- **File:** `lib/rag/pdf_server.py`
- **Endpoint:** `POST /extract-pdf`
- **Engine:** `pypdf` via `PdfReader`
- **Responsibilities:**
  - validate uploaded file presence/content
  - parse PDF pages and extract text
  - handle invalid/corrupted files and scanned PDFs (empty text)
- **Response format:**
  - success/fallback: `{ "text": "<extracted text or empty>", "error": null | "<message>" }`

### Node Integration

- **File:** `lib/rag/extract-pdf-text.ts`
- **Responsibilities:**
  - accepts `Buffer` from `route.ts`
  - builds multipart payload with `form-data`
  - sends request using `fetch` to `http://127.0.0.1:8001/extract-pdf`
  - uses timeout guard (`AbortController`)
  - normalizes service errors into actionable exceptions/warnings

### Resume Processing (RAG Layer)

- **File:** `lib/rag/resume-rag.ts`
- **Responsibilities:**
  - normalize extracted text
  - extract `PROJECTS` section blocks and detected technologies
  - match projects against requested stack (e.g. `next.js`)
  - filter/prioritize resume context for prompt grounding

### LLM Prompt System

- **Primary file:** `app/api/vapi/generate/route.ts`
- **Responsibilities:**
  - builds resume-grounded prompts (resume mode) or generic prompts (standard mode)
  - sends prompt to Groq model
  - parses JSON-array question output
  - runs quality checks/warnings before save

---

## 5. FINAL DATA FLOW (Function I/O by File)

### Resume upload to question generation

1. **Frontend submit**                                                                             
   - **File:** `app/(root)/interview/page.tsx`  
   - **Input:** user form values + optional PDF file  
   - **Output:** `POST /api/vapi/generate` (JSON for standard, FormData for resume)

2. **API entrypoint**  
   - **File:** `app/api/vapi/generate/route.ts` (`POST`)  
   - **Input:** request body/FormData (`role`, `type`, `level`, `techstack`, `amount`, `userid`, `mode`, optional `resumePdf`)  
   - **Output:** validated params + interview mode branch

3. **PDF extraction adapter**  
   - **File:** `lib/rag/extract-pdf-text.ts` (`extractTextFromPdfBuffer(buffer)`)  
   - **Input:** `Buffer` of uploaded PDF bytes  
   - **Output:** extracted raw text string returned to `app/api/vapi/generate/route.ts`

4. **Python extraction service**  
   - **File:** `lib/rag/pdf_server.py` (`extract_pdf(file)` exposed at `POST /extract-pdf`)  
   - **Input:** multipart file upload (`file`)  
   - **Output:** JSON `{ text, error }` returned to `lib/rag/extract-pdf-text.ts`

5. **Resume RAG processing**  
   - **File:** `lib/rag/resume-rag.ts`  
   - **Functions and I/O:**
     - `normalizeResumeText(raw: string) -> string`
       - output goes back to `app/api/vapi/generate/route.ts` as `resumeText` / `fullResumeText`
     - `extractProjectsWithTech(text: string, maxProjects?: number) -> { name, tech, fullText }[]`
       - output goes back to `app/api/vapi/generate/route.ts` as `allProjects`
     - `filterProjectsByTech(projects, userTechStack) -> filteredProjects[]`
       - output goes back to `app/api/vapi/generate/route.ts` as `matchedProjects`

6. **Prompt build + LLM generation**  
   - **File:** `app/api/vapi/generate/route.ts` + `lib/groq.ts`  
   - **Input:** filtered resume context + interview params  
   - **Output:** `questions: string[]` from Groq, then saved to Firestore

7. **Persistence + response**  
   - **File:** `app/api/vapi/generate/route.ts`  
   - **Input:** generated questions + interview metadata  
   - **Output:** Firestore `interviews` doc + API response `{ success, interviewId }`

---

## Updated Data Contracts

### `COMPANY_JDS`

Defined in `constants/index.ts`:
- `google`
- `startup`
- `corporate`

### Interview document (`interviews` collection)

Added optional fields:
- `companyType?: string`
- `jobDescription?: string`

### TypeScript types (`types/index.ts`)

Added to `Interview` and `InterviewCardProps`:
- `companyType?: string`
- `jobDescription?: string`

---

## Quick Sequence (Current)

1. User fills interview form and optionally selects company/pastes JD.
2. Frontend computes final `jobDescription`.
3. API generates questions (standard or resume path) and stores interview + JD/company metadata.
4. User completes voice interview.
5. Transcript is sent to feedback action.
6. Feedback action fetches interview’s `jobDescription`.
7. Groq evaluates all categories; **Cultural & Role Fit** uses transcript + JD context.
8. Feedback is saved and rendered on feedback page.

---

## 🎯 System Purpose

PrepWise is an **AI-powered mock interview platform** that generates interview questions via two modes:
- **Standard Mode**: Direct form input → AI generates questions
- **Resume Mode**: PDF upload + form input → AI generates questions grounded in candidate's real projects

---

## 🗂️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14, React 18, TypeScript | File uploads, forms, interview replay, voice UI |
| **Auth** | Firebase Authentication | Email/password signup & login |
| **Database** | Firestore (Firebase) | Store users, interviews, questions, voice sessions |
| **LLM API** | Groq (llama-3.3-70b-versatile) | Generate interview questions via prompt |
| **Voice** | Vapi.ai + Deepgram + 11Labs | Real-time voice interview, transcription, synthesis |
| **Resume Processing** | Python FastAPI (`pypdf`) + Node integration | Reliable PDF text extraction for real-world resumes |
| **Validation** | Zod | Form validation (frontend & backend) |

---

## 📊 Database Schema

### Firestore Collections

#### Collection: `users`

```typescript
Document ID: firebase-uid (auto-generated by Firebase Auth)

{
  name: string;                    // User's full name
  email: string;                   // User's email (unique)
  // Other fields optional: avatar, bio, etc.
}

Example:
{
  "user123" {
    name: "John Doe",
    email: "john@example.com"
  }
}
```

#### Collection: `interviews`

```typescript
Document ID: auto-generated by Firestore

{
  // Form inputs (same for both modes)
  role: string;                    // e.g., "Frontend Engineer", "Backend Engineer"
  type: string;                    // "technical", "behavioral", or "balanced"
  level: string;                   // "junior", "mid-level", "senior"
  techstack: string[];             // e.g., ["React", "Node.js", "MongoDB"]
  amount: number;                  // 1-10 questions requested
  
  // Generated questions
  questions: string[];             // Array of N interview questions
  
  // Metadata
  userId: string;                  // Reference to user who created this
  interviewMode: "standard" | "resume";  // Which mode was used
  finalized: boolean;              // true = ready to use, false = still generating
  createdAt: string;               // ISO timestamp
  
  // UI
  coverImage: string;              // Random cover image URL
  
  // Resume mode only (if applicable)
  resumeFileName?: string;         // Original PDF filename
  extractedResumeTextLength?: number;  // Size of extracted text
  projectsExtracted?: number;      // Count of projects found
  projectsFiltered?: number;       // Count of projects after filtering
}

Example (Standard Mode):
{
  "interview-doc-1" {
    role: "Frontend Engineer",
    type: "technical",
    level: "mid-level",
    techstack: ["React", "TypeScript", "Tailwind"],
    amount: 5,
    questions: [
      "Explain the virtual DOM in React...",
      "How do you optimize component rendering?",
      ...
    ],
    userId: "user123",
    interviewMode: "standard",
    finalized: true,
    createdAt: "2026-04-05T10:30:00.000Z",
    coverImage: "https://..."
  }
}

Example (Resume Mode):
{
  "interview-doc-2" {
    role: "Backend Engineer",
    type: "technical",
    level: "senior",
    techstack: ["Node.js", "PostgreSQL", "Docker"],
    amount: 5,
    questions: [
      "In your E-commerce Platform, how did you handle database scaling?",
      "Tell me about the payment integration in Weather Dashboard...",
      ...
    ],
    userId: "user456",
    interviewMode: "resume",
    finalized: true,
    createdAt: "2026-04-05T11:15:00.000Z",
    coverImage: "https://...",
    resumeFileName: "My Resume.pdf",
    extractedResumeTextLength: 8920,
    projectsExtracted: 5,
    projectsFiltered: 3
  }
}
```

---

## 🔐 Authentication Flow

### Entry Point: `/sign-up` or `/sign-in`

```
USER INPUT
├─ username: "john@example.com"
└─ password: "secure123"
         ↓ (submit form)
┌────────────────────────────────────────────┐
│ FRONTEND: components/AuthForm.tsx          │
│                                            │
│ 1. Validate with Zod schema:               │
│    - email: .email()                       │
│    - password: .min(8)                     │
│ 2. Show validation errors if invalid       │
│ 3. Call Server Action                      │
└────────────────────────────────────┬───────┘
                                     ↓
┌────────────────────────────────────────────────────┐
│ SERVER ACTION: lib/actions/auth.action.ts         │
│                                                   │
│ Export: signUp(email, password)                   │
│                                                   │
│ LOGIC:                                            │
│ 1. Firebase Auth: createUserWithEmailAndPassword()│
│    Input: {email, password}                       │
│    Output: FirebaseUser {uid, email, ...}         │
│    Error cases:                                   │
│    - "auth/email-already-in-use" → user exists   │
│    - "auth/weak-password" → <6 chars             │
│    - "auth/invalid-email" → invalid format       │
│                                                   │
│ 2. If success: Create Firestore user doc         │
│    Call: db.collection("users").doc(uid).set()   │
│    Input: {name, email}                          │
│    Wait for: Promise resolve                     │
│                                                   │
│ 3. Create httpOnly session cookie:               │
│    Cookie: "__firebaseSessionKey__"              │
│    HttpOnly: true (can't be accessed by JS)      │
│    Secure: true (HTTPS only)                     │
│    Path: /                                       │
│ 4. Return: {success: true}                       │
└────────────────────────────────┬──────────────────┘
                                 ↓
                        FIRESTORE UPDATE
                        ┌─────────────────────────┐
                        │ Collection: users       │
                        │ Document: uid           │
                        │ Set: {name, email}      │
                        └─────────────────────────┘
                                 ↓ (success)
                        REDIRECT to "/"
                        (Dashboard)
```

---

## 🎤 Main Interview Generation Flow

### Unified API Endpoint

**Path:** `POST /api/vapi/generate`

**Input Sources:**
1. **JSON Body** (Standard Mode) - `Content-Type: application/json`
2. **FormData** (Resume Mode) - `Content-Type: multipart/form-data`

**Output:**
```json
{
  "success": true,
  "interviewId": "doc-id-from-firestore"
}
```

---

## 📝 Mode 1: STANDARD MODE (Form Only)

### Complete End-to-End Flow

```
┌──────────────────────────────────────────────────────────┐
│ USER: Visit /interview Form                             │
│                                                          │
│ Form Fields:                                             │
│ • Role: "Frontend Engineer" (select)                     │
│ • Interview Type: "technical" (radio)                    │
│ • Experience Level: "mid-level" (select)                │
│ • Tech Stack: "React, TypeScript, Tailwind" (textarea)  │
│ • Question Amount: 5 (number 1-10)                      │
│                                                          │
│ Button: "Generate Interview" (POST request)             │
└──────────────────────┬───────────────────────────────────┘
                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 1: FRONTEND VALIDATION                             │
│                                                          │
│ Code: components/ExecuteWorkflow.tsx                    │
│                                                          │
│ Validate form with Zod schema:                          │
│ - role: required, string                                │
│ - type: required, "technical"|"behavioral"|"balanced"   │
│ - level: required, "junior"|"mid-level"|"senior"        │
│ - techstack: required, non-empty, comma-separated string│
│ - amount: required, number 1-10                         │
│                                                          │
│ If invalid: Show error toast to user, abort             │
│ If valid: Proceed to POST                               │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 2: SEND HTTP REQUEST                               │
│                                                          │
│ fetch('/api/vapi/generate', {                           │
│   method: 'POST',                                        │
│   headers: {                                             │
│     'Content-Type': 'application/json'                  │
│   },                                                     │
│   body: JSON.stringify({                                │
│     type: 'technical',                                   │
│     role: 'Frontend Engineer',                           │
│     level: 'mid-level',                                 │
│     techstack: 'React, TypeScript, Tailwind',           │
│     amount: 5,                                           │
│     userid: 'firebase-uid-from-cookie',                 │
│     mode: 'standard'                                     │
│   })                                                     │
│ })                                                       │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

╔══════════════════════════════════════════════════════════╗
║ BACKEND API: app/api/vapi/generate/route.ts             ║
║                                                          ║
║ Handler: async POST(request: Request)                   ║
║                                                          ║
║ PARSING:                                                 ║
║ 1. Check Content-Type header                            ║
║ 2. Parse JSON body with (await request.json())          ║
║ 3. Extract fields: type, role, level, techstack, amount,║
║    userid, mode                                         ║
║                                                          ║
║ VALIDATION:                                             ║
║ Check all required fields:                              ║
║ • type: non-empty string ✓                              ║
║ • role: non-empty string ✓                              ║
║ • level: non-empty string ✓                             ║
║ • techstack: non-empty string ✓                         ║
║ • userid: non-empty string ✓                            ║
║ • amount: finite number, 1-10 ✓                         ║
║ • mode: "standard" or "resume" ✓                        ║
║                                                          ║
║ If any validation fails:                                ║
║   Return 400 JSON: {success: false, error: "msg"}      ║
║   Exit handler                                          ║
║                                                          ║
║ If all valid: Continue to prompt building               ║
╚════════════════════════┬═════════════════════════════════╝
                         ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 3: BUILD PROMPT (Standard Mode)                    │
│                                                          │
│ No resume processing needed!                            │
│ interviewMode === "standard" → Standard prompt          │
│                                                          │
│ Build PRODUCTION DIAGNOSTICS prompt template:           │
│                                                          │
│ KEY SHIFT: This is NOT an interview - it's a            │
│ technical investigation of production behavior.          │
│                                                          │
│ FORBIDDEN PHRASES (Zero Tolerance):                     │
│ ❌ "How would you..."                                   │
│ ❌ "Walk me through..."                                 │
│ ❌ "Explain..."                                         │
│ ❌ "Describe..."                                        │
│ ❌ "Tell me about..."                                   │
│ ❌ "What would you do..."                               │
│ ❌ "How do you approach..."                              │
│                                                          │
│ ALLOWED QUESTION STARTERS ONLY:                         │
│ ✓ "What happens when..."                                │
│ ✓ "What occurs if..."                                  │
│ ✓ "How does your system behave when..."                │
│ ✓ "What's the runtime impact when..."                   │
│ ✓ "Which race condition occurs when..."                │
│ ✓ "What state inconsistency appears when..."            │
│                                                          │
│ QUESTION STRUCTURE (Required):                          │
│ [Concrete System Condition] + [Error/Edge Case/Load]   │
│         + [Technology-Specific Impact]                 │
│                                                          │
│ For TECHNICAL Mode:                                     │
│ ──────────────────────────────                          │
│ Concrete Failure Scenarios (pick ONE):                  │
│                                                          │
│ Frontend (React/Vue/Angular):                           │
│ - State store out of sync vs UI rendering              │
│ - Event handlers fire during unmount                    │
│ - Memory leak in subscription or timer                 │
│ - Race condition with async state updates              │
│ - Event loop blocked by heavy rendering                │
│                                                          │
│ Backend (Node.js/Express/Python):                       │
│ - Event loop blocked by sync code during traffic       │
│ - Uncaught async rejection crashes worker              │
│ - Partial write before connection drops                │
│ - Database connection pool exhausted                   │
│ - Race condition in concurrent writes                  │
│                                                          │
│ Database/API:                                           │
│ - N+1 query under load                                 │
│ - Connection timeout mid-transaction                  │
│ - Partial data committed on network failure            │
│ - Third-party API rate limit or timeout                │
│ - Cache invalidation race condition                    │
│                                                          │
│ System-Level:                                           │
│ - Memory growth unbounded                              │
│ - File descriptor exhaustion                          │
│ - CPU throttling under load                            │
│ - DNS resolution timeout cascades                      │
│ - Deployment rolling update mid-request                │
│                                                          │
│ EXAMPLES (Reference - NOT for copying):                │
│                                                          │
│ BAD (Textbook): "How would you handle API failures?"   │
│ GOOD (Diagnostic):                                      │
│ "What happens when an API fails after partial data     │
│  is committed to Redux store?"                         │
│                                                          │
│ BAD (Textbook): "Explain error handling"                │
│ GOOD (Diagnostic):                                      │
│ "What occurs when an Express route throws inside       │
│  a callback after headers are sent?"                    │
│                                                          │
│ BAD (Textbook): "Describe your testing strategy"        │
│ GOOD (Diagnostic):                                      │
│ "What state inconsistency appears when two identical   │
│  requests arrive within 50ms?"                          │
│                                                          │
│ Quality Gate Check:                                     │
│ 1. Uses ONLY allowed starters? ✓                        │
│ 2. Names CONCRETE failure scenario? ✓                   │
│ 3. Includes SPECIFIC tech from stack? ✓                │
│ 4. Is this a post-mortem question, not interview? ✓    │
│ If NO to any, DELETE and regenerate.                   │
│                                                          │
│ For BEHAVIORAL Mode:                                    │
│ ────────────────────────────                           │
│ Forbidden: "Tell me about a time", "How do you"        │
│ Required: "What happened when", "What was your..."     │
│ Focus: Real decisions, specific incidents               │
│                                                          │
│ For BALANCED Mode:                                      │
│ ──────────────────────────                             │
│ Mix technical (production diagnostic) +                │
│ behavioral (specific incident)                         │
│                                                          │
│ Output: Comprehensive prompt (~3,500-4,500 chars)       │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 4: CALL GROQ LLM API                               │
│                                                          │
│ Code: lib/groq.ts - Function: groq()                    │
│                                                          │
│ Import: import { generateText } from "ai"              │
│         (Vercel AI SDK - abstraction layer)            │
│                                                          │
│ Call:                                                    │
│ const { text: responseText } =                          │
│   await generateText({                                  │
│     model: groq('llama-3.3-70b-versatile'),            │
│     prompt: prompt,                                    │
│     maxOutputTokens: 2048                              │
│   })                                                    │
│                                                          │
│ REQUEST to Groq API:                                    │
│ Endpoint: https://api.groq.com/inference               │
│ Method: POST                                            │
│ Headers: Authorization: Bearer $GROQ_API_KEY           │
│ Body: {model, messages, temperature, max_tokens}       │
│                                                          │
│ GROQ PROCESSING:                                        │
│ - Receives prompt with 5-question request              │
│ - Processes with llama-3.3-70b-versatile model         │
│ - Generates interview questions                        │
│ - Returns token count & generated text                 │
│                                                          │
│ RESPONSE from Groq:                                     │
│ ✓ Status: 200 OK                                        │
│ ✓ Body: {                                               │
│      choices: [{                                        │
│        message: {                                       │
│          content: "["Question 1 text",                 │
│                     "Question 2 text",                 │
│                     "Question 3 text",                 │
│                     "Question 4 text",                 │
│                     "Question 5 text"]"                │
│        }                                                │
│      }],                                                │
│      usage: {                                           │
│        prompt_tokens: 150,                              │
│        completion_tokens: 280                           │
│      }                                                  │
│    }                                                    │
│                                                          │
│ STORE in variable: responseText                        │
│ Value: "["Question 1 text", ...]"                      │
│                                                          │
│ Time: 2-8 seconds (depends on API load)                │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 5: PARSE RESPONSE                                  │
│                                                          │
│ Extract JSON array from response:                       │
│                                                          │
│ const jsonMatch =                                        │
│   responseText.match(/\[[\s\S]*\]/)                     │
│                                                          │
│ This regex: /\[[\s\S]*\]/                              │
│ Matches: [ followed by anything, ending with ]         │
│ Handles: Extra text before/after JSON                  │
│                                                          │
│ If no match found:                                      │
│   throw new Error("Failed to extract questions")       │
│   → API returns 500                                     │
│   → Exit handler                                        │
│                                                          │
│ Parse JSON:                                             │
│ const questions = JSON.parse(jsonMatch[0])             │
│                                                          │
│ Type: questions: string[]                              │
│ Value: [                                                │
│   "Explain virtual DOM...",                            │
│   "How do you optimize...",                            │
│   ...                                                   │
│ ]                                                       │
│                                                          │
│ Validate count:                                         │
│ if (questions.length !== amount) {                      │
│   console.warn("Expected 5 but got " + length)        │
│   // Still proceed, use what was returned              │
│ }                                                       │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 6: SAVE TO FIRESTORE                               │
│                                                          │
│ Create interview document:                              │
│                                                          │
│ const interview = {                                     │
│   role: "Frontend Engineer",                            │
│   type: "technical",                                    │
│   level: "mid-level",                                   │
│   techstack: ["React", "TypeScript", "Tailwind"],       │
│   questions: ["Q1", "Q2", "Q3", "Q4", "Q5"],           │
│   userId: "firebase-uid",                              │
│   finalized: true,                                      │
│   coverImage: "https://...",                            │
│   createdAt: "2026-04-05T10:30:00.000Z",               │
│   interviewMode: "standard"                             │
│ }                                                       │
│                                                          │
│ Save to Firestore:                                      │
│ const newInterview =                                    │
│   await db.collection("interviews").add(interview)    │
│                                                          │
│ Firestore Operations:                                   │
│ 1. Generate new document ID (auto)                     │
│ 2. Write document with above data                      │
│ 3. Return DocumentReference with .id property         │
│                                                          │
│ Value: newInterview.id = "abc123def456..."             │
│                                                          │
│ Database State:                                         │
│ ├─ Collection: "interviews"                            │
│ └─ Document: "abc123def456..." {                       │
│      role: "Frontend Engineer",                        │
│      type: "technical",                                │
│      ...                                                │
│    }                                                    │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 7: RETURN RESPONSE                                 │
│                                                          │
│ return Response.json(                                   │
│   { success: true, interviewId: "abc123def456..." },   │
│   { status: 200 }                                       │
│ )                                                       │
│                                                          │
│ Response Sent to Frontend:                              │
│ {                                                        │
│   "success": true,                                      │
│   "interviewId": "abc123def456..."                      │
│ }                                                       │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 8: FRONTEND REDIRECT                               │
│                                                          │
│ Receive response: { success: true, interviewId }       │
│                                                          │
│ Call: router.push(`/interview/${interviewId}`)         │
│                                                          │
│ Browser navigates to:                                   │
│ URL: /interview/abc123def456...                        │
│                                                          │
│ Page: app/(root)/interview/[id]/page.tsx               │
│ Load interview from Firestore using ID                 │
│ Display: Questions, record voice, etc.                 │
└──────────────────────────────────────────────────────────┘
```

---

## 📤 Mode 2: RESUME MODE (PDF + Form)

### Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────┐
│ USER: Visit /interview Form + Upload Resume             │
│                                                         │
│ Form Location: app/(root)/interview/page.tsx            │
│                                                         │
│ Form Fields: (same as Standard Mode)                    │
│ • Role, Type, Level, Tech Stack, Amount                 │
│ • PLUS: File Input (PDF Resume)                         │
│                                                         │
│ Button: "Generate Interview" (POST FormData)            │
└──────────────────────────────────────┬──────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 1: FRONTEND VALIDATION                              │
│                                                          │
│ Code Location:                                           │
│ • File: components/executeWorkflow.tsx                   │
│ • Function: handleFormSubmit()                           │
│                                                          │
│ Same as Standard Mode PLUS:                              │
│ • File must exist & be instanceof File                   │
│ • File must end with .pdf extension                      │
│ • File size must be ≤ 5 MB (MAX_PDF_BYTES)               │
│ • MIME type must be "application/pdf"                    │
│                                                          │
│ If invalid:                                              │
│   Show error toast: "Invalid or missing PDF file"        │
│   Abort POST                                             │
│                                                          │
│ If valid: Proceed to POST                                │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 2: BUILD FormData & SEND REQUEST                    │
│                                                          │
│ FROM: components/executeWorkflow.tsx                     │ 
│ TO: POST /api/vapi/generate                             │
│                                                          │
│ const formData = new FormData()                          │
│ formData.append('mode', 'resume')                        │
│ formData.append('type', 'technical')                     │
│ formData.append('role', 'Backend Engineer')              │
│ formData.append('level', 'senior')                       │
│ formData.append('techstack', 'Node.js, PostgreSQL')      │
│ formData.append('userid', 'firebase-uid')                │
│ formData.append('amount', '5')                           │
│ formData.append('resumePdf', fileObject)                 │
│                                                          │
│ fetch('/api/vapi/generate', {                            │
│   method: 'POST',                                        │
│   // NO Content-Type header (browser sets it)            │
│   body: formData                                         │
│ })                                                       │ 
│                                                          │
│ Browser automatically sets:                              │
│ Content-Type: multipart/form-data; boundary=...          │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

╔══════════════════════════════════════════════════════════╗
║ BACKEND API ENDPOINT                                    ║
║ File: app/api/vapi/generate/route.ts                    ║
║ Handler: POST(request: Request)                         ║
║                                                          ║
║ PARSING:                                                 ║
║ 1. Check Content-Type header                            ║
║ 2. If includes "multipart/form-data":                  ║
║    - Call await request.formData()                      ║
║    - Extract all form fields & file                     ║
║ 3. Else: Parse as JSON                                  ║
║                                                          ║
║ EXTRACT FormData fields:                                ║
║ • interviewMode = 'resume'                              ║
║ • type = 'technical'                                    │
║ • role = 'Backend Engineer'                             │
║ • level = 'senior'                                      │
║ • techstack = 'Node.js, PostgreSQL'                     │
║ • amount = 5                                            │
║ • userid = 'firebase-uid'                               │
║ • resumePdf = File object                                │
║                                                          ║
║ FILE VALIDATION:                                        ║
║ if (!(resumePdf instanceof File)) {                     ║
║   return 400: "Upload a PDF resume..."                 ║
║ }                                                        ║
║                                                          ║
║ if (resumePdf.size > MAX_PDF_BYTES) { // 5 MB          ║
║   return 400: "PDF too large (max 5 MB)"               ║
║ }                                                        ║
║                                                          ║
║ if (!name.endsWith('.pdf')) {                           ║
║   return 400: "Only PDF files accepted"                ║
║ }                                                        ║
╚════════════════════════┬═════════════════════════════════╝
                         ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 3: EXTRACT TEXT FROM PDF                           │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ TO: lib/rag/extract-pdf-text.ts                         │
│ Function: extractTextFromPdfBuffer(buffer)              │
│                                                          │
│ INPUT:                                                   │
│ • resumePdf (File object)                               │
│ • Call: Buffer.from(await resumePdf.arrayBuffer())      │
│ • Result: buf (Node.js Buffer of file bytes)            │
│                                                          │
│ PROCESSING:                                             │
│ • Send buffer to FastAPI `/extract-pdf`                 │
│ • Python service uses `pypdf.PdfReader`                 │
│ • Service returns JSON with extracted text              │
│ • Handles: Multi-page PDFs, text encoding, etc.         │
│                                                          │
│ OUTPUT: pdfData.text (string)                           │
│ Value: "John Doe\nFrontend Engineer\n\n               │
│         EXPERIENCE\nXYZ Company...\n\n                 │
│         PROJECTS\nE-commerce..."                       │
│                                                          │
│ Error Handling:                                         │
│ • If PDF is scanned (no text layer):                    │
│   Returns empty or garbage text                         │
│   → Backend validates next step                        │
│   → Returns error: "No text in PDF or scanned image"   │
│                                                          │
│ Result: resumeText (raw extracted text)                 │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 4: NORMALIZE RESUME TEXT                           │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ TO: lib/rag/resume-rag.ts                               │
│ Function: normalizeResumeText(resumeText)               │
│                                                          │
│ INPUT: Raw resume text (8,000 chars example)            │
│ "John Doe\r\n\r\nFrontend Engineer\r\n\r\n\r\n..."      │
│                                                          │
│ PROCESSING (3 steps):                                   │
│ 1. Fix line breaks: .replace(/\r\n/g, "\n")             │
│    Windows (\\r\\n) → Unix (\\n)                        │
│    Result: "John Doe\n\nFrontend Engineer..."           │
│                                                          │
│ 2. Trim: .trim()                                        │
│    Remove leading/trailing whitespace                  │
│                                                          │
│ 3. Fix multiple newlines: .replace(/\n{3,}/g, "\n\n")   │
│    Remove 3+ consecutive newlines → 2 newlines         │
│    Result: "John Doe\n\nFrontend Engineer..."          │
│                                                          │
│ OUTPUT: fullResumeText (normalized)                     │
│ Length: 8,000 chars → 7,850 chars (normalized)         │
│ Next: Verify length                                     │
│                                                          │
│ LENGTH VALIDATION:                                      │
│ if (fullResumeText.length > MAX_RESUME_CHARS) {        │
│   // MAX_RESUME_CHARS = 50,000                         │
│   return 400: "Resume too long (max 50k chars)"        │
│ }                                                        │
│                                                          │
│ if (!fullResumeText.length) {                           │
│   return 400: "No text extracted. Use text-based PDF"   │
│ }                                                        │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 5: EXTRACT PROJECTS FROM RESUME                    │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ TO: lib/rag/resume-rag.ts                               │
│ Function: extractProjectsWithTech(fullResumeText)       │
│                                                          │
│ INPUT: fullResumeText (normalized resume)               │
│ "...\nPROJECTS\n\nE-commerce Platform | React,Node.js..│
│                                                          │
│ ALGORITHM:                                              │
│                                                          │
│ 1. Split text into lines: lines = text.split("\n")     │
│                                                          │
│ 2. Find PROJECTS section:                              │
│    Loop through lines, find /^(PROJECTS|PROJECT WORK)/ │
│    projectSectionStart = foundLineIndex + 1            │
│                                                          │
│ 3. Parse each project line:                            │
│    Match patterns: "Name | Tech1, Tech2"               │
│    OR: "Name\n- description"                           │
│                                                          │
│    Extract:                                             │
│    • projectName = capitalize(name)                    │
│    • techs = [split by comma]                          │
│    • fullText = [project line + next 10 description]   │
│                                                          │
│ 4. Deduplication:                                       │
│    Use Set<string> to avoid duplicate projects         │
│                                                          │
│ 5. Limits:                                              │
│    Max 5 projects returned                             │
│    Max 10 techs per project                            │
│    Max 10 description lines                            │
│                                                          │
│ 6. Stop conditions:                                     │
│    • Hit next section (EXPERIENCE, EDUCATION, etc.)    │
│    • 5 projects found                                   │
│    • End of file                                        │
│                                                          │
│ OUTPUT: allProjects[]                                   │
│ Type: {name, tech[], fullText}[]                       │
│ Example: [                                              │
│   {                                                      │
│     name: "E-commerce Platform",                        │
│     tech: ["React", "Node.js", "MongoDB"],             │
│     fullText: "E-commerce Platform | React,Node.js...  │
│                - Designed scalable payment..."         │
│   },                                                    │
│   {                                                      │
│     name: "Weather Dashboard",                          │
│     tech: ["React", "API"],                            │
│     fullText: "Weather Dashboard | React, API\n..."    │
│   },                                                    │
│   ...                                                   │
│ ]                                                       │
│ Length: 3 projects                                      │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 6: FILTER PROJECTS BY USER TECH STACK             │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ TO: lib/rag/resume-rag.ts                               │
│ Function: filterProjectsByTech(allProjects, userTech)   │
│                                                         │
│ INPUT:                                                  │
│ • allProjects = [                                       │
│     {name: "E-commerce Platform", tech: [...], ...},    │
│     {name: "Weather Dashboard", tech: [...], ...},      │
│     {name: "ML Model", tech: ["Python"], ...}           │
│   ]                                                     │
│ • userTechArray = ["Node.js", "React", "PostgreSQL"]    │
│                                                         │
│ ALGORITHM:                                              │
│                                                         │
│ 1. Normalize both arrays to lowercase:                  │
│    userTech = ["node.js", "react", "postgresql"]        │
│    projectTech = ["react", "node.js", "mongodb"]        │
│                                                         │
│ 2. For each project:                                    │
│    Check if ANY project.tech matches ANY user.tech      │
│                                                         │
│    Matching logic:                                      │
│    • Exact match: "react" === "react" ✓                 │
│    • Partial match: "react.js" includes "react" ✓       │
│    • Case insensitive: "React" → "react" ✓              │
│    • Word boundary: avoid false positives               │
│      (e.g., "react" matches "react" but not "reactive") │
│                                                          │
│ 3. Filter projects:                                     │
│    Keep only projects with ≥1 matching tech             │
│                                                          │
│ 4. Fallback logic:                                      │
│    If NO projects match user tech:                     │
│      Return top 2 projects anyway                      │
│      (better to ask about something than nothing)       │
│                                                          │
│ OUTPUT: filteredProjects[]                              │
│ Example (from above):                                   │
│ [                                                        │
│   {                                                      │
│     name: "E-commerce Platform",                        │
│     tech: ["React", "Node.js", "MongoDB"],             │
│     fullText: "..."                                      │
│   },                                                    │
│   {                                                      │
│     name: "Weather Dashboard",                          │
│     tech: ["React", "API"],                            │
│     fullText: "..."                                     │
│   }                                                     │
│ ]                                                       │
│ Length: 2 projects (ML Model filtered out - no match)  │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 7: DEBUG LOGGING                                   │
│                                                          │
│ Console output:                                         │
│ [RESUME] Full Resume Text Size: 7850 chars             │
│ [RESUME] All Projects Extracted: 3                      │
│ [RESUME] Filtered Projects: 2                           │
│ [RESUME] User Tech Stack: Node.js, React, PostgreSQL   │
│ [RESUME]   [1] E-commerce Platform (React, Node.js...) │
│ [RESUME]   [2] Weather Dashboard (React, API)           │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 8: BUILD RESUME-FOCUSED PROMPT                     │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ Calls: lib/rag/resume-rag.ts (already completed)        │
│                                                          │
│ Create projectsDisplay string:                          │
│ filteredProjects.map(p =>                              │
│   `Project: ${p.name}                                   │
│    Technologies: ${p.tech.join(", ")}                  │
│    Description: ${p.fullText}`                          │
│ ).join("\n\n")                                          │
│                                                          │
│ Result:                                                 │
│ "Project: E-commerce Platform                          │
│  Technologies: React, Node.js, MongoDB                 │
│  Description: E-commerce Platform | React, Node.js...  │
│   - Designed scalable payment system...                │
│                                                          │
│  Project: Weather Dashboard                            │
│  Technologies: React, API                              │
│  Description: Weather Dashboard | React, API\n..."     │
│                                                          │
│ Build full prompt:                                      │
│ prompt = `You are a senior engineer reviewing a        │
│ candidate's REAL projects.                             │
│                                                          │
│ USER TECH STACK:                                        │
│ Node.js, React, PostgreSQL                             │
│                                                          │
│ RELEVANT PROJECTS FROM RESUME:                         │
│ ${projectsDisplay}                                      │
│                                                          │
│ STRICT RULES:                                           │
│ * Use ONLY project names listed above                  │
│ * Do NOT invent any project                            │
│ * Each question MUST include project name exactly      │
│ * Questions must involve BOTH project + tech stack    │
│ * Ask about: edge cases, failures, performance,        │
│   internal working                                      │
│                                                          │
│ Generate 5 deep technical interview questions.         │
│ Return ONLY JSON array of strings.`                    │
│                                                          │
│ Output: prompt string (~1,500 chars)                   │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 9: CALL GROQ LLM API (SAME AS STANDARD MODE)       │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ TO: lib/groq.ts                                         │
│ Function: generateText() from Vercel AI SDK              │
│                                                          │
│ • Call generateText() from Vercel AI SDK                │
│ • Pass prompt to groq('llama-3.3-70b-versatile')       │
│ • Get back generated questions in JSON format          │
│ • Time: 2-8 seconds                                     │
│                                                          │
│ responseText = "[\"Question 1 about E-commerce...\",   │
│                 \"Question 2 about Weather...\",        │
│                 \"Question 3 about...\",                │
│                 \"Question 4 about...\",                │
│                 \"Question 5 about...\"]"               │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 10: PARSE RESPONSE                                 │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ Utility: built-in JSON parsing                          │
│                                                          │
│ Same as Standard Mode:                                  │
│ • Extract JSON array from response                      │
│ • Parse into questions: string[]                        │
│ • Validate count matches amount                         │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 11: VALIDATE QUESTIONS (RESUME MODE ONLY!)         │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ Purpose: Prevent LLM hallucination                      │
│                                                          │
│ NEW SAFETY LAYER:                                       │
│ Ensure LLM didn't hallucinate projects                  │
│                                                          │
│ CODE:                                                    │
│ if (interviewMode === 'resume') {                       │
│   const validProjectNames =                             │
│     filteredProjects.map(p => p.name)                  │
│   // ["E-commerce Platform", "Weather Dashboard"]      │
│                                                          │
│   const validationErrors = []                           │
│                                                          │
│   questions.forEach((question, idx) => {                │
│     // Check 1: Must include ≥1 valid project name    │
│     const hasValidProject =                             │
│       validProjectNames.some(projectName =>            │
│         question.includes(projectName)                  │
│       )                                                  │
│                                                          │
│     if (!hasValidProject) {                             │
│       validationErrors.push(                            │
│         `Q${idx+1}: No valid project referenced`       │
│       )                                                  │
│     }                                                    │
│   })                                                     │
│                                                          │
│   if (validationErrors.length > 0) {                    │
│     return 500: {                                        │
│       error: "Questions failed validation",             │
│       details: validationErrors.join('\n')              │
│     }                                                    │
│   }                                                      │
│ }                                                        │
│                                                          │
│ Returns:                                                │
│ ✓ All questions include filtered project names         │
│ ✓ No hallucinated projects detected                     │
│ ✓ Safe to save to database                             │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 12: SAVE TO FIRESTORE                              │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ TO: Firestore Database (via Firebase SDK)               │
│ Collection: "interviews"                                │
│                                                          │
│ Create interview document:                              │
│                                                          │
│ const interview = {                                     │
│   role: "Backend Engineer",                             │
│   type: "technical",                                    │
│   level: "senior",                                      │
│   techstack: ["Node.js", "PostgreSQL"],                │
│   questions: ["Q1 about E-commerce...", "Q2..."],      │
│   userId: "firebase-uid",                              │
│   finalized: true,                                      │
│   coverImage: "https://...",                            │
│   createdAt: "2026-04-05T11:15:00.000Z",               │
│   interviewMode: "resume",                              │
│   resumeFileName: "My Resume.pdf",                      │
│   extractedResumeTextLength: 7850,                      │
│   projectsExtracted: 3,                                 │
│   projectsFiltered: 2                                   │
│ }                                                       │
│                                                          │
│ Save:                                                    │
│ await db.collection("interviews").add(interview)       │
│                                                          │
│ Firestore writes document, returns newInterview.id      │
└──────────────────────────────────────┬───────────────────┘
                                       ↓

┌──────────────────────────────────────────────────────────┐
│ STEP 13: RETURN RESPONSE & REDIRECT                     │
│                                                          │
│ FROM: app/api/vapi/generate/route.ts                    │
│ TO: components/executeWorkflow.tsx (frontend)           │
│                                                          │
│ Return 200: {success: true, interviewId}                │
│ Frontend redirects to /interview/[id]                   │
│ Page loads 2 questions + voice                         │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 Clear Mode Separation (No Hybrid)

### Resume Mode Requirements

| Aspect | Requirement |
|--------|-------------|
| **Input** | PDF file (REQUIRED) + form fields |
| **Content-Type** | `multipart/form-data` |
| **Processing** | PDF → Text Extraction → Normalization → Project Parsing → Tech Filtering |
| **Output** | ALL questions reference only filtered projects |
| **Personalization** | High - grounded in candidate's real experience |
| **Project Requirement** | ALL questions MUST include exact filtered project names |

### Standard Mode Requirements

| Aspect | Requirement |
|--------|-------------|
| **Input** | Form fields ONLY (NO PDF allowed) |
| **Content-Type** | `application/json` |
| **Processing** | Direct form parsing |
| **Output** | Generic role/tech-based questions |
| **Personalization** | None - no resume context |
| **Project Requirement** | NO project references allowed |

### Key Differences

| Aspect | Standard Mode | Resume Mode |
|--------|---|---|
| Resume Required | ❌ No (ignored) | ✅ Yes (error if missing) |
| PDF Processing | ❌ None | ✅ Full pipeline |
| Project Extraction | ❌ None | ✅ All projects extracted |
| Project Filtering | ❌ N/A | ✅ Filter by tech match |
| Question Personalization | ❌ Generic | ✅ Specific to projects |
| All Questions Reference Projects | ❌ None | ✅ 100% must |
| LLM Validation for Projects | ❌ No | ✅ Yes - prevent hallucination |

---

## 📁 Complete File Path Reference Guide

This section maps every file involved in the interview generation flow:

### Frontend (User Interface)

**Form Entry Points:**
- [app/(root)/interview/page.tsx](app/(root)/interview/page.tsx) — Main form UI - displays both Standard & Resume mode options
- [components/executeWorkflow.tsx](components/executeWorkflow.tsx) — Form submission handler, validation logic, API calls

**Form Components Used:**
- [components/FormField.tsx](components/FormField.tsx) — Input wrapper with label & error display
- [components/ui/input.tsx](components/ui/input.tsx) — Base input element
- [components/ui/button.tsx](components/ui/button.tsx) — Submit button
- [components/ui/form.tsx](components/ui/form.tsx) — Form context/wrapper (from shadcn)

**Authentication:**
- [app/(auth)/sign-up/page.tsx](app/(auth)/sign-up/page.tsx) — User registration page
- [app/(auth)/sign-in/page.tsx](app/(auth)/sign-in/page.tsx) — User login page
- [components/AuthForm.tsx](components/AuthForm.tsx) — Auth form with email/password inputs

**Interview Display:**
- [app/(root)/interview/[id]/page.tsx](app/(root)/interview/[id]/page.tsx) — Shows generated questions, records voice
- [app/(root)/interview/[id]/feedback/page.tsx](app/(root)/interview/[id]/feedback/page.tsx) — Post-interview feedback view

**Shared Components:**
- [components/LogoutButton.tsx](components/LogoutButton.tsx) — User logout functionality
- [components/InterviewCard.tsx](components/InterviewCard.tsx) — Card display for past interviews
- [components/DisplayTechIcons.tsx](components/DisplayTechIcons.tsx) — Tech stack visualization

---

### Backend API

**Main API Endpoint:**
- [app/api/vapi/generate/route.ts](app/api/vapi/generate/route.ts) — **CRITICAL** - Handles both Standard & Resume mode requests

**Flow Inside route.ts:**
```
1. Check Content-Type → Determine mode (JSON vs FormData)
2. Parse & validate inputs
3. IF mode === "resume":
   - Call extractTextFromPdfBuffer() from lib/rag/extract-pdf-text.ts
   - Call normalizeResumeText() from lib/rag/resume-rag.ts
   - Call extractProjectsWithTech() from lib/rag/resume-rag.ts
   - Call filterProjectsByTech() from lib/rag/resume-rag.ts
   - Build resume-specific prompt
4. ELSE:
   - Build standard prompt
5. Call generateText() from lib/groq.ts
6. Parse & validate response
7. IF mode === "resume": Validate questions reference projects
8. Save to Firestore via Firebase SDK
9. Return { success, interviewId }
```

---

### RAG (Resume Analysis) Pipeline

**PDF Text Extraction:**
- [lib/rag/extract-pdf-text.ts](lib/rag/extract-pdf-text.ts) — Node adapter that sends PDF buffer to FastAPI extraction service
  - Function: `extractTextFromPdfBuffer(buffer: Buffer): Promise<string>`
  - Input: File buffer from FormData
  - Output: Raw resume text from FastAPI JSON response
- [lib/rag/pdf_server.py](lib/rag/pdf_server.py) — FastAPI extraction service using `pypdf`
  - Endpoint: `POST /extract-pdf`
  - Response: `{ text, error }`

**Resume Processing:**
- [lib/rag/resume-rag.ts](lib/rag/resume-rag.ts) — **CRITICAL** - Core resume analysis
  - Function: `normalizeResumeText(text: string): string`
    - Fixes line breaks (Windows → Unix)
    - Removes extra whitespace
    - Normalizes newlines
  - Function: `extractProjectsWithTech(text: string): Project[]`
    - Finds "PROJECTS" section in resume
    - Parses project names & technologies
    - Returns max 5 projects with deduplication
  - Function: `filterProjectsByTech(projects: Project[], userTech: string[]): Project[]`
    - Matches projects to user's tech stack
    - Case-insensitive, partial matching
    - Fallback: returns top 2 if no matches

**RAG Constants:**
- [lib/rag/constants.ts](lib/rag/constants.ts) — Magic strings for resume parsing
  - Project section headers
  - Max sizes / limits
  - Parsing patterns

---

### LLM Integration

**Groq LLM Wrapper:**
- [lib/groq.ts](lib/groq.ts) — Wrapper around Vercel AI SDK for Groq API
  - Function: `generateText(prompt: string): Promise<string>`
  - Uses: `groq('llama-3.3-70b-versatile')` model
  - Returns: Generated interview questions as JSON array

---

### Database (Firebase)

**Authentication Client:**
- [firebase/client.ts](firebase/client.ts) — Firebase SDK setup for browser
  - Exports: `auth`, `db` instances
  - Used in: Frontend components, auth actions

**Admin SDK:**
- [firebase/admin.ts](firebase/admin.ts) — Firebase Admin SDK setup for server
  - Used in: Backend API routes
  - Firestore write operations

---

### Utilities & Types

**Type Definitions:**
- [types/index.ts](types/index.ts) — TypeScript interfaces for:
  - Interview structure
  - Project structure (for RAG)
  - Form inputs
  - API responses

**General Utilities:**
- [lib/utils.ts](lib/utils.ts) — Helper functions for:
  - Class names (className)
  - Common utilities

**Server Actions:**
- [lib/actions/auth.action.ts](lib/actions/auth.action.ts) — Server-side auth functions
  - signUp(), signIn(), signOut()
  - Firestore user creation
  - Session cookie management
- [lib/actions/general.action.ts](lib/actions/general.action.ts) — Other server actions

---

### Form Validation

**Form & Validation:**
- [components/FormField.tsx](components/FormField.tsx) — Zod validation schema for:
  - Standard mode inputs
  - Resume mode inputs (with PDF constraints)
- Validation happens at:
  1. Frontend: Real-time feedback
  2. Backend ([app/api/vapi/generate/route.ts](app/api/vapi/generate/route.ts)): Final check

---

### Configuration Files

**Build & Runtime:**
- [next.config.ts](next.config.ts) — Next.js configuration
- [package.json](package.json) — Dependencies (groq, firebase, zod, etc.) + Node client libs for PDF service integration
- [tsconfig.json](tsconfig.json) — TypeScript settings
- [postcss.config.mjs](postcss.config.mjs) — CSS processing (Tailwind)
- [eslint.config.mjs](eslint.config.mjs) — Code linting

---

### Layout Structure

**App Routes:**
- [app/layout.tsx](app/layout.tsx) — Root layout wrapper
- [app/(auth)/layout.tsx](app/(auth)/layout.tsx) — Auth pages layout (sign-up, sign-in)
- [app/(root)/layout.tsx](app/(root)/layout.tsx) — Main app layout (dashboard, interview)

**Styling:**
- [app/globals.css](app/globals.css) — Global styles (Tailwind)

---

## 🔀 Data Flow Summary

```
STANDARD MODE:
components/executeWorkflow.tsx (validate, form submit)
  ↓
app/api/vapi/generate/route.ts (parse JSON)
  ↓
lib/groq.ts (call LLM, get questions)
  ↓
app/api/vapi/generate/route.ts (save to Firestore)
  ↓
components/executeWorkflow.tsx (redirect to /interview/[id])


RESUME MODE:
components/executeWorkflow.tsx (validate, form submit + file)
  ↓
app/api/vapi/generate/route.ts (parse FormData, get PDF)
  ↓
lib/rag/extract-pdf-text.ts (extract text from PDF)
  ↓
lib/rag/resume-rag.ts (normalize text)
  ↓
lib/rag/resume-rag.ts (extract projects)
  ↓
lib/rag/resume-rag.ts (filter by tech)
  ↓
lib/groq.ts (call LLM with project context, get questions)
  ↓
app/api/vapi/generate/route.ts (validate project references)
  ↓
app/api/vapi/generate/route.ts (save to Firestore with metadata)
  ↓
components/executeWorkflow.tsx (redirect to /interview/[id])
```

---

## 🎯 Where to Make Changes

| Feature | Edit File |
|---------|-----------|
| Change interview form fields | [components/executeWorkflow.tsx](components/executeWorkflow.tsx) |
| Change form styling | [components/FormField.tsx](components/FormField.tsx) + [app/globals.css](app/globals.css) |
| Modify LLM prompt format | [app/api/vapi/generate/route.ts](app/api/vapi/generate/route.ts) (search for `BUILD PROMPT`) |
| Change PDF size limit | [lib/rag/constants.ts](lib/rag/constants.ts) |
| Adjust project extraction logic | [lib/rag/resume-rag.ts](lib/rag/resume-rag.ts) |
| Modify LLM model/settings | [lib/groq.ts](lib/groq.ts) |
| Change Firestore schema | [types/index.ts](types/index.ts) + [app/api/vapi/generate/route.ts](app/api/vapi/generate/route.ts) |
| Update interview display | [app/(root)/interview/[id]/page.tsx](app/(root)/interview/[id]/page.tsx) |
| Customize project filtering | [lib/rag/resume-rag.ts](lib/rag/resume-rag.ts) (`filterProjectsByTech` function) |
| Database Save | Form metadata | Form + resume metadata |

**Key Insight:** Both modes make EXACTLY ONE Groq API call. The only difference is the prompt content and input processing.

---

## 📊 Function Reference Guide

### All Functions Used in Interview Generation

#### `lib/rag/extract-pdf-text.ts`

```typescript
export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<string>

Input: Node.js Buffer (file bytes)
Process:
  - Build multipart request with `form-data`
  - Call FastAPI endpoint `/extract-pdf` using `fetch`
  - Apply timeout handling with `AbortController`
  - Parse JSON `{ text, error }` response
Output: Raw resume text string
Errors:
  - Timeout/network/service errors → descriptive error thrown
  - Scanned/empty text PDF → empty text with warning path
```

#### `lib/rag/resume-rag.ts`

```typescript
export function normalizeResumeText(raw: string): string

Input: Raw resume text with various line breaks
Process:
  - Replace \r\n with \n (Windows → Unix)
  - Trim whitespace
  - Replace 3+ newlines with 2
Output: Standardized text
Example: "Text\r\n\r\n\r\nMore" → "Text\n\nMore"

---

export function extractProjectsWithTech(
  text: string
): {name, tech[], fullText}[]

Input: Normalized resume text
Process:
  - Find PROJECTS section
  - Parse "Name | Tech1, Tech2" format
  - Extract description lines (max 10)
  - Max 5 projects, max 10 techs each
Output: Array of project objects
Example: [{name: "E-comm", tech: [...], fullText: "..."}, ...]

---

export function filterProjectsByTech(
  projects: {name, tech[], fullText}[],
  userTechStack: string[]
): {name, tech[], fullText}[]

Input:
  - Projects array (from extractProjectsWithTech)
  - User tech stack (from form)
Process:
  - Normalize both to lowercase
  - Match: exact, partial, case-insensitive
  - Keep projects with ≥1 match
  - Fallback: top 2 if no matches
Output: Filtered projects array
Example: Input 3 projects → Output 2 matching
```

#### `lib/groq.ts`

```typescript
export function groq(modelName: string): LanguageModel

Input: Model name - "llama-3.3-70b-versatile"
Process:
  - Create Groq API client
  - Configure with GROQ_API_KEY env var
Output: LanguageModel instance for Vercel AI SDK
Usage: Pass to generateText() from "ai" package
```

#### `app/api/vapi/generate/route.ts`

```typescript
export async function POST(request: Request): Promise<Response>

Input: HTTP request (JSON or FormData)
Process:
  - Parse based on Content-Type
  - Extract form fields
  - Validate all required fields
  - Branch: Standard or Resume mode
  - Build prompt (different for each mode)
  - Call Groq API via generateText()
  - Parse JSON response
  - (Resume only) Validate questions
  - Save to Firestore 
Output: JSON {success, interviewId} or error
```

#### `app/actions/auth.action.ts`

```typescript
export async function signUp(
  email: string,
  password: string
): Promise<{success: bool}>

Input: Email and password
Process:
  - Call Firebase Auth createUserWithEmailAndPassword()
  - Create Firestore user document
  - Set httpOnly session cookie
Output: {success: true} or throw error

---

export async function signIn(
  email: string,
  password: string
): Promise<{success: bool}>

Input: Email and password
Process:
  - Call Firebase Auth signInWithEmailAndPassword()
  - Get Firebase ID token
  - Create httpOnly session cookie
Output: {success: true} or throw error
```

### Firebase Admin SDK (Backend Only)

```typescript
import { db } from "@/firebase/admin"

// Get reference to "interviews" collection
db.collection("interviews")

// Add new document
.add(interviewData)
// Returns: DocumentReference with .id

// Read document
.doc(docId).get()
// Returns: DocumentSnapshot

// Update document
.doc(docId).update(updateData)

// Delete document
.doc(docId).delete()
```

---

## 🌐 API Endpoints Summary

### POST /api/vapi/generate

**Purpose:** Generate interview questions (Standard or Resume mode)

**Request (Standard Mode):**
```json
{
  "type": "technical",
  "role": "Frontend Engineer",
  "level": "mid-level",
  "techstack": "React, TypeScript",
  "amount": 5,
  "userid": "firebase-uid",
  "mode": "standard"
}
```

**Request (Resume Mode):**
```
FormData:
- mode: "resume"
- type: "technical"
- role: "Backend Engineer"
- level: "senior"
- techstack: "Node.js, PostgreSQL"
- amount: 5
- userid: "firebase-uid"
- resumePdf: File object (PDFfile.pdf)
```

**Response (Success):**
```json
{
  "success": true,
  "interviewId": "doc-id-abc123"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Stack trace (if 500)"
}
```

**Status Codes:**
- 200: Success
- 400: Validation error (missing fields, invalid file)
- 500: Server error (Groq API failure, DB error)

---

## ✅ Summary: Complete Data Flow

**Both modes converge at ONE point:**

```
Standard: Form → Groq
Resume:   PDF → Extract → Filter → Groq
                          ↓
                    BOTH: Parse → Validate → Save
```

**Key Flow:**
1. User submits form + optional PDF
2. Backend validates all inputs
3. If resume: extract, normalize, extract projects, filter projects
4. Build prompt (generic for Standard, project-specific for Resume)
5. Call Groq API ONCE
6. Parse JSON response
7. If Resume: validate questions reference filtered projects
8. Save to Firestore
9. Return interview ID
10. Frontend redirects to /interview/[id]

**Zero Hallucination:** Validation layer ensures resume mode questions only reference filtered projects.

**Performance:**
- Standard: ~3 seconds (form → Groq)
- Resume: ~5 seconds (PDF extract + Groq)

**Database Operations:**
- Firestore: 1 write per interview
- Firebase Auth: 1 read/write per login/signup

---

```
User Input (Email/Password)
       ↓
components/AuthForm.tsx (Zod validation)
       ↓
Firebase Auth: createUserWithEmailAndPassword() or signInWithEmailAndPassword()
       ↓
Server Action (lib/actions/auth.action.ts): signUp() or signIn()
       ↓
Firestore: Create/verify user document
├─ signUp: Create new user doc in "users" collection
└─ signIn: Create httpOnly session cookie
       ↓
Redirect to Dashboard (/)
```

**Firestore Structure:**
```
Collection: users
{
  "firebase-uid" (document ID)
  ├── name: "John Doe"
  ├── email: "john@example.com"
}
```

---

## 2. INTERVIEW GENERATION FLOW

### Entry Point: `/interview`

Two modes:
1. **Standard Mode**: Form input (role, level, tech stack) → Groq generates questions
2. **Resume Mode**: Form input + PDF resume → Extract text → Parse projects → Filter by tech → Groq generates grounded questions

---

## 3. STANDARD MODE (Form-Only)

```
┌─ User selects "Standard Mode" ─────────────────────────┐
│ Fills: Role, Interview Type, Level, Tech Stack, Amount │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
    POST /api/vapi/generate (JSON body)
                 │
                 ↓
    Build Prompt: [Role] + [Level] + [Tech Stack] + [Type]
                 │
                 ↓
    Call Groq LLM (llama-3.3-70b-versatile)
                 │
                 ↓
    Parse JSON Response: Extract questions array
                 │
                 ↓
    Save to Firestore (interviews collection)
    ├─ role, type, level
    ├─ techstack (array)
    ├─ questions: string[]
    ├─ userId
    ├─ interviewMode: "standard"
    └─ createdAt
                 │
                 ↓
    Return: { success: true, interviewId }
                 │
                 ↓
    Redirect to /interview/[id]
```

---

## 4. RESUME MODE (PDF + Filtered Projects)

### ⚠️ Important: Form Fields Are Required

Even with a resume, **form fields (role, level, tech stack) are critical** because they:
- Focus on the user's tech stack when filtering projects
- Ensure questions reference projects matching their selected technologies
- Prevent generic questions

Example: Same resume → different questions for "Frontend Engineer" vs "Backend Engineer"

---

### Complete Resume Mode Flow

```
┌─ User selects "Resume Mode" ───────────────────────────┐
│ Fills: Role, Type, Level, Tech Stack, Amount           │
│ Uploads: PDF Resume File                               │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
    ┌─ CLIENT-SIDE VALIDATION ─────────────── ──┐
    │ ✓ File ends with .pdf                     │
    │ ✓ File size ≤ 5 MB (MAX_PDF_BYTES)        │
    └──────────┬────────────────────────────────┘
               │
               ↓
    POST /api/vapi/generate (FormData with PDF)
               │
               ↓
    ┌──────────────────────────────────────────────┐
    │ STEP 1: Extract Text from PDF                │
    │ extractTextFromPdfBuffer()                   │
    │ - Calls FastAPI /extract-pdf (pypdf)         │
    │ - Returns: raw resume text                   │
    │ - Validates: Not > 50,000 characters         │
    │ - Validates: Not empty (text-based PDFs)     │
    └──────────┬───────────────────────────────────┘
               │
               ↓
    ┌──────────────────────────────────────────────┐
    │ STEP 2: Normalize Text                       │
    │ normalizeResumeText()                        │
    │ - Fix line breaks (Windows → Unix)           │
    │ - Remove extra whitespace                    │
    │ - Standardize formatting                     │
    └──────────┬───────────────────────────────────┘
               │
               ↓
    ┌──────────────────────────────────────────────┐
    │ STEP 3: Extract All Projects                 │
    │ extractProjectsWithTech(fullResumeText)     │
    │ - Parse PROJECTS section                     │
    │ - Extract project names                      │
    │ - Extract technologies for each              │
    │ - Collect project descriptions               │
    │ - Returns max 5 projects                      │
    │                                              │
    │ Output: [{                                   │
    │   name: "E-commerce Platform",              │
    │   tech: ["React", "Node.js", "MongoDB"],    │
    │   fullText: "E-commerce Platform | React... │
    │ }, ...]                                      │
    └──────────┬───────────────────────────────────┘
               │
               ↓
    ┌──────────────────────────────────────────────┐
    │ STEP 4: Filter Projects by Tech Stack        │
    │ filterProjectsByTech(projects, userTech)    │
    │                                              │
    │ THREE-STEP ALGORITHM:                        │
    │ 1. SELECT ALL matching projects              │
    │    - Parse user tech stack from form         │
    │    - Match projects where ≥1 tech matches    │
    │    - Support case-insensitive + partial      │
    │                                              │
    │ 2. ENSURE MINIMUM 2 PROJECTS                 │
    │    - If less than 2 matched:                 │
    │      Add non-matched projects as fallback    │
    │    - Always return min 2 for variety         │
    │                                              │
    │ 3. RETURN PRIORITIZED LIST                   │
    │    [matched projects, ...fallback projects]  │
    │                                              │
    │ Matching Logic:                              │
    │ - "react.js" matches "react" ✓              │
    │ - "React" matches "REACT" ✓                 │
    │ - Case-insensitive, word boundary aware     │
    │                                              │
    │ Examples:                                    │
    │ - 3 matched, 2 total → return all 3 ✓       │
    │ - 1 matched, 5 total → 1 matched + 1 other  │
    │ - 0 matched, 3 total → top 2 projects        │
    └──────────┬───────────────────────────────────┘
               │
               ↓
    ┌──────────────────────────────────────────────┐
    │ STEP 5: Build Grounded Prompt                │
    │                                              │
    │ Format:                                      │
    │ "You are a senior engineer reviewing        │
    │  a candidate's REAL projects.               │
    │                                              │
    │  USER TECH STACK:                           │
    │  React, Node.js, MongoDB                    │
    │                                              │
    │  RELEVANT PROJECTS FROM RESUME:             │
    │  Project: E-commerce Platform               │
    │  Technologies: React, Node.js, MongoDB      │
    │  Description: ... [full project text]       │
    │                                              │
    │  STRICT RULES:                              │
    │  * Use ONLY project names listed above      │
    │  * Do NOT invent any project                │
    │  * Each question MUST include project name  │
    │  * Questions must involve BOTH project       │
    │    AND the tech stack mentioned             │
    │  * Ask about edge cases, failures,           │
    │    performance, internal working            │
    │                                              │
    │  Generate N deep technical questions.       │
    │  Return ONLY JSON array."                   │
    └──────────┬───────────────────────────────────┘
               │
               ↓
    Call Groq API (llama-3.3-70b-versatile)
               │
               ↓
    ┌──────────────────────────────────────────────┐
    │ VALIDATION: Verify Question Quality          │
    │                                              │
    │ For each generated question:                 │
    │ ✓ Must include ≥1 filtered project name     │
    │ ✓ Must NOT reference non-filtered projects  │
    │                                              │
    │ If validation fails:                         │
    │ → Throw error with detailed feedback        │
    │ → API returns 500 with validation details   │
    └──────────┬───────────────────────────────────┘
               │
               ↓
    Parse JSON Response: Extract questions array
               │
               ↓
    Save to Firestore → Redirect to /interview/[id]
```

---

**Resume Mode:**
```
PDF → Extract Text → Normalize → Parse Projects → Filter by Tech Stack → Build Prompt → Groq → Save to DB
```

---

## 7. GUARANTEED SAFETY MECHANISMS

✅ Extracts only projects section from resume  
✅ Filters projects by user's tech stack  
✅ Always minimum 2 projects returned (with fallback)  
✅ Full resume text sent to Groq (no chunking/sampling)  
✅ Debug logging shows extracted and filtered projects  

---

## 8. KEY FILES SUMMARY

| File | Lines | Purpose |
|------|-------|---------|
| `app/api/vapi/generate/route.ts` | 330 | API endpoint, mode routing, debug logging |
| `lib/rag/resume-rag.ts` | ~200 | Text normalization, project extraction, project filtering |
| `lib/rag/extract-pdf-text.ts` | ~75 | Node adapter for FastAPI PDF extraction |
| `lib/rag/pdf_server.py` | ~137 | FastAPI microservice using pypdf/PdfReader |
| `lib/rag/constants.ts` | ~10 | MAX_RESUME_CHARS, MAX_PDF_BYTES constants |

---

## 9. DEBUG OUTPUT EXAMPLE

```
========== RESUME MODE ==========
[RESUME] Full Resume Text Size: 7850 chars
[RESUME] All Projects Extracted: 3
[RESUME] Filtered Projects: 2
[RESUME] User Tech Stack: Node.js, React, PostgreSQL
[RESUME]   [1] E-commerce Platform (React, Node.js, MongoDB)
[RESUME]   [2] Weather Dashboard (React, API)
==================================
```

---

## 10. TROUBLESHOOTING

| Problem | Debug Step |
|---------|-----------|
| No projects extracted | Check resume: must have PROJECTS section |
| Questions don't use filtered projects | Check `[RESUME] Filtered Projects` count - if 0, no projects matched user tech stack |
| PDF extraction failed | Check resume: max 5MB, text-based PDF (not scanned image) |
| No questions generated | Check Groq API key, check console for errors |
| Wrong projects selected | Resume projects may not have matching tech. Provide projects that use your selected tech stack |
| Resume too large | Check `[RESUME] Full Resume Text Size` - max 50,000 characters |

---

## 11. SIMPLIFIED DATA FLOW DIAGRAMS (Two-Mode System)

### Complete System Overview - Both Modes in Parallel

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         INTERVIEW GENERATION SYSTEM                             │
│                            (Two Clear Paths)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                              USER VISITS /interview
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                    ┌────▼──────┐            ┌────▼──────┐
                    │ Standard  │            │  Resume   │
                    │   Mode    │            │   Mode    │
                    └────┬──────┘            └────┬──────┘
                         │                        │
                         │                        │
    ╔════════════════════════════╗    ╔════════════════════════════╗
    ║   STANDARD MODE FLOW       ║    ║   RESUME MODE FLOW         ║
    ║   (Generic Questions)      ║    ║   (Project-Based Qs)       ║
    ╠════════════════════════════╣    ╠════════════════════════════╣
    ║                            ║    ║                            ║
    ║  INPUT:                    ║    ║  INPUT:                    ║
    ║  ✓ Role                    ║    ║  ✓ Role                    ║
    ║  ✓ Level                   ║    ║  ✓ Level                   ║
    ║  ✓ Tech Stack              ║    ║  ✓ Tech Stack              ║
    ║  ✓ Type (technical etc)    ║    ║  ✓ Type (technical etc)    ║
    ║  ✓ Amount (1-10)           ║    ║  ✓ Amount (1-10)           ║
    ║  ✗ NO FILE                 ║    ║  ✓ PDF FILE (REQUIRED)     ║
    ║                            ║    ║                            ║
    ║  Content-Type:             ║    ║  Content-Type:             ║
    ║  application/json          ║    ║  multipart/form-data       ║
    ║                            ║    ║                            ║
    ╚────────────┬───────────────╝    ╚────────────┬───────────────╝
                 │                                 │
                 │                                 │
         ┌───────▼────────┐            ┌──────────▼─────────┐
         │ Parse JSON     │            │ Extract PDF Text   │
         │ Validate Form  │            │ (FastAPI + pypdf)  │
         │ Fields         │            │                    │
         └───────┬────────┘            └──────────┬─────────┘
                 │                                 │
                 │                                 │
         ┌───────▼────────────┐        ┌──────────▼──────────┐
         │ Build Generic      │        │ Normalize Text      │
         │ Prompt             │        │ (fix line breaks)   │
         │                    │        │                     │
         │ [Role]             │        │ [8000-50k chars]    │
         │ [Level]            │        └──────────┬──────────┘
         │ [Tech Stack]       │                   │
         │ [Type]             │        ┌──────────▼──────────┐
         │                    │        │ Extract Projects    │
         │ "Generic           │        │ from Resume         │
         │  Role/Tech Qs"     │        │                     │
         │                    │        │ [1-5 projects]      │
         └───────┬────────────┘        └──────────┬──────────┘
                 │                                 │
                 │                                 │
         ┌───────▼────────────┐        ┌──────────▼──────────┐
         │ Call Groq LLM      │        │ Filter by User      │
         │ (llama-3.3-70b)    │        │ Tech Stack          │
         │                    │        │                     │
         │ Input: Prompt      │        │ Match: React, Node  │
         │ Output: [ Q1, Q2..] │        │ Keep: Matching      │
         │                    │        │ projects only       │
         │ Time: 2-8 sec      │        │                     │
         └───────┬────────────┘        │ Fallback: Top 2     │
                 │                    │ if no matches       │
                 │                    └──────────┬──────────┘
         ┌───────▼────────────┐                  │
         │ Parse JSON Array   │        ┌─────────▼──────────┐
         │ [ Q1, Q2, Q3... ]  │        │ Build Resume       │
         │                    │        │ Contextual Prompt  │
         │                    │        │                    │
         │                    │        │ "Questions MUST    │
         │                    │        │  reference these   │
         │                    │        │  projects ONLY"    │
         │                    │        │                    │
         │                    │        │ [E-commerce Plat]  │
         │                    │        │ [Weather App]      │
         │                    │        │                    │
         │                    │        └─────────┬──────────┘
         │                    │                  │
         │                    │        ┌─────────▼──────────┐
         │                    │        │ Call Groq LLM      │
         │                    │        │ (llama-3.3-70b)    │
         │                    │        │                    │
         │                    │        │ Input: Prompt with │
         │                    │        │ project context    │
         │                    │        │                    │
         │                    │        │ Output: [ Q1, Q2..]│
         │                    │        │ (ALL reference     │
         │                    │        │  projects)         │
         │                    │        │                    │
         │                    │        └─────────┬──────────┘
         │                    │                  │
         │                    │        ┌─────────▼──────────┐
         │                    │        │ Parse & Validate   │
         │                    │        │ JSON Array         │
         │                    │        │                    │
         │                    │        │ ✅ Verify each Q   │
         │                    │        │    references ≥1   │
         │                    │        │    filtered        │
         │                    │        │    project         │
         │                    │        │                    │
         │                    │        │ ❌ Reject if       │
         │                    │        │    hallucinated    │
         │                    │        │    projects found  │
         │                    │        │                    │
         │                    │        └─────────┬──────────┘
         │                    │                  │
         └────────┬───────────┴──────────────────┘
                  │
                  │
         ┌────────▼──────────────┐
         │ Save to Firestore     │
         │ (interviews coll)     │
         │                       │
         │ Document fields:      │
         │ ├─ role               │
         │ ├─ level              │
         │ ├─ techstack[]        │
         │ ├─ questions[]        │
         │ ├─ userId             │
         │ ├─ interviewMode     │
         │ │  "standard" or     │
         │ │  "resume"          │
         │ └─ createdAt         │
         │                      │
         │ RESUME MODE EXTRA:   │
         │ ├─ resumeFileName    │
         │ ├─ textLength        │
         │ └─ projectsFiltered  │
         │                      │
         └────────┬─────────────┘
                  │
                  │
         ┌────────▼──────────────┐
         │ Return to Frontend    │
         │                       │
         │ {                     │
         │   success: true,      │
         │   interviewId: "abc"  │
         │ }                     │
         └────────┬─────────────┘
                  │
                  │
         ┌────────▼──────────────┐
         │ Redirect Browser      │
         │ to                    │
         │ /interview/[id]       │
         │                       │
         │ Display Questions     │
         │ & Record Voice        │
         └───────────────────────┘
```

---

### Quick Reference: What Happens at Each API Call

**Standard Mode → 1 LLM Call**
```
form data (role, level, tech, type)
          ↓
    Build prompt
          ↓
    Call Groq (1x) ← Generate generic questions
          ↓
    Parse + Save
          ↓
    Return to frontend
```

**Resume Mode → 2-3 Processing Steps → 1 LLM Call**
```
form data + PDF
          ↓
    Extract text (FastAPI + pypdf)
          ↓
    Normalize text
          ↓
    Extract projects (PROJECTS section)
          ↓
    Filter by user tech
          ↓
    Build contextualized prompt
          ↓
    Call Groq (1x) ← Generate project-specific questions
          ↓
    Validate questions mention projects
          ↓
    Parse + Save + Metadata
          ↓
    Return to frontend
```

---

### Key Differences at a Glance

| Aspect | Standard Mode | Resume Mode |
|--------|---|---|
| **User Input** | Form fields only | Form + PDF file |
| **Request Type** | POST with JSON | POST with FormData |
| **Pre-LLM Processing** | Minimal (parse form) | Extensive (PDF → projects) |
| **Prompt Content** | Generic role/tech | Generic + project context |
| **Questions** | Generic best practices | Specific to candidate's projects |
| **Validation Step** | Basic field check | Advanced (project reference check) |
| **Firestore Extra Data** | None | resumeFileName, textLength, projectCount |
| **Time to Response** | 2-8 sec | 3-15 sec (includes PDF processing) |

---

### Decision Tree: Which Path Does Request Take?

```
                    Request arrives
                         │
            Check Content-Type header
                    │
        ┌───────────┴───────────┐
        │                       │
    JSON?               multipart/form-data?
    │                           │
    │                           │
    ▼                           ▼
STANDARD MODE              RESUME MODE
    │                           │
    Parse JSON                  │
    ├─ role                     │
    ├─ level              Parse FormData
    ├─ techstack          ├─ role
    ├─ type               ├─ level
    ├─ amount             ├─ techstack
    └─ userid             ├─ type
                          ├─ amount
                          ├─ userid
    ↓                     └─ resumePdf (File)
                               │
    Resume          Check: PDF must exist?
    required? No    │
    │               ├─ Yes → Continue
    Yes?            └─ No → Error 400
    │
    Build generic  ▼
    prompt →   Extract PDF text
                │
    ▼          ├─ Text length valid?
    Call       │ ├─ Yes → Continue
    Groq       │ └─ No → Error 400
    │          │
    LLM        ├─ Text extracted?
    generates  │ ├─ Yes → Continue
    Qs         │ └─ No → Error 400
    │          │
    ▼         ▼
    Parse   Normalize text
    Qs        │
    │         ▼
    ▼     Extract projects
   Save       │
   to         ├─ Found ≥1?
   DB         │ ├─ Yes → Continue
    │         │ └─ No → Use fallback
    │         │
    └→────────┤  ▼
              Filter by tech
              │
              ├─ Matched?
              │ ├─ Yes → Use matched
              │ └─ No → Use top 2
              │
              ▼
           Build project
           contextual prompt
              │
              ▼
           Call Groq
           (same LLM)
              │
              ▼
           Validate: Every
           Q mentions ≥1
           filtered project?
              │
              ├─ Yes → Continue
              └─ No → Error 500
              │
              ▼
           Parse Qs
              │
              ▼
           Save + Metadata
              │
              ▼
           Return success
```

---

### Debugging: How to Trace Each Mode

**Standard Mode Debugging:**
```
1. Check browser console: is FormData being sent? → Should be JSON
2. Check backend logs: "HTTP Content-Type: application/json"
3. Expect: No PDF processing logs
4. Firestore doc: Should NOT have resumeFileName field
```

**Resume Mode Debugging:**
```
1. Check browser console: is PDF file attached?
2. Check backend logs:
   - "[RESUME] Full Resume Text Size: XXXX chars"
   - "[RESUME] All Projects Extracted: 3"
   - "[RESUME] Filtered Projects: 2"
3. Expect: All three log lines present
4. Firestore doc: Should HAVE resumeFileName, extractedResumeTextLength, etc.
```

---

### Performance Characteristics

| Metric | Standard Mode | Resume Mode | Notes |
|--------|---|---|---|
| **Frontend validation** | <1 sec | 1-2 sec | Resume: file size check |
| **API transmission** | ~50-500 KB | 500 KB - 5 MB | Resume: PDF file upload |
| **Backend processing** | <500 ms | 1-3 sec | Resume: PDF extraction + parsing |
| **LLM inference** | 2-8 sec | 2-8 sec | Same model, similar load |
| **Total time** | **3-10 sec** | **5-15 sec** | Resume adds ~2-5 sec overhead |
| **Firestore write** | <500 ms | <500 ms | Both use same write operation |
| **Network bandwidth** | Minimal | 1-5 MB | Resume: PDF file upload |


