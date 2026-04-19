// General server actions for interviews and feedback.
// - `createFeedback`: takes a transcript from the frontend, sends it to Groq with structured prompt, and saves scores in Firestore.

"use server";
// groq API helper functions from AI SDK

"use server";

import { generateText } from "ai";
import { groq } from "@/lib/groq";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import { extractRoleRequirements, generateRoleFit, getCombinedTechStack } from "@/lib/parser/jdParser";

import type { 
  CreateFeedbackParams, 
  Interview, 
  GetFeedbackByInterviewIdParams, 
  Feedback, 
  GetLatestInterviewsParams 
} from "@/types";    



export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    if (!interviewId || !userId || !transcript || transcript.length === 0) {
      throw new Error("Missing required parameters for feedback generation");
    }

    // ✅ CLEAN TRANSCRIPT (FIXED)
    const formattedTranscript = transcript
      .map((s: { role: string; content: string }) => `${s.role}: ${s.content}`)
      .join("\n")
      .trim();

    if (!formattedTranscript || formattedTranscript.length < 20) {
      throw new Error("Transcript too weak to analyze");
    }

    // Fetch interview data
    const interviewDoc = await db.collection("interviews").doc(interviewId).get();
    const interviewData = interviewDoc.exists ? interviewDoc.data() : null;

    const jobDescription =
      interviewData?.jobDescription?.trim() ||
      "No job description provided.";
    const language = interviewData?.language || "en";
    console.log("📄 JD:", jobDescription.substring(0, 200));
    console.log("🗣️ Transcript:", formattedTranscript.substring(0, 200));
    console.log("🌐 Language:", language);

    // ✅ CLEAN MAIN PROMPT (FIXED & MULTILINGUAL)
    const languageInstructions = language === "hi" 
      ? "आपको पूर्ण हिंदी (देवनागरी लिपि) में उत्तर देना है। तकनीकी शब्द अंग्रेजी में रखें। कृपया किसी भी अन्य भाषा का उपयोग न करें।" 
      : "Respond in English.";

    const prompt = `
You are an expert interviewer evaluating a candidate for a technical role.

${languageInstructions}

JOB DESCRIPTION:
${jobDescription}

INTERVIEW TRANSCRIPT:
${formattedTranscript}

Evaluate the candidate across these 5 categories. Be SPECIFIC and DETAILED - use concrete examples from the transcript. Do NOT be generic.

1. Communication Skills - How clearly did they explain concepts? Did they use proper terminology? Give specific examples from their answers.

2. Technical Knowledge - What specific technologies/frameworks did they demonstrate knowledge of? What depth did they show? Give concrete examples of what they explained well vs what they struggled with.

3. Problem-Solving - How did they approach problems? Did they think step-by-step? Give specific examples of their problem-solving process from the transcript.

4. Cultural Fit - Based on BOTH transcript AND job description, how well do they align with company values (teamwork, ownership, learning mindset)? Give specific examples.

5. Confidence & Clarity - How confident were their responses? Did they hesitate or speak clearly? Give specific examples.

IMPORTANT RULES:
- Use SPECIFIC examples from the transcript (quote their actual words when relevant)
- Be honest and realistic - don't sugarcoat weaknesses
- Cultural Fit MUST consider both transcript behavior AND job description values
- Give detailed, actionable feedback
- For each category, explain WHY you gave that score with transcript evidence

Return STRICT JSON ONLY:

{
  "totalScore": number,
  "categoryScores": [
    {"name": "Communication Skills", "score": number, "comment": string},
    {"name": "Technical Knowledge", "score": number, "comment": string},
    {"name": "Problem-Solving", "score": number, "comment": string},
    {"name": "Cultural Fit", "score": number, "comment": string},
    {"name": "Confidence & Clarity", "score": number, "comment": string}
  ],
  "strengths": ["Specific strength with example"],
  "areasForImprovement": ["Specific area with actionable advice"],
  "finalAssessment": "Detailed overall assessment with specific recommendations"
}
`;

    let object: any;

    try {
      const { text } = await generateText({
        model: groq("llama-3.3-70b-versatile"),
        prompt,
        system:
          "Return ONLY valid JSON. No explanations, no markdown.",
        temperature: 0.3,
      });

      // ✅ SAFE JSON PARSE
      try {
        object = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Invalid JSON from AI");
        object = JSON.parse(match[0]);
      }

      // ✅ VALIDATION
      if (
        !object ||
        !Array.isArray(object.categoryScores) ||
        object.categoryScores.length !== 5
      ) {
        throw new Error("Invalid feedback structure");
      }

      // ===========================
      // ROLE FIT (SEPARATE LOGIC)
      // ===========================

      console.log("🔍 Computing Role Fit...");

      let roleFitResult = {
        score: 50,
        comment: "Unable to compute role fit.",
      };

      try {
        const roleRequirements = await extractRoleRequirements(jobDescription);

        let techStack: string[] = [];
        const mode = interviewData?.interviewMode;

        if (mode === "resume" && interviewData?.projects) {
          techStack = getCombinedTechStack(interviewData.projects);
        } else if (interviewData?.techstack) {
          const ts = interviewData.techstack;
          techStack = Array.isArray(ts)
            ? ts
            : ts.split(",").map((t: string) => t.trim());
        }

        console.log("💻 Tech Stack:", techStack);
        console.log("📋 Requirements:", roleRequirements);

        if (techStack.length > 0 || roleRequirements.skills?.length > 0) {
          roleFitResult = await generateRoleFit({
            techStack,
            roleRequirements,
            language,
          });
        }
      } catch (e) {
        console.warn("⚠️ Role fit failed:", e);
      }

      // ✅ INSERT ROLE FIT (AFTER Cultural Fit)
      object.categoryScores.splice(4, 0, {
        name: "Role Fit",
        score: roleFitResult.score,
        comment: roleFitResult.comment,
      });

      console.log("✅ Role Fit inserted");

    } catch (error) {
      console.error("❌ AI Error:", error);
      throw error;
    }

    // ===========================
    // SAVE FEEDBACK
    // ===========================

    const feedback = {
      interviewId,
      userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    await feedbackRef.set(feedback);

    console.log("✅ Feedback saved:", feedbackRef.id);

    return { success: true, feedbackId: feedbackRef.id };

  } catch (error: any) {
    console.error("❌ Error:", error);
    return { success: false, error: error.message };
  }
}
//Fetch interview document using id . returns -> role , techstack, type, level, question , userid

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}






