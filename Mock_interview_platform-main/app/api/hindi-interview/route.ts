/**
 * DEPRECATED - Hindi Interview System API
 * 
 * This endpoint is no longer used.
 * Hindi interviews now run entirely in the browser using Web Speech API.
 * 
 * Flow:
 * 1. Questions are generated when user fills dashboard form
 * 2. Questions are passed to /interview/[id] page
 * 3. User clicks "Call" (Hindi mode) on interview page
 * 4. startHindiInterview() runs in browser with:
 *    - Web Speech API SpeechRecognition (STT) for hi-IN language
 *    - Web Speech API SpeechSynthesis (TTS) for speaking questions/follow-ups
 *    - OpenRouter LLM for generating intelligent follow-up questions
 *    - Real-time message storage for feedback integration
 * 5. After interview ends, feedback system triggers automatically
 * 
 * See: components/Agent.tsx startHindiInterview() function
 * See: app/api/generate-followup/route.ts for follow-up generation
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "This endpoint is deprecated. Hindi interviews now run entirely in the browser using Web Speech API.",
      details:
        "Questions are passed directly to the interview page. Use the startHindiInterview() function in components/Agent.tsx instead.",
    },
    { status: 410 }
  );
}
