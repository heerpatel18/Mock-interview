/**
 * GET STANDARD QUESTIONS - RAG-Based Question Selection
 * 
 * Retrieves questions from predefined knowledge base instead of generating via LLM
 * Supports fallback to LLM when tech not supported
 */

import {
  STANDARD_QUESTIONS,
  normalizeTech,
  normalizeLevelToQuestionBankKey,
} from "./rag_standard_questions";
import { generateText } from "ai";
import { groq } from "@/lib/groq";

// ============================================
// LOGGING HELPER FUNCTIONS
// ============================================

/**
 * Log RAG-selected questions for a specific tech
 */
function logRagSelected(
  tech: string,
  level: "junior" | "medium" | "senior",
  questions: string[]
): void {
  console.log("\n📦 RAG QUESTIONS SELECTED:");
  console.log({
    tech,
    level,
    count: questions.length,
    questions: questions.map((q, i) => `${i + 1}. ${q}`),
  });
  console.log("=================================");
}

/**
 * Log LLM fallback trigger
 */
function logLLMFallback(
  tech: string,
  reason: string,
  count: number
): void {
  console.log(`\n🤖 LLM FALLBACK TRIGGERED:`);
  console.log({
    tech,
    reason,
    questionsNeeded: count,
  });
  console.log("=================================");
}

/**
 * Log LLM-generated questions
 */
function logLLMGenerated(
  tech: string,
  questions: string[]
): void {
  console.log("\n🤖 LLM-GENERATED QUESTIONS:");
  console.log({
    tech,
    count: questions.length,
    questions: questions.map((q, i) => `${i + 1}. ${q}`),
  });
  console.log("=================================");
}

/**
 * Log final merged question set
 */
function logFinalQuestionSet(
  finalQuestions: string[],
  ragCount: number,
  llmCount: number
): void {
  console.log("\n✅ FINAL QUESTION SET (MERGED):");
  console.log({
    totalQuestions: finalQuestions.length,
    fromRAG: ragCount,
    fromLLM: llmCount,
    questions: finalQuestions.map((q, i) => `${i + 1}. ${q}`),
  });
  console.log("=================================\n");
}

/**
 * Log processing start for a tech
 */
function logProcessingStart(
  tech: string,
  needed: number,
  difficulty: string
): void {
  console.log(`\n🔍 Processing: ${tech.toUpperCase()}`);
  console.log(`   Difficulty: ${difficulty} | Questions needed: ${needed}`);
}

// ============================================
// END LOGGING HELPERS
// ============================================

export interface GetStandardQuestionsParams {
  techStack: string; // Comma-separated tech names: "React, Node.js"
  level: string; // "junior" | "mid-level" | "senior"
  amount: number; // Total questions needed
  role: string; // Role for context (e.g., "Frontend Developer")
  type: string; // "technical" or other
  language?: "en" | "hi"; // Interview language for prompt injection
  interviewMode?: "standard" | "resume"; // Interview mode (controls RAG usage)
}

export interface GetStandardQuestionsResult {
  questions: string[];
  sources: {
    tech: string;
    method: "rag" | "llm-fallback";
    count: number;
  }[];
  totalFromRAG: number;
  totalFromLLM: number;
}

/**
 * Distribute questions evenly across tech stack
 * @param techs Array of technologies
 * @param total Total questions needed
 * @returns Array of question counts for each tech
 */
export function distributeQuestions(techs: string[], total: number): number[] {
  if (techs.length === 0) return [];
  const base = Math.floor(total / techs.length);
  const remainder = total % techs.length;
  return techs.map((_, idx) => base + (idx < remainder ? 1 : 0));
}

/**
 * Randomly select items from array without duplicates
 * @param items Array to select from
 * @param count Number of items to select
 * @param askedSet Set of previously asked items (to avoid duplicates)
 * @returns Selected items
 */
export function selectRandomQuestions(
  items: string[],
  count: number,
  askedSet: Set<string> = new Set()
): string[] {
  const available = items.filter((q) => !askedSet.has(q));

  if (available.length === 0) {
    console.warn(
      `⚠️ All ${count} questions already used, cycling through remaining from full set`
    );
    return items.slice(0, count);
  }

  const selected: string[] = [];
  const temp = [...available];

  for (let i = 0; i < Math.min(count, temp.length); i++) {
    const idx = Math.floor(Math.random() * temp.length);
    selected.push(temp[idx]);
    temp.splice(idx, 1);
  }

  return selected;
}

/**
 * Get questions for a single tech from RAG bank
 * @param tech Tech name (will be normalized)
 * @param level junior | medium | senior (matches STANDARD_QUESTIONS keys)
 * @param count Questions needed
 * @param askedSet Previously asked questions (for deduplication)
 * @returns Questions or empty array if tech not supported
 */
