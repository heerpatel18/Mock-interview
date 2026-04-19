/**
 * Backend API for generating Hindi follow-up questions using OpenRouter
 * 
 * This endpoint is used by the Hindi interview pipeline to generate next questions
 * and follow-ups based on user answers.
 * 
 * OpenRouter is called from backend to keep API key secure.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body;

    // ✅ Safe JSON parsing
    try {
      body = await request.json();
    } catch (err) {
      console.error("🔴 Invalid JSON:", err);
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.log("📥 Incoming body:", body);

    const { question, answer, questionIndex, isGreeting, isFeedbackOnly } = body;

    // ✅ Validation
    if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
      return Response.json(
        { error: "Answer is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return Response.json(
        { error: "Question is required and must be a non-empty string" },
        { status: 400 }
      );
    }

const apiKey = process.env.OPENROUTER_API_KEY!;

console.log("🔑 OpenRouter key exists:", !!apiKey);

const response = await fetch(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Mock Interview App",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional technical interviewer. Respond ONLY in Hindi (Devanagari script). Keep technical terms in English.",
        },
        {
          role: "user",
          content: isFeedbackOnly
            ? `Question: "${question}"\n\nUser answered: "${answer}"\n\nProvide SHORT feedback in Hindi (max 3 sentences). Focus on what's correct and one key improvement. No code blocks, no bullet points, no long explanations. Example: "आपका उत्तर सही दिशा में है। आपने error return values सही बताया। err != nil भी mention कर सकते थे।"`
            : isGreeting
            ? `Initial greeting: "${question}"\n\nUser responded: "${answer}". Generate a brief, natural follow-up greeting in Hindi in just one or two sentences that acknowledges their response and transitions to starting the interview. Keep it conversational and professional.`
            : `Question: "${question}"\n\nUser answered: "${answer}"\n\nEvaluate the user's answer and provide feedback in this format:\n\n1. Is the answer correct? (Brief assessment in Hindi)\n2. What is missing or could be improved? (Point out gaps)\n3. Give ideal answer (short, in Hindi with English technical terms)\n4. Then ask the next logical question in Hindi.\n\nFormat your response exactly like this example:\nआपका उत्तर सही दिशा में है।\n\nGolang में errors values के रूप में return होते हैं.\nलेकिन आपको यह भी बताना चाहिए:\n\nif err != nil {\n   return err\n}\n\nअब अगला सवाल:\nAPI calls optimize कैसे करेंगे?`,
        },
      ],
      max_tokens: isFeedbackOnly ? 150 : 400,
    }),
  }
);

if (!response.ok) {
  const errText = await response.text();
  console.error("🔴 OpenRouter error:", errText);

  return Response.json(
    { error: errText },
    { status: response.status }
  );
}

    const data = await response.json();

    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      console.error("🔴 Invalid AI response:", data);
      return Response.json(
        { error: "Invalid AI response" },
        { status: 500 }
      );
    }

    console.log("✅ Follow-up generated:", text);

    return Response.json({
      text,
      questionIndex,
    });

  } catch (error) {
    console.error("🔴 Server crash:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}