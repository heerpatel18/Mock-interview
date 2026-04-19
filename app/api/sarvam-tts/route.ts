export const runtime = "nodejs";

export async function POST(request: Request) {
try {
const body = await request.json();
const text = body?.text;


console.log("📥 TTS request received:", { text });

if (!text || typeof text !== "string") {
  return Response.json({ error: "Text required" }, { status: 400 });
}

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
  console.error("🔴 SARVAM_API_KEY missing");
  return Response.json(
    { error: "Server configuration error" },
    { status: 500 }
  );
}

console.log("📤 Sending to Sarvam TTS...");

const response = await fetch("https://api.sarvam.ai/text-to-speech", {
  method: "POST",
  headers: {
    "api-subscription-key": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: text,                       // ✅ correct field
    target_language_code: "hi-IN",
    speaker: "priya",                 // ✅ valid speaker
    model: "bulbul:v3",               // ✅ latest stable model
  }),
});

// 🔥 IMPORTANT: show real error from Sarvam
if (!response.ok) {
  const err = await response.text();
  console.error("❌ FULL Sarvam TTS error:", err);

  return Response.json(
    { error: err || "TTS failed" },
    { status: 500 }
  );
}

const data = await response.json();

console.log("📦 Raw TTS response:", data);

const audioBase64 = data?.audios?.[0];

if (!audioBase64 || typeof audioBase64 !== "string") {
  console.error("❌ Invalid audio response:", data);
  return Response.json({ error: "Invalid audio response" }, { status: 500 });
}

console.log("✅ Audio generated successfully");

return Response.json({ audio: audioBase64 });


} catch (error) {
console.error("❌ TTS route error:", error);
return Response.json({ error: "Server error" }, { status: 500 });
}
}