export function getQuestionsFromRAG(
  tech: string,
  level: "junior" | "medium" | "senior",
  count: number,
  askedSet: Set<string> = new Set()
): string[] {
  const normalized = normalizeTech(tech);

  if (!normalized) {
    console.warn(`❌ Tech "${tech}" not found in RAG bank`);
    return [];
  }

  const questions =
    STANDARD_QUESTIONS[normalized as keyof typeof STANDARD_QUESTIONS];
  if (!questions) {
    console.warn(`❌ Tech "${normalized}" has no questions in RAG bank`);
    return [];
  }

  // DEBUG: Verify structure is correct
  console.log("DEBUG CHECK:", {
    tech: normalized,
    level,
    exists: !!STANDARD_QUESTIONS[normalized],
    levelExists: !!STANDARD_QUESTIONS[normalized]?.[level],
    availableLevels: STANDARD_QUESTIONS[normalized] ? Object.keys(STANDARD_QUESTIONS[normalized]) : [],
  });

  const levelQuestions = questions[level];
  if (!levelQuestions || levelQuestions.length === 0) {
    console.warn(
      `❌ Tech "${normalized}" has no ${level} questions in RAG bank`
    );
    return [];
  }

  const selected = selectRandomQuestions(
    levelQuestions as string[],
    count,
    askedSet
  );
  return selected;
}

/**
 * Fallback to LLM for unsupported techs
 * @param tech Tech name
 * @param level Interview level
 * @param count Questions needed
 * @param role Interview role
 * @param language Interview language (en | hi)
 * @returns Generated questions
 */
export async function fallbackToLLM(
  tech: string,
  level: string,
  count: number,
  role: string,
  language: "en" | "hi" = "en"
): Promise<string[]> {
  console.log(
    `⚠️ Falling back to LLM for unsupported tech: "${tech}" (${count} questions, language: ${language})`
  );

  const languageInstructions = language === "hi"
    ? "Respond in Hindi (Devanagari script). Keep technical terms and technology names in English."
    : "Respond in English.";

  const prompt = `You are a senior engineer creating technical interview questions.

Technology: ${tech}
Experience Level: ${level}
Role: ${role}

${languageInstructions}

Generate EXACTLY ${count} production diagnostic technical questions for a ${level} ${role} with ${tech} experience.

CRITICAL RULES:
- Use ONLY question starters: "What happens when", "What occurs if", "How does"
- Each question must be concrete, specific, and tech-focused
- Focus on system behavior under failure/edge cases
- NO generic "Explain" or "Tell me about" questions
- Each question 1-2 sentences max

Return ONLY JSON array format:
["Question 1", "Question 2", ..., "Question ${count}"]`;

  try {
    const { text: responseText } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: prompt,
      maxOutputTokens: 1024,
    });

    // Parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Use what we got, even if not exactly the requested count
        // This prevents empty arrays when LLM generates 2 instead of 3 questions
        console.log(`✅ LLM generated ${parsed.length} questions (requested ${count})`);
        return parsed.slice(0, Math.min(parsed.length, count)) as string[];
      }
    } catch (e) {
      console.warn("⚠️ Failed to parse LLM response:", e);
      // Try to extract questions from text if JSON parsing fails
      const questionMatches = responseText.match(/"([^"]+)"/g);
      if (questionMatches && questionMatches.length > 0) {
        const extractedQuestions = questionMatches
          .slice(0, count)
          .map(match => match.slice(1, -1)); // Remove quotes
        console.log(`✅ Extracted ${extractedQuestions.length} questions from text`);
        return extractedQuestions;
      }
    }

    // Fallback: return empty array (will be handled by caller)
    return [];
  } catch (error) {
    console.error("❌ LLM fallback failed:", error);
    return [];
  }
}

/**
 * GET STANDARD QUESTIONS - Main entry point
 *
 * Retrieves questions using RAG approach with LLM fallback
 * @param params Configuration
 * @returns Questions and metadata
 */
