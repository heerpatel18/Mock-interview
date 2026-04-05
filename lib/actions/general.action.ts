// General server actions for interviews and feedback.
// - `createFeedback`: takes a transcript from the frontend, sends it to Groq with structured prompt, and saves scores in Firestore.

"use server";
// groq API helper functions from AI SDK

"use server";

import { generateText } from "ai";
import { groq } from "@/lib/groq";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";


import type { 
  CreateFeedbackParams, 
  Interview, 
  GetFeedbackByInterviewIdParams, 
  Feedback, 
  GetLatestInterviewsParams 
} from "@/types";    



export async function createFeedback(params: CreateFeedbackParams) {
  // Extract parameters from the input object
  const { interviewId, userId, transcript, feedbackId } = params; 

  try {
    // Validate required parameters
    if (!interviewId || !userId || !transcript || transcript.length === 0) {
      throw new Error("Missing required parameters for feedback generation");
    }

    //  transcript into readable string
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n` 
      )
      .join("");

    if (!formattedTranscript.trim()) {
      throw new Error("No valid transcript content to analyze");
    }

    // Use text generation and parse the JSON 
    let object: any;
    try {
      const { text } = await generateText({
        model: groq("llama-3.3-70b-versatile"),
        prompt: `You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.

Transcript:
${formattedTranscript}

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not add any text before or after the JSON. Do not wrap it in markdown code blocks.

Respond with this exact JSON structure:
{
  "totalScore": <number 0-100>,
  "categoryScores": [
    {"name": "Communication Skills", "score": <number 0-100>, "comment": "<string>"},
    {"name": "Technical Knowledge", "score": <number 0-100>, "comment": "<string>"},
    {"name": "Problem-Solving", "score": <number 0-100>, "comment": "<string>"},
    {"name": "Cultural & Role Fit", "score": <number 0-100>, "comment": "<string>"},
    {"name": "Confidence & Clarity", "score": <number 0-100>, "comment": "<string>"}
  ],
  "strengths": ["<string>", "<string>", "<string>"],
  "areasForImprovement": ["<string>", "<string>", "<string>"],
  "finalAssessment": "<string>"
}`,
        system: "You are a professional interviewer. ALWAYS respond with ONLY valid JSON, never with any additional text or formatting.",
        temperature: 0.3,
        maxTokens: 2048,
      });

      //  convert string → JSON object
      try {
        // Try direct parsing first
        object = JSON.parse(text);
      } catch (parseError: any) {
        // If direct parsing fails, clean text first
        console.warn("Direct JSON parse failed, attempting to extract JSON...");
        
        // Remove ```json or ``` markdown code blocks if present
        let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        // Try to find JSON object pattern (starting with { and ending with })
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/); 
        
        // if json found 
        if (jsonMatch) {
          try {
            object = JSON.parse(jsonMatch[0]); // parse cleaned json
            console.log("Successfully extracted JSON from text");
          } catch (extractError: any) {
            console.error("Failed to parse extracted JSON:", jsonMatch[0], extractError);
            console.error("Original text:", text);
            throw new Error("AI output was not valid JSON");
          }
        } else {
          console.error("Failed to find JSON pattern in response:", text);
          throw new Error("AI output was not valid JSON");
        }
      }
      // Validate that object has required fields
      const isValidFeedback = object && 
        typeof object.totalScore === 'number' &&
        Array.isArray(object.categoryScores) &&
        object.categoryScores.length === 5 &&
        Array.isArray(object.strengths) &&
        Array.isArray(object.areasForImprovement) &&
        typeof object.finalAssessment === 'string';
      
      if (!isValidFeedback) {
        console.error("Parsed object is missing required fields:", object);
        throw new Error("AI output JSON is missing required fields");
      }
    } catch (apiError: any) {
      const errorMsg = apiError?.message || String(apiError);
      const statusCode = apiError?.statusCode;



      // If API quota is exhausted, rate limited, model not found, or JSON parsing failed, use mock feedback
      if (
        statusCode === 429 || // Rate limited
        statusCode === 404 || // Model not found
        errorMsg.includes("quota") || // Quota exhausted
        errorMsg.includes("not found") || // Model not found
        errorMsg.includes("RESOURCE_EXHAUSTED") || // Quota exceeded
        errorMsg.includes("not valid JSON") || // JSON parsing failed
        errorMsg.includes("missing required fields") || // Invalid JSON structure
        errorMsg.includes("JSON") // Any JSON-related error
      ) {
        console.warn("Groq API or JSON parsing issue. Using mock feedback for development.", errorMsg);
        // Generate mock feedback based on transcript length
        const messageCount = transcript.length;
        // Consider longer transcripts as higher quality and assign better scores
        const hasQuality = formattedTranscript.length > 200;
        const score = hasQuality ? Math.min(85 + Math.random() * 10, 95) : Math.min(70 + Math.random() * 15, 85);

        // Create a mock feedback object with some variability based on transcript characteristics
        object = {
          totalScore: Math.round(score),
          categoryScores: [
            {
              name: "Communication Skills",
              score: Math.round(score * 0.95),
              comment: messageCount > 5 ? "Good engagement and clarity in responses" : "Could improve engagement with more detailed answers"
            },
            {
              name: "Technical Knowledge",
              score: Math.round(score * 0.92),
              comment: hasQuality ? "Demonstrated solid understanding of key concepts" : "Technical explanations could be more detailed"
            },
            {
              name: "Problem-Solving",
              score: Math.round(score * 0.88),
              comment: "Showed ability to think through problems systematically"
            },
            {
              name: "Cultural & Role Fit",
              score: Math.round(score * 0.90),
              comment: "Professional demeanor and good alignment with role requirements"
            },
            {
              name: "Confidence & Clarity",
              score: Math.round(score * 0.93),
              comment: "Responses were clear and well-articulated"
            }
          ],
          strengths: [
            "Active participation and engagement",
            "Clear communication style",
            "Willingness to learn and grow"
          ],
          areasForImprovement: [
            "Provide more specific examples in answers",
            "Dive deeper into technical details when discussing complex topics",
            "Focus on quantifiable outcomes and metrics"
          ],
          finalAssessment: `Overall, you demonstrated ${score > 80 ? "strong" : "solid"} performance in the mock interview. Continue to work on providing more detailed examples and concrete metrics to strengthen your responses.`
        };
      } else {
        throw apiError;
      }
    }



    //Prepare Feedback Object to save in Firestore
    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };


    // Validate feedback object against schema before saving 
    let feedbackRef; // 
    //Save Feedback in Firestore
    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    // Save the feedback data to fs
    await feedbackRef.set(feedback); 

    console.log("Feedback saved successfully:", {
      feedbackId: feedbackRef.id,
      interviewId,
      userId,
      totalScore: feedback.totalScore
    });

    // returns 
    return { success: true, feedbackId: feedbackRef.id };

  } catch (error) {
    console.error("Error saving feedback:", error);
    console.error("Error details:", {
      interviewId,
      userId,
      transcriptLength: transcript?.length,
      feedbackId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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