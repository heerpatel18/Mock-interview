export const runtime = "nodejs";

import { generateText } from "ai";
import { buildPrompt, buildTranscriptOnlyPrompt, type VideoSummary } from "@/services/feedbackService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const videoSummary = body.videoSummary as VideoSummary | undefined;

    if (!transcript || transcript.trim().length === 0) {
      return Response.json(
        { error: "Transcript is required." },
        { status: 400 }
      );
    }

    const prompt = videoSummary
      ? buildPrompt(transcript.trim(), videoSummary)
      : buildTranscriptOnlyPrompt(transcript.trim());

    const response = await generateText({
      model: "google/gemini-1.5-flash",
      prompt,
      temperature: 0.2,
      max_tokens: 900,
      system: "Return ONLY valid JSON exactly in the requested shape. No markdown, no explanation text.",
    });

    const text = response.text?.trim();
    if (!text) {
      return Response.json(
        { error: "Empty response from LLM." },
        { status: 500 }
      );
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        return Response.json(
          { error: "Unable to parse LLM response." },
          { status: 500 }
        );
      }
      result = JSON.parse(match[0]);
    }

    return Response.json(result);
  } catch (error: unknown) {
    console.error("/api/feedback error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
