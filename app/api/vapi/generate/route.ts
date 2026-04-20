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
import { getStandardQuestions } from "@/lib/rag/getStandardQuestions";

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
  let language: "en" | "hi" = "en";
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
      language = (String(formData.get("language") ?? "en") as "en" | "hi");
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
        jobDescription?: string;
        mode?: InterviewMode;
        language?: string;
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
      language = (body.language ?? "en") as "en" | "hi";
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

      // Choose prompt based on language
      if (language === "hi") {
        prompt = `आप एक वरिष्ठ तकनीकी इंटरव्यूअर हैं। आप उम्मीदवार के रिज्यूमे के आधार पर प्रश्न बना रहे हैं।

STRICT LANGUAGE RULES — इन्हें हमेशा follow करो:

1. हर प्रश्न Hindi (Devanagari) में शुरू होना चाहिए
2. कभी भी English word से sentence शुरू मत करो
3. ये English words allowed हैं (technical terms): ${techstack}, API, error, server, client, component, state, props, deploy, build, test, async, await, function, class, object, array, database, query, request, response, middleware, cache, memory, thread, process, buffer, stream, FAISS, RAG, embeddings, reranking, query expansion, caching, indexing, retrieval, debugging, evaluation
4. बाकी सब Hindi में लिखो

❌ गलत उदाहरण:
- "What happens when FAISS में index grows?"
- "How does React component re-render होता है?"
- "Explain करें कि API call कैसे होती है?"

✅ सही उदाहरण:
- "जब FAISS index memory limit से बढ़ जाता है, तो क्या होता है?"
- "React component दोबारा render क्यों होता है और इसे कैसे रोका जा सकता है?"
- "API call fail होने पर आप error को कैसे handle करते हैं?"

प्रश्न हमेशा इन patterns से शुरू करो:
- "जब ... होता है, तो..."
- "आपने ... project में कैसे..."
- "यदि ... हो जाए, तो क्या होगा?"
- "... में क्या अंतर है?"
- "आप ... को कैसे optimize करेंगे?"

${projectContextHeader}
${projectsDisplay}

INTERVIEW CONTEXT:
- Role: ${role}
- Experience Level: ${level}
- Tech Stack Focus: ${techstack} (MANDATORY - ONLY ask about these technologies)
- Interview Type: ${type}

QUESTION DISTRIBUTION PLAN (mandatory):
${distributionPlan}

CRITICAL RULES - STRICTLY FOLLOW:

1. TECH STACK RESTRICTION - MOST IMPORTANT:
   - ONLY ask questions about technologies mentioned in "Tech Stack Focus": ${techstack}
   - If a project uses React, Node.js, MongoDB but user only mentioned "Node.js", ONLY ask about Node.js aspects of that project
   - NEVER ask about technologies not in the user's specified tech stack
   - Each question MUST reference at least one technology from: ${techstack}

2. PROJECT-SPECIFIC QUESTIONS ONLY:
   - Use ONLY facts from the provided project context above
   - Do NOT invent projects, features, or tools
   - Keep each question clearly tied to the candidate's real work in these specific projects

3. QUESTION FOCUS PRIORITY:
   - 80% questions about implementation details in the matched projects
   - 20% questions about general concepts related to the specified tech stack
   - NEVER deviate to technologies not mentioned by user

4. AVOID GENERIC QUESTIONS:
   - "अपने project के बारे में बताएं" ❌
   - "आपने कौन सी technologies use कीं" ❌
   - "अपने resume को explain करें" ❌
   - "React के बारे में बताएं" (if React not in user's tech stack) ❌

5. SPECIFIC QUESTION STYLE:
   - Technical mode: concrete, implementation-focused, scenario-backed
   - Example: "आपके Node.js project में API error handling कैसे implement किया?"
   - Example: "MongoDB database में query optimization कैसे की?"
   - Behavioral mode: specific incident/decision from real project execution

6. PROJECT NAME REFERENCE - MANDATORY:
   - ALWAYS naturally reference the project name inside the question itself
   - Example: "आपके Agri360 RAG Bot में जब FAISS index memory limit से बढ़ जाता है, तो क्या होता है?"
   - Do NOT write generic questions - always tie to a specific project from context

7. TECH STACK VALIDATION:
   - Before finalizing each question, verify it mentions technology from: ${techstack}
   - If question doesn't match tech stack, rewrite it to match

8. Generate EXACTLY ${amount} questions in Hindi.
9. Return ONLY a JSON array of strings.
10. Follow the exact distribution plan above.
11. Return questions in grouped order by project as listed in the plan.
12. No markdown or explanations.`;
      } else {
        // English resume prompt (existing)
        prompt = `You are a senior interviewer creating resume-grounded interview questions.

${projectContextHeader}
${projectsDisplay}

INTERVIEW CONTEXT:
- Role: ${role}
- Experience Level: ${level}
- Tech Stack Focus: ${techstack} (MANDATORY - ONLY ask about these technologies)
- Interview Type: ${type}

QUESTION DISTRIBUTION PLAN (mandatory):
${distributionPlan}

CRITICAL RULES - STRICTLY FOLLOW:

1. TECH STACK RESTRICTION - MOST IMPORTANT:
   - ONLY ask questions about technologies mentioned in "Tech Stack Focus": ${techstack}
   - If a project uses React, Node.js, MongoDB but user only mentioned "Node.js", ONLY ask about Node.js aspects of that project
   - NEVER ask about technologies not in the user's specified tech stack
   - Each question MUST reference at least one technology from: ${techstack}

2. PROJECT-SPECIFIC QUESTIONS ONLY:
   - Use ONLY facts from the provided project context above
   - Do NOT invent projects, features, or tools
   - Keep each question clearly tied to the candidate's real work in these specific projects

3. QUESTION FOCUS PRIORITY:
   - 80% questions about implementation details in the matched projects
   - 20% questions about general concepts related to the specified tech stack
   - NEVER deviate to technologies not mentioned by user

4. AVOID GENERIC QUESTIONS:
   - "Tell me about your project" ❌
   - "What technologies did you use" ❌
   - "Explain your resume" ❌
   - "Tell me about React" (if React not in user's tech stack) ❌

5. SPECIFIC QUESTION STYLE:
   - Technical mode: concrete, implementation-focused, scenario-backed
   - Example: "In your Node.js project, how did you implement API error handling?"
   - Example: "How did you optimize MongoDB database queries?"
   - Behavioral mode: specific incident/decision from real project execution

6. PROJECT NAME REFERENCE - MANDATORY:
   - ALWAYS naturally reference the project name inside the question itself
   - Example: "In your Agri360 RAG Bot, what happens when FAISS index grows beyond memory limits?"
   - Do NOT write generic questions - always tie to a specific project from context

7. TECH STACK VALIDATION:
   - Before finalizing each question, verify it mentions technology from: ${techstack}
   - If question doesn't match tech stack, rewrite it to match

8. Generate EXACTLY ${amount} questions.
9. Return ONLY a JSON array of strings.
10. Follow the exact distribution plan above.
11. Return questions in grouped order by project as listed in the plan.
12. No markdown or explanations.`;
      }
    } 
    
    else {
      // STANDARD MODE: Generic role/tech-based questions, NO resume context
      
      // ===== RAG APPROACH FOR TECHNICAL INTERVIEWS =====
      if (type === "technical" && language !== "hi") {
        console.log("\n========== STANDARD MODE + TECHNICAL TYPE ==========");
        console.log(`[TECH] Using RAG system for consistent, cost-effective questions`);
        console.log(`[TECH] Tech Stack: ${techstack}`);
        console.log(`[TECH] Level: ${level}`);
        console.log(`[TECH] Questions: ${amount}`);
        console.log("====================================================\n");

        try {
          const ragResult = await getStandardQuestions({
            techStack: techstack,
            level: level,
            amount: amount,
            role: role,
            type: type,
            language: language,
            interviewMode: interviewMode,
          });

          if (ragResult.questions.length === 0) {
            throw new Error("RAG system returned no questions");
          }

          console.log(`✅ RAG Generation Complete:`);
          console.log(`   - Total Questions: ${ragResult.questions.length}`);
          console.log(`   - From RAG Bank: ${ragResult.totalFromRAG}`);
          console.log(`   - From LLM Fallback: ${ragResult.totalFromLLM}`);
          console.log(`   - Sources: ${ragResult.sources.map(s => `${s.tech}(${s.method}:${s.count})`).join(", ")}`);

          const questions = ragResult.questions;

          // Store interview in Firestore
          const interviewRef = db.collection("interviews").doc();
          await interviewRef.set({
            userId: userid,
            role: role,
            techstack: techstack,
            level: level,
            type: type,
            amount: amount,
            interviewMode: interviewMode,
            questions: questions,
            jobDescription: jobDescription,
            createdAt: new Date().toISOString(),
            cover: getRandomInterviewCover(),
          });

          return Response.json({
            success: true,
            interviewId: interviewRef.id,
            questions: questions,
            source: "rag-standard-questions",
            ragStats: {
              totalFromRAG: ragResult.totalFromRAG,
              totalFromLLM: ragResult.totalFromLLM,
              sources: ragResult.sources,
            },
          });
        } catch (ragError) {
          console.error("❌ RAG system failed, falling back to LLM:", ragError);
          // Fall through to LLM approach below
        }
      }

      // ===== RAG APPROACH FOR HINDI TECHNICAL INTERVIEWS =====
      if (type === "technical" && language === "hi") {
        console.log("\n========== STANDARD MODE + HINDI TECHNICAL TYPE ==========");
        console.log(`[TECH] Using RAG system for Hindi technical questions`);
        console.log(`[TECH] Tech Stack: ${techstack}`);
        console.log(`[TECH] Level: ${level}`);
        console.log(`[TECH] Questions: ${amount}`);
        console.log("====================================================\n");

        try {
          const ragResult = await getStandardQuestions({
            techStack: techstack,
            level: level,
            amount: amount,
            role: role,
            type: type,
            language: language,
            interviewMode: interviewMode,
          });

          if (ragResult.questions.length === 0) {
            throw new Error("RAG system returned no questions");
          }

          console.log(`✅ Hindi RAG Generation Complete:`);
          console.log(`   - Total Questions: ${ragResult.questions.length}`);
          console.log(`   - From RAG Bank: ${ragResult.totalFromRAG}`);
          console.log(`   - From LLM Fallback: ${ragResult.totalFromLLM}`);
          console.log(`   - Sources: ${ragResult.sources.map(s => `${s.tech}(${s.method}:${s.count})`).join(", ")}`);

          const questions = ragResult.questions;

          // Store interview in Firestore
          const interviewRef = db.collection("interviews").doc();
          await interviewRef.set({
            userId: userid,
            role: role,
            techstack: techstack,
            level: level,
            type: type,
            amount: amount,
            interviewMode: interviewMode,
            questions: questions,
            jobDescription: jobDescription,
            createdAt: new Date().toISOString(),
            cover: getRandomInterviewCover(),
          });

          return Response.json({
            success: true,
            interviewId: interviewRef.id,
            questions: questions,
            source: "rag-hindi-standard-questions",
            ragStats: {
              totalFromRAG: ragResult.totalFromRAG,
              totalFromLLM: ragResult.totalFromLLM,
              sources: ragResult.sources,
            },
          });
        } catch (ragError) {
          console.error("❌ Hindi RAG system failed, falling back to LLM:", ragError);
          // Fall through to LLM approach below
        }
      }

      // ===== LLM APPROACH =====
     if (language === "hi") {
  prompt = `
आप एक वरिष्ठ तकनीकी इंटरव्यूअर हैं।

STRICT LANGUAGE RULES — इन्हें हमेशा follow करो:

1. हर प्रश्न Hindi (Devanagari) में शुरू होना चाहिए
2. कभी भी English word से sentence शुरू मत करो
3. ये English words allowed हैं (technical terms): ${techstack}, API, error, server, client, component, state, props, deploy, build, test, async, await, function, class, object, array, database, query, request, response, middleware, cache, memory, thread, process, buffer, stream
4. बाकी सब Hindi में लिखो

❌ गलत उदाहरण:
- "What happens when Node.js में memory leak होती है?"
- "How does React component re-render होता है?"
- "Explain करें कि API call कैसे होती है?"

✅ सही उदाहरण:
- "जब Node.js application में memory leak होती है, तो system का क्या होता है?"
- "React component दोबारा render क्यों होता है और इसे कैसे रोका जा सकता है?"
- "API call fail होने पर आप error को कैसे handle करते हैं?"

प्रश्न हमेशा इन patterns से शुरू करो:
- "जब ... होता है, तो..."
- "आपने ... कैसे handle किया?"
- "यदि ... हो जाए, तो क्या होगा?"
- "... में क्या अंतर है?"
- "आप ... को कैसे optimize करेंगे?"

Role: ${role}
Level: ${level}
Tech Stack: ${techstack}
Interview Type: ${type}

CRITICAL: Generate EXACTLY ${amount} questions in Hindi.
Do NOT generate more or fewer than ${amount} questions.

Return ONLY JSON array with exactly ${amount} questions:
["प्रश्न 1", "प्रश्न 2", "प्रश्न 3"]`;

}
 else {
        prompt = `
You are a senior engineer diagnosing REAL production issues.

Role: ${role}
Level: ${level}
Tech Stack: ${techstack}

Rules:
- Focus on real-world failures
- Ask system behavior questions
- Avoid generic theory

CRITICAL: Generate EXACTLY ${amount} questions.
Do NOT generate more or fewer than ${amount} questions.

Return ONLY JSON array with exactly ${amount} questions:
["Question 1", "Question 2", "Question 3"]`;

      }
    }

    const { text: responseText } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: prompt,
      maxOutputTokens: 2048,
    });

    // DEBUG: Log final prompt sent to LLM
    console.log("\n========== FINAL PROMPT SENT TO LLM ==========");

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to extract questions from response");
    }

    const questions: string[] = JSON.parse(jsonMatch[0]);
    console.log(`[PROMPT] Prompt Size: ${prompt.length} chars`);
    console.log(`[PROMPT] First 200 chars of prompt:`);
    console.log(`[PROMPT] "${prompt.substring(0, 200).replace(/\n/g, " ")}..."`);
    console.log("============================================\n");

    if (questions.length !== amount) {
      console.warn(
        `Expected ${amount} questions but got ${questions.length}, using what was returned`
      );
    }
    
    // QUALITY VALIDATION: Check question format and depth (applies to all modes)
    const englishTechnicalPhrases = ["what happens", "what occurs", "how does", "when", "impact", "handle", "behavior", "cause", "result"];
    const hindiTechnicalPhrases = ["क्या होता", "कैसे", "कब", "प्रभाव", "handle", "व्यवहार", "कारण", "परिणाम", "जब"];
    const qualityErrors: string[] = [];

    questions.forEach((question, idx) => {
      const questionNum = idx + 1;
      const q = question.toLowerCase();

      // Check 1: Minimum length
      if (question.trim().length < 20) {
        qualityErrors.push(`Question ${questionNum} is too short (min 20 chars)`);
      }

      // Check 2: Contains technical language (different patterns for different languages)
      let hasTechnicalPhrase = false;
      if (language === "hi") {
        hasTechnicalPhrase = hindiTechnicalPhrases.some(phrase => q.includes(phrase));
      } else {
        hasTechnicalPhrase = englishTechnicalPhrases.some(phrase => q.includes(phrase));
      }

      if (!hasTechnicalPhrase) {
        qualityErrors.push(`Question ${questionNum} lacks technical depth (no technical phrases found)`);
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
      language: language,
      techstack: techstack.split(",").map((t: string) => t.trim()),
      questions: questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      interviewMode: interviewMode,
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
