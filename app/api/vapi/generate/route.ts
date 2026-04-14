// API route used by the interview-generation form.
//
// TWO DISTINCT MODES (No Hybrid):
//
// 1. RESUME MODE (FormData with PDF):
//    - Resume REQUIRED
//    - PDF → extract text → parse projects
//    - ALL questions reference extracted projects
//    - Personalized to candidate's real experience
//
// 2. STANDARD MODE (JSON body, no files):
//    - Resume NOT ALLOWED (ignored if provided in FormData)
//    - Generic role/tech-based questions
//    - No project extraction or references
//    - Pure interview questions
export const runtime = "nodejs";

import { generateText } from "ai";
import { groq } from "@/lib/groq";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { normalizeResumeText, extractProjectsWithTech, filterProjectsByTech } from "@/lib/rag/resume-rag";
import { extractTextFromPdfBuffer } from "@/lib/rag/extract-pdf-text";
import { MAX_RESUME_CHARS, MAX_PDF_BYTES } from "@/lib/rag/constants";

type InterviewMode = "standard" | "resume";

function distributeEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, idx) => base + (idx < remainder ? 1 : 0));
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  let type: string;
  let role: string;
  let level: string;
  let techstack: string;
  let amount: number;
  let userid: string;
  let companyType = "";
  let jobDescription = "";
  let interviewMode: InterviewMode = "standard";
  let resumeText: string | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      interviewMode =
        String(formData.get("mode") ?? "standard") === "resume"
          ? "resume"
          : "standard";

      type = String(formData.get("type") ?? "");
      role = String(formData.get("role") ?? "");
      level = String(formData.get("level") ?? "");
      techstack = String(formData.get("techstack") ?? "");
      userid = String(formData.get("userid") ?? "");
      companyType = String(formData.get("companyType") ?? "").trim();
      jobDescription = String(formData.get("jobDescription") ?? "").trim();
      const amountRaw = formData.get("amount");
      amount =
        typeof amountRaw === "string"
          ? Number(amountRaw)
          : Number(amountRaw ?? NaN);

      // RESUME MODE: Resume is REQUIRED
      const resumePdfFile = formData.get("resumePdf");
      
      if (interviewMode === "resume") {
        // Resume mode MUST have a PDF file
        if (!(resumePdfFile instanceof File)) {
          return Response.json(
            {
              success: false,
              error: "Resume mode requires a PDF file upload.",
            },
            { status: 400 }
          );
        }

        // Validate PDF file
        if (resumePdfFile.size > MAX_PDF_BYTES) {
          return Response.json(
            {
              success: false,
              error: `PDF is too large (max ${Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB).`,
            },
            { status: 400 }
          );
        }

        const name = resumePdfFile.name.toLowerCase();
        const mime = resumePdfFile.type;
        if (
          !name.endsWith(".pdf") &&
          mime !== "application/pdf" &&
          mime !== "application/x-pdf"
        ) {
          return Response.json(
            {
              success: false,
              error: "Only PDF files are accepted for resume uploads.",
            },
            { status: 400 }
          );
        }

        // Extract (Send this PDF to Python and give me back text )and validate resume text
        const buf = Buffer.from(await resumePdfFile.arrayBuffer());
        const extracted = await extractTextFromPdfBuffer(buf);
        resumeText = normalizeResumeText(extracted);

        if (!resumeText.length) {
          return Response.json(
            {
              success: false,
              error: "No text could be read from this PDF. Use a text-based PDF (not a scanned image) or export again from your editor.",
            },
            { status: 400 }
          );
        }

        if (resumeText.length > MAX_RESUME_CHARS) {
          return Response.json(
            {
              success: false,
              error: `Extracted resume is too long (max ${MAX_RESUME_CHARS} characters).`,
            },
            { status: 400 }
          );
        }
      } else {
        // STANDARD MODE: Ignore any uploaded PDF (FormData but standard mode)
        // No resume processing in standard mode
        if (resumePdfFile instanceof File) {
          console.log("[INFO] Standard mode: ignoring uploaded PDF file");
        }
      }
    } else {
      // Assume JSON body for standard mode (no file upload)
      const body = (await request.json()) as {
        type?: string;
        role?: string;
        level?: string;
        techstack?: string;
        amount?: number;
        userid?: string;
        companyType?: string;
        jobDescription?: string;
        mode?: InterviewMode;
      };

      interviewMode =
        body.mode === "resume" ? "resume" : "standard";

      if (interviewMode === "resume") {
        return Response.json(
          {
            success: false,
            error:
              "Resume-based interviews require a PDF upload (multipart form). Use the interview form with a PDF file.",
          },
          { status: 400 }
        );
      }

      // For standard mode, read parameters from JSON body
      type = (body.type ?? "").trim();
      role = (body.role ?? "").trim();
      level = (body.level ?? "").trim();
      techstack = (body.techstack ?? "").trim();
      userid = (body.userid ?? "").trim();
      companyType = (body.companyType ?? "").trim();
      jobDescription = (body.jobDescription ?? "").trim();
      amount = Number(body.amount);
    }

    if (
      // Basic validation of required parameters
      !type ||
      !role ||
      !level ||
      !techstack ||
      !userid ||
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > 10
    ) {
      return Response.json(
        { success: false, error: "Invalid or missing interview parameters." },
        { status: 400 }
      );
    }

    let prompt: string;

    if (interviewMode === "resume" && resumeText) {
      // RESUME MODE: Prefer projects aligned with selected tech stack.
      const fullResumeText = normalizeResumeText(resumeText);
      const allProjects = extractProjectsWithTech(fullResumeText);
      const requestedTech = techstack
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const matchedProjects = filterProjectsByTech(allProjects, requestedTech);
      const projectsForPrompt = matchedProjects;

      console.log("========== RESUME MODE ==========");
      console.log(`[RESUME] Full Resume Text Size: ${fullResumeText.length} chars`);
      console.log(`[RESUME] All Projects Extracted: ${allProjects.length}`);
      console.log(`[RESUME] Requested Tech: ${requestedTech.join(", ") || "none"}`);
      console.log(`[RESUME] Matched Projects: ${matchedProjects.length}`);
      console.log(`[RESUME] Projects Used For Prompt: ${projectsForPrompt.length}`);
      allProjects.forEach((p, idx) => {
        console.log(`[RESUME]   [${idx + 1}] ${p.name} (${p.tech.join(", ")})`);
      });
      console.log("==================================\n");

      if (projectsForPrompt.length === 0) {
        return Response.json(
          {
            success: false,
            error:
              "Could not extract project details from the uploaded resume. Please upload a resume with a clear PROJECTS section.",
          },
          { status: 400 }
        );
      }

      const projectContextHeader =
        matchedProjects.length > 0
          ? `PROJECT CONTEXT (matching selected tech stack: ${requestedTech.join(", ")}):`
          : "PROJECT CONTEXT (fallback to top 2 extracted projects):";

      const distribution = distributeEvenly(amount, projectsForPrompt.length);
      const distributionPlan = projectsForPrompt
        .map((p, idx) => `- ${p.name}: ${distribution[idx]} question(s)`)
        .join("\n");

      // Build the projects display from selected context.
      const projectsDisplay = projectsForPrompt
        .map(p => `Project: ${p.name}
Technologies: ${p.tech.join(", ")}
Description: ${p.fullText}`)
        .join("\n\n");

      prompt = `You are a senior interviewer creating resume-grounded interview questions.

${projectContextHeader}
${projectsDisplay}

INTERVIEW CONTEXT:
- Role: ${role}
- Experience Level: ${level}
- Tech Stack Focus: ${techstack}
- Interview Type: ${type}

QUESTION DISTRIBUTION PLAN (mandatory):
${distributionPlan}

CRITICAL RULES:

1. Use ONLY facts from the provided project context.
   - Do NOT invent projects, features, or tools.
   - Keep each question clearly tied to the candidate's real work.

2. Prefer questions about implementation choices and practical trade-offs.
   - Ask about architecture decisions, retrieval quality, indexing strategy, embedding choices, evaluation, and debugging.
   - Include at least one specific technology or concept from context (e.g., FAISS, RAG, embeddings, reranking, query expansion, caching).

3. DO NOT force every question into outage/concurrency/failure phrasing.
   - Failures and scaling can appear, but only when naturally relevant.
   - Keep a balanced set of practical interview questions.

4. Avoid generic prompts:
   - "Tell me about your project"
   - "What technologies did you use"
   - "Explain your resume"

5. Question style:
   - Technical mode: concrete, implementation-focused, scenario-backed.
   - Behavioral mode: specific incident/decision from real project execution.
   - Mixed mode: combine both.

6. ALWAYS naturally reference the project name inside the question itself.
   - Example: "In your Agri360 RAG Bot, what happens when FAISS index grows beyond memory limits?"
   - Do NOT write generic questions - always tie to a specific project from context.

7. Generate EXACTLY ${amount} questions.
8. Return ONLY a JSON array of strings.
9. Follow the exact distribution plan above.
10. Return questions in grouped order by project as listed in the plan.
11. No markdown or explanations.`;
    } 
    
    else {
      // STANDARD MODE: Generic role/tech-based questions, NO resume context
      prompt = `You are a senior engineer diagnosing REAL production issues for a ${role} position.
Your goal is to ask questions that reveal how candidates understand SYSTEM BEHAVIOR under failure and edge cases.
This is NOT an interview - it's a technical investigation.

Position Context:
- Role: ${role}
- Experience Level: ${level}
- Tech Stack: ${techstack}
- Interview Type: ${type === "behavioral" || type === "behavioural" ? "Behavioral/Soft Skills" : type === "technical" ? "Technical (Production Diagnostics)" : "Balanced"}

${type === "technical" ? `
⚠️ CRITICAL RULES - NO EXCEPTIONS:

ABSOLUTELY FORBIDDEN PHRASES:
❌ "How would you..."
❌ "Walk me through..."
❌ "Explain..."
❌ "Describe..."
❌ "Tell me about..."
❌ "What would you do..."
❌ "How do you approach..."

ONLY ALLOWED QUESTION STARTERS:
✓ "What happens when..."
✓ "What occurs if..."
✓ "How does your system behave when..."
✓ "What's the runtime impact when..."
✓ "Which race condition occurs when..."
✓ "What state inconsistency appears when..."

QUESTION STRUCTURE (MANDATORY):
Format: "[Concrete System Condition] + [Error/Edge Case/Load] + [Technology-Specific Impact]"

Example Structure:
"What happens when [specific failure scenario] in your [technology] implementation, and [concurrent/cascading effect] occurs?"

CONCRETE FAILURE SCENARIOS (must pick ONE per question):
For Frontend (React/Vue/Angular):
- State store gets out of sync vs UI rendering
- Event handlers fire during unmount
- Memory leak in subscription or timer
- Race condition with async state updates
- Event loop blocked by heavy rendering

For Backend (Node.js/Express):
- Event loop blocked by sync operation during high traffic
- Uncaught async rejection crashes worker
- Partial write before connection drops
- Database connection pool exhausted
- Race condition in concurrent requests modifying same resource

For Database/API:
- N+1 query under load
- Connection timeout mid-transaction
- Partial data committed on network failure
- Third-party API rate limit or timeout
- Cache invalidation race condition

For System-Level:
- Memory growth unbounded
- File descriptor exhaustion
- CPU throttling under sustained load
- DNS resolution timeout cascades
- Deployment rolling update mid-request

DEPTH REQUIREMENT (MUST INCLUDE):
Each question MUST require understanding of:
${level === "junior" ? `
- What the system DOES (behavior, not theory)
- Why it fails in this scenario
- What observable symptoms appear
- Simple root cause thinking
` : level === "mid-level" ? `
- System behavior under stress
- Performance and timing implications
- Trade-offs in failure handling
- How to collect debugging data
- Optimization opportunities
` : `
- Complex system interactions
- Subtle timing and ordering issues
- Performance profile across components
- Advanced debugging and monitoring
- Production incident patterns
`}

TECH-SPECIFIC EXAMPLES:
${techstack.toLowerCase().includes("react") || techstack.toLowerCase().includes("vue") || techstack.toLowerCase().includes("angular") ? `
React/Vue/Angular Frontend Questions MUST be like:
- "What happens when setState is called during unmount in React?"
- "What state inconsistency occurs when async data arrives after component unmounts?"
- "What's the race condition when two Redux dispatches happen simultaneously?"
- NOT: "Explain React hooks" or "How would you manage state"
` : ""}
${techstack.toLowerCase().includes("node") || techstack.toLowerCase().includes("express") || techstack.toLowerCase().includes("nest") ? `
Node.js/Express Backend Questions MUST be like:
- "What happens when a synchronous operation blocks the event loop during high traffic?"
- "What occurs if a promise rejection happens in an unhandled route?"
- "How does your system behave when database connection pool is exhausted?"
- NOT: "How would you structure a REST API" or "Explain middleware"
` : ""}
${techstack.toLowerCase().includes("python") || techstack.toLowerCase().includes("django") || techstack.toLowerCase().includes("flask") ? `
Python Backend Questions MUST be like:
- "What happens when GIL contention occurs under heavy concurrency?"
- "What occurs if async/await is mixed with blocking I/O?"
- "How does the system behave when database ORM query multiplies under N+1 pattern?"
- NOT: "Explain decorators" or "How would you design this endpoint"
` : ""}

CONCRETE EXAMPLES (Reference - do NOT copy):

BAD (Textbook):
"How would you handle API failures?"
"Explain error handling in your backend"
"Describe your testing strategy"

GOOD (Production Diagnostics):
"What happens in your Redux store when an API call fails after partial data is already committed?"
"What occurs when an Express route throws an error after headers are partially sent?"
"What state inconsistency appears when two identical API requests arrive within 50ms?"

CONSTRAINTS:
- Generate EXACTLY ${amount} questions (not more, not less)
- Return ONLY JSON array
- NO markdown, backticks, or special characters
- Each question is 1-2 sentences max (concise, direct)
- NO "and how would you fix it" - focus purely on behavior/diagnosis

QUALITY GATE:
Before generating each question, ask:
1. Does it use ONLY allowed starters? (What happens / What occurs / How does)
2. Does it name a CONCRETE failure scenario?
3. Does it include SPECIFIC technology from ${techstack}?
4. Would a junior ask this in an interview, or a senior during post-mortem?
5. If answer is "could be an interview question", DELETE IT AND CHANGE IT.

Generate EXACTLY ${amount} production diagnostic questions for ${techstack}.
Return ONLY JSON array format:
["Question 1", "Question 2", ..., "Question ${amount}"]
` : type === "behavioral" || type === "behavioural" ? `
CRITICAL RULES FOR BEHAVIORAL QUESTIONS:

FORBIDDEN PHRASES:
❌ "Tell me about a time when..."
❌ "What are your strengths..."
❌ "Describe your last project"
❌ "How do you approach..."
❌ "How would you handle..."

REQUIRED PHRASE STRUCTURES:
✓ "What happened when..."
✓ "Walk me through a specific incident when..."
✓ "Describe exactly what you did when..."
✓ "What was your decision when..."

FOCUS: REAL DECISIONS UNDER PRESSURE
- Specific incident, not general approach
- Decision made (not how you would make it)
- Outcome and what you learned
- Trade-offs you accepted
- Team dynamics you navigated

EXAMPLES:

BAD: "Tell me about a challenging project"
GOOD: "Walk me through a specific time when a critical deadline shifted mid-sprint. What was your communication to the team?"

BAD: "How do you handle conflicts?"
GOOD: "Describe a time when you disagreed with an architect's design decision. What did you do?"

CONSTRAINTS:
- Generate EXACTLY ${amount} questions
- Return ONLY JSON array
- NO generic "tell me about" questions
- Each question is specific incident, not general pattern

Return ONLY JSON:
["Question 1", "Question 2", ..., "Question ${amount}"]
` : `
BALANCED MODE: Technical 50% + Behavioral 50%

Technical Questions:
- Use ONLY "What happens when", "What occurs if"
- Focus on system behavior and concrete failures
- Tech stack specific

Behavioral Questions:
- Use "What happened when" (past tense, specific)
- Focus on real decisions under pressure
- No generic patterns

Return ONLY JSON array:
["Question 1", "Question 2", ..., "Question ${amount}"]
`}`;
    }

    const { text: responseText } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: prompt,
      maxOutputTokens: 2048,
    });

    // DEBUG: Log final prompt sent to LLM
    console.log("\n========== FINAL PROMPT SENT TO LLM ==========");
    console.log(`[PROMPT] Mode: ${interviewMode}`);
    console.log(`[PROMPT] Interview Type: ${type}`);
    console.log(`[PROMPT] Questions Requested: ${amount}`);
    console.log(`[PROMPT] Prompt Size: ${prompt.length} chars`);
    console.log(`[PROMPT] First 200 chars of prompt:`);
    console.log(`[PROMPT] "${prompt.substring(0, 200).replace(/\n/g, " ")}..."`);
    console.log("============================================\n");

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to extract questions from response");
    }

    const questions: string[] = JSON.parse(jsonMatch[0]);

    if (questions.length !== amount) {
      console.warn(
        `Expected ${amount} questions but got ${questions.length}, using what was returned`
      );
    }
    
    // QUALITY VALIDATION: Check question format and depth (applies to all modes)
    const technicalPhrases = ["what happens", "what occurs", "how does", "when", "impact", "handle", "behavior", "cause", "result"];
    const qualityErrors: string[] = [];

    questions.forEach((question, idx) => {
      const questionNum = idx + 1;
      const q = question.toLowerCase();

      // Check 1: Minimum length
      if (question.trim().length < 20) {
        qualityErrors.push(`Question ${questionNum} is too short (min 20 chars)`);
      }

      // Check 2: Contains technical language
      const hasTechnicalPhrase = technicalPhrases.some(phrase => q.includes(phrase));
      if (!hasTechnicalPhrase) {
        qualityErrors.push(`Question ${questionNum} lacks technical depth (no phrases like "what happens", "impact", etc.)`);
      }
    });

    if (qualityErrors.length > 0) {
      console.warn("\n========== QUALITY CHECK WARNINGS ==========");
      qualityErrors.forEach(err => console.warn(`[QUALITY] ${err}`));
      console.warn("==============================================\n");
      // Continue anyway - these are warnings, not blockers
    }

    // DEBUG: Log generated questions
    console.log("\n========== QUESTIONS GENERATED ==========");
    console.log(`[GENERATED] Mode: ${interviewMode}`);
    console.log(`[GENERATED] Questions Count: ${questions.length}/${amount}`);
    questions.forEach((q, idx) => {
      console.log(`[GENERATED]   [${idx + 1}] ${q.substring(0, 100)}${q.length > 100 ? "..." : ""}`);
    });
    console.log("=========================================\n");

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(",").map((t: string) => t.trim()),
      questions: questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      interviewMode: interviewMode,
      companyType,
      jobDescription,
    };

    const newInterview = await db.collection("interviews").add(interview);

    return Response.json(
      { success: true, interviewId: newInterview.id },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating interview:", errorMessage, error);

    return Response.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : null,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
