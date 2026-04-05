// API route used by the interview-generation form.
// Standard mode: Groq generates questions from role / level / tech stack.
// Resume mode: PDF → extract text → Groq generates questions with full resume context.

import { generateText } from "ai";
import { groq } from "@/lib/groq";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { normalizeResumeText, extractProjectsWithTech, filterProjectsByTech } from "@/lib/rag/resume-rag";
import { extractTextFromPdfBuffer } from "@/lib/rag/extract-pdf-text";
import { MAX_RESUME_CHARS, MAX_PDF_BYTES } from "@/lib/rag/constants";

type InterviewMode = "standard" | "resume";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  let type: string;
  let role: string;
  let level: string;
  let techstack: string;
  let amount: number;
  let userid: string;
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
      const amountRaw = formData.get("amount");
      amount =
        typeof amountRaw === "string"
          ? Number(amountRaw)
          : Number(amountRaw ?? NaN);

      // ENHANCEMENT: Allow standard mode to accept optional resume for context-aware questions
      // Applies to both resume mode (required) and standard mode (optional for project context)
      const resumePdfFile = formData.get("resumePdf");
      
      if (resumePdfFile instanceof File) {
        // Resume file provided (either resume mode or standard mode with optional resume)
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

        const buf = Buffer.from(await resumePdfFile.arrayBuffer());
        const extracted = await extractTextFromPdfBuffer(buf);
        resumeText = normalizeResumeText(extracted);

        if (!resumeText.length) {
          const message =
            interviewMode === "resume"
              ? "No text could be read from this PDF. Use a text-based PDF (not a scanned image) or export again from your editor."
              : "Resume provided but no text could be extracted. Proceeding with standard mode.";
          
          if (interviewMode === "resume") {
            return Response.json(
              {
                success: false,
                error: message,
              },
              { status: 400 }
            );
          }
          // For standard mode, resumeText stays null and we proceed without context
        }
        if (resumeText && resumeText.length > MAX_RESUME_CHARS) {
          return Response.json(
            {
              success: false,
              error: `Extracted resume is too long (max ${MAX_RESUME_CHARS} characters).`,
            },
            { status: 400 }
          );
        }
      } else if (interviewMode === "resume") {
        // Resume mode requires a PDF file
        return Response.json(
          {
            success: false,
            error: "Upload a PDF resume for resume-based interviews.",
          },
          { status: 400 }
        );
      }
    } else {
      const body = (await request.json()) as {
        type?: string;
        role?: string;
        level?: string;
        techstack?: string;
        amount?: number;
        userid?: string;
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

      type = (body.type ?? "").trim();
      role = (body.role ?? "").trim();
      level = (body.level ?? "").trim();
      techstack = (body.techstack ?? "").trim();
      userid = (body.userid ?? "").trim();
      amount = Number(body.amount);
    }

    if (
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
      // Normalize resume text
      const fullResumeText = normalizeResumeText(resumeText);
      
      // Extract and filter projects by user's tech stack
      const allProjects = extractProjectsWithTech(fullResumeText);
      const userTechArray = techstack.split(",").map(t => t.trim()).filter(t => t.length > 0);
      const filteredProjects = filterProjectsByTech(allProjects, userTechArray);
      
      console.log("\n========== RESUME MODE ==========");
      console.log(`[RESUME] Full Resume Text Size: ${fullResumeText.length} chars`);
      console.log(`[RESUME] All Projects Extracted: ${allProjects.length}`);
      console.log(`[RESUME] Filtered Projects: ${filteredProjects.length}`);
      console.log(`[RESUME] User Tech Stack: ${userTechArray.join(", ")}`);
      filteredProjects.forEach((p, idx) => {
        console.log(`[RESUME]   [${idx + 1}] ${p.name} (${p.tech.join(", ")})`);
      });
      console.log("==================================\n");

      // Build the filtered projects display
      const projectsDisplay = filteredProjects
        .map(p => `Project: ${p.name}
Technologies: ${p.tech.join(", ")}
Description: ${p.fullText}`)
        .join("\n\n");

      prompt = `You are a senior engineer performing a production-level code review of a candidate's REAL projects.

USER TECH STACK:
${userTechArray.join(", ")}

RELEVANT PROJECTS FROM RESUME:
${projectsDisplay}

CRITICAL RULES (STRICT - MUST FOLLOW):

1. You MUST ONLY use the project names listed above.
   - DO NOT invent any project
   - DO NOT rename or generalize project names

2. EVERY question MUST:
   - Include EXACT project name
   - Include at least ONE relevant technology (from tech stack or project)
   - Include a REAL technical scenario (failure, edge case, scale issue, or internal behavior)

3. ABSOLUTELY DO NOT ask generic questions like:
   - "Explain your project"
   - "How did you build"
   - "What technologies did you use"

4. EVERY question MUST feel like:
   - debugging a production issue
   - reviewing real implementation
   - analyzing system behavior under stress

5. FORCE DEEP TECHNICAL THINKING:
Each question MUST include at least one of:
   - memory usage behavior
   - event loop or async flow
   - API request/response lifecycle
   - database query behavior
   - concurrency or race conditions
   - model behavior (for ML projects)
   - failure handling (timeouts, retries, crashes)
   - performance bottlenecks

6. Questions MUST follow patterns like:
   - "In your [project], what happens when [failure scenario] occurs in [technology]?"
   - "How does your [project] handle [edge case] when [system constraint] is reached?"
   - "In [project], how is [internal mechanism] affected when [scale/load increases]?"

7. PRIORITIZE USER TECH STACK:
   - Prefer questions involving: ${userTechArray.join(", ")}
   - Combine project + tech stack + system behavior in ONE question

8. QUESTIONS MUST BE SPECIFIC:
   - Mention concrete scenarios (e.g., large cart size, high traffic, missing data, API failure)
   - Avoid vague wording

9. Generate EXACTLY ${amount} questions.
10. Return ONLY a JSON array of strings.
11. No markdown, no explanations, no special characters like backticks or slashes.

FINAL INSTRUCTION:
If a question is generic or does not involve a real system behavior, DISCARD it and generate a better one.`;
    } else {
      // STANDARD MODE: Check for optional project context
      let standardModeProjectContext = "";
      let hasStandardModeProjectContext = false;

      if (resumeText) {
        // Resume was provided (optional) in standard mode - check for project context
        const allProjects = extractProjectsWithTech(resumeText);
        const userTechArray = techstack
          .split(",")
          .map(t => t.trim())
          .filter(t => t.length > 0);

        // Check if any project tech matches user's tech stack
        const hasMatch = allProjects.some(p =>
          p.tech.some(t =>
            userTechArray.some(u =>
              t.toLowerCase().includes(u.toLowerCase())
            )
          )
        );

        if (hasMatch && allProjects.length > 0) {
          hasStandardModeProjectContext = true;
          standardModeProjectContext = allProjects
            .map(
              p => `Project: ${p.name}
Technologies: ${p.tech.join(", ")}`
            )
            .join("\n\n");

          console.log("\n========== STANDARD MODE WITH PROJECT CONTEXT ==========");
          console.log(`[STANDARD] Found ${allProjects.length} projects`);
          console.log(
            `[STANDARD] Tech match detected: ${userTechArray.join(", ")}`
          );
          console.log(
            `[STANDARD] Using ${allProjects.length} projects in prompt`
          );
          console.log("=======================================================\n");
        }
      }

      // Build appropriate prompt based on whether project context exists
      if (hasStandardModeProjectContext) {
        // Enhanced standard mode with project context
        prompt = `You are a senior engineer diagnosing REAL production issues for a ${role} position.
Your goal is to ask questions that reveal how candidates understand SYSTEM BEHAVIOR under failure and edge cases.
This is NOT an interview - it's a technical investigation.

Position Context:
- Role: ${role}
- Experience Level: ${level}
- Tech Stack: ${techstack}
- Interview Type: Technical (Production Diagnostics with Project Context)

CANDIDATE PROJECTS (From Resume):
${standardModeProjectContext}

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

MANDATORY REQUIREMENTS:

1. At least 1-2 questions MUST reference a project name from the list above.
   - Use EXACT project names only
   - NEVER invent or rename projects
   - Questions linking projects should combine: project + tech + system behavior

2. Remaining questions can focus on tech stack or system-level scenarios.

3. Each question MUST use ONLY allowed starters (What happens when, What occurs if, etc.).

4. Tech-specific scenarios:
${level === "junior" ? `
   - Scenarios understandable but revealing gaps
   - Include real implementation challenges
   - Avoid overly complex distributed systems
` : level === "mid-level" ? `
   - Assume knowledge of basic patterns
   - Focus on real-world scenarios and trade-offs
   - Ask about optimization and system design
` : `
   - Assume deep knowledge
   - Ask about complex edge cases
   - Focus on system-level design and production issues
`}

5. Questions must cover:
   - Event loop blocking or async race conditions
   - Memory leaks or unbounded growth
   - Database query patterns (N+1, connection exhaustion)
   - API failure or partial data scenarios
   - Concurrency or race conditions
   - Performance bottlenecks under load

6. Generate EXACTLY ${amount} questions.
7. Return ONLY a JSON array of strings.
8. No markdown, backticks, or slashes.

Quality Gate:
- If a question doesn't reference a project, ask about tech stack or system behavior.
- If too many questions reference projects with similar failure modes, diversify.
- Every question must sound like a post-mortem, not a textbook interview.

Return ONLY JSON array:
["Question 1", "Question 2", ..., "Question ${amount}"]`;
      } else {
        // Standard mode without project context (normal flow)
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
      }  // close nested else for project context
      }  // close nested if for project context
    }  // close main else for standard mode

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
    
    // VALIDATION: For resume mode, validate questions reference only filtered projects
    if (interviewMode === "resume") {
      const allProjects = extractProjectsWithTech(resumeText!);
      const userTechArray = techstack.split(",").map(t => t.trim()).filter(t => t.length > 0);
      const filteredProjects = filterProjectsByTech(allProjects, userTechArray);
      
      // Extract project names from filtered projects
      const validProjectNames = filteredProjects.map(p => p.name);
      
      // Extract ALL project names from the full resume (for checking invalid ones)
      const allProjectNames = allProjects.map(p => p.name);
      
      // Validate each question
      const validationErrors: string[] = [];
      
      questions.forEach((question, idx) => {
        const questionNum = idx + 1;
        
        // Check 1: Question must include at least one valid project name
        const hasValidProject = validProjectNames.some(projectName => 
          question.includes(projectName)
        );
        
        if (!hasValidProject) {
          validationErrors.push(`Question ${questionNum} does not reference any filtered project`);
        }
        
        // Check 2: Question must not include invalid project names (from resume but not filtered)
        const invalidProjectsInQuestion = allProjectNames.filter(projectName =>
          !validProjectNames.includes(projectName) && question.includes(projectName)
        );
        
        if (invalidProjectsInQuestion.length > 0) {
          validationErrors.push(`Question ${questionNum} references invalid projects: ${invalidProjectsInQuestion.join(", ")}`);
        }
      });
      
      if (validationErrors.length > 0) {
        console.error("\n========== QUESTION VALIDATION FAILED ==========");
        validationErrors.forEach(err => console.error(`[VALIDATION ERROR] ${err}`));
        console.error("==============================================\n");
        throw new Error(`Generated questions failed validation:\n${validationErrors.join("\n")}`);
      }
      
      console.log("\n========== QUESTION VALIDATION PASSED ==========");
      console.log(`[VALIDATION] All ${questions.length} questions include filtered project names`);
      console.log(`[VALIDATION] No invalid project names detected`);
      console.log("==============================================\n");
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
