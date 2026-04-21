export type VideoSummary = {
  eyeContactPct: number;
  lookingDownPct: number;
  smilingPct: number;
  posturePct: number;
  distractedCount: number;
  totalFrames: number;
  durationMinutes: number;
};

export type FeedbackResult = {
  overall: number;
  content: number;
  communication: number;
  confidence: number;
  eyeContact: number;
  posture: number;
  strength: string;
  improvement: string;
  summary: string;
};

export function buildPrompt(transcript: string, video: VideoSummary): string {
  return `You are an expert interview coach. Analyze this interview performance and score the sectors.

TRANSCRIPT:
${transcript}

VIDEO ANALYSIS (${video.durationMinutes} min session, ${video.totalFrames} frames analyzed):
- Eye contact: ${video.eyeContactPct}% of session
- Looking down: ${video.lookingDownPct}% of session
- Smiling / engaged: ${video.smilingPct}% of session
- Good posture: ${video.posturePct}% of session
- Distracted moments: ${video.distractedCount} times

Score each sector 0-100 and respond ONLY in JSON:
{
  overall: score based on transcript only,
  content: score based on transcript only,
  communication: score based on transcript only,
  confidence: score using 50% transcript analysis + 50% video metrics (eye contact, posture, smiling, distracted count),
  eyeContact: ${video.eyeContactPct},
  posture: ${video.posturePct},
  strength: string,
  improvement: string,
  summary: string
}`;
}

export function buildTranscriptOnlyPrompt(transcript: string): string {
  return `You are an expert interview coach. Analyze this interview transcript and score all 5 sectors.

TRANSCRIPT:
${transcript}

Score each sector 0-100 and respond ONLY in JSON:
{ overall, content, communication, confidence, eyeContact, posture, strength, improvement, summary }`;
}

export async function getFeedback(
  transcript: string,
  videoSummary?: VideoSummary
): Promise<FeedbackResult> {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript, videoSummary }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to get feedback");
  }

  return payload as FeedbackResult;
}