// Fetch feedback document using interview ID and user ID . returns feedback 
export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> { 
  const { interviewId, userId } = params;

  if (!interviewId || !userId) {
    console.warn("Missing interviewId or userId for fetching feedback");
    return null;
  }

  // Query Firestore for feedback matching the interview ID and user ID
  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId) // same int same user
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  // Return first matching feedback document
  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}




// latest interviews for all users except the current user, new first , limit to 20 ppl 
// returns array of interviews w role, techstack, type, level, question , userid , createdat(sort mate )
export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  //fetch int from f store
  const snapshot = await db
    .collection("interviews")
    .where("finalized", "==", true) // only completed interviews
    .orderBy("createdAt", "desc") // newest first
    .limit(limit) // limit results
    .get();

  // Convert Firestore docs → JS objects
  // Also remove interviews created by the current user
  const interviews = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((interview: any) => interview.userId !== userId);

  return interviews as Interview[];
}




// Fetch all interviews for one specific user, 
// user's past interviews
// returns same data as above but only for one user and sorted by created at desc
export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId) 
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}












//User finishes interview
  //    ↓
//Transcript sent to createFeedback()
 //     ↓
//Transcript formatted
 //     ↓
//Gemini evaluates using schema
 //     ↓
//Structured object returned
  //    ↓
//Feedback document saved in Firestore
  //    ↓
//feedbackId returned
//      ↓
//Frontend displays results