export async function getStandardQuestions(
  params: GetStandardQuestionsParams
): Promise<GetStandardQuestionsResult> {
  const { techStack, level, amount, role, language = "en", interviewMode = "standard" } = params;
  // Note: 'type' from params reserved for future handling of different interview types

  // ⚠️ SMART RAG BYPASS LOGIC:
  // - Resume mode (any language): Always use LLM fallback
  // - Standard mode + Hindi: Always use LLM fallback
  // - Standard mode + English: Use RAG bank first, then LLM fallback
  const skipRAG = interviewMode === "resume" || language === "hi";
  const ragMode = skipRAG ? "🚫 RAG SKIPPED" : "✅ RAG ENABLED";

  console.log(
    `📚 [RAG] Starting question generation: ${techStack} (${amount} questions, ${level}, language: ${language}, mode: ${interviewMode}) ${ragMode}`
  );

  // Parse tech stack
  const techs = techStack
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (techs.length === 0 || amount <= 0) {
    console.error("❌ Invalid tech stack or amount");
    return {
      questions: [],
      sources: [],
      totalFromRAG: 0,
      totalFromLLM: 0,
    };
  }

  // Normalize level to match STANDARD_QUESTIONS keys (junior, medium, senior)
  const normalizedLevel = normalizeLevelToQuestionBankKey(level);
  console.log(`\n📊 Level: ${level} → Normalized: ${normalizedLevel}`);

  // Distribute questions across tech stack
  const distribution = distributeQuestions(techs, amount);
  console.log(`📋 Distribution: ${techs.map((t, i) => `${t}=${distribution[i]}`).join(", ")}`);
  console.log("=================================");

  const finalQuestions: string[] = [];
  const sources: GetStandardQuestionsResult["sources"] = [];
  const askedQuestions = new Set<string>();
  let ragCount = 0;
  let llmCount = 0;

  // Process each tech
  for (let i = 0; i < techs.length; i++) {
    const tech = techs[i];
    const questionCount = distribution[i];

    if (questionCount === 0) continue;

    logProcessingStart(tech, questionCount, normalizedLevel);

    // ⚠️ CONDITIONAL RAG USAGE:
    // Skip RAG if: Resume mode OR Non-English language
    // Only use RAG if: Standard mode AND English
    const ragQuestions = skipRAG ? [] : getQuestionsFromRAG(tech, normalizedLevel, questionCount, askedQuestions);

    if (!skipRAG && ragQuestions.length === questionCount) {
      // Success: got all questions from RAG ✅ (only possible if RAG not skipped)
      logRagSelected(tech, normalizedLevel, ragQuestions);
      ragQuestions.forEach((q) => askedQuestions.add(q));
      finalQuestions.push(...ragQuestions);
      sources.push({
        tech,
        method: "rag",
        count: questionCount,
      });
      ragCount += questionCount;
    } else if (!skipRAG && ragQuestions.length > 0) {
      // Partial success: got some from RAG, rest from LLM ⚠️ (only possible if RAG not skipped)
      logRagSelected(tech, normalizedLevel, ragQuestions);
      ragQuestions.forEach((q) => askedQuestions.add(q));
      finalQuestions.push(...ragQuestions);

      const remaining = questionCount - ragQuestions.length;
      logLLMFallback(tech, "Partial RAG, need more questions", remaining);
      
      const llmQuestions = await fallbackToLLM(
        tech,
        level,
        remaining,
        role,
        language
      );

      if (llmQuestions.length > 0) {
        logLLMGenerated(tech, llmQuestions);
        llmQuestions.forEach((q) => askedQuestions.add(q));
        finalQuestions.push(...llmQuestions);
        llmCount += llmQuestions.length;

        sources.push({
          tech,
          method: "rag",
          count: ragQuestions.length,
        });
        sources.push({
          tech,
          method: "llm-fallback",
          count: llmQuestions.length,
        });
      } else {
        console.warn(`❌ LLM fallback also failed for ${tech}`);
      }
    } else {
      // No RAG questions available: use LLM for all ❌
      // This occurs when:
      // 1. skipRAG = true (Resume mode OR Non-English language), OR
      // 2. Tech not in RAG bank, OR
      // 3. RAG depleted
      const reason = skipRAG 
        ? `RAG skipped (${interviewMode} mode + ${language} language)` 
        : "Tech not in RAG bank or depleted";
      logLLMFallback(tech, reason, questionCount);
      
      const llmQuestions = await fallbackToLLM(
        tech,
        level,
        questionCount,
        role,
        language
      );

      if (llmQuestions.length > 0) {
        logLLMGenerated(tech, llmQuestions);
        llmQuestions.forEach((q) => askedQuestions.add(q));
        finalQuestions.push(...llmQuestions);
        llmCount += llmQuestions.length;

        sources.push({
          tech,
          method: "llm-fallback",
          count: llmQuestions.length,
        });
      }
    }
  }

  // 🎯 LOG FINAL MERGED QUESTION SET
  logFinalQuestionSet(finalQuestions, ragCount, llmCount);

  return {
    questions: finalQuestions,
    sources,
    totalFromRAG: ragCount,
    totalFromLLM: llmCount,
  };
}
