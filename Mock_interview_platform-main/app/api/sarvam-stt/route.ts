export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    console.log("📥 Received STT request");

    const formData = await request.formData();
    const audioFile = formData.get("file") as File | null;

    if (!audioFile) {
      return Response.json({ error: "Audio file required" }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.error("🔴 SARVAM_API_KEY missing");
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const sarvamForm = new FormData();
    sarvamForm.append("file", audioFile, "audio.wav");
    sarvamForm.append("language_code", "hi-IN");
    sarvamForm.append("model", "saarika:v2.5");
    sarvamForm.append("with_timestamps", "false");

    console.log("📤 Sending request to Sarvam...");

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
      body: sarvamForm,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Sarvam STT error:", err);
      return Response.json({ error: "STT failed" }, { status: 500 });
    }

    const data = await response.json();
    const transcript = data?.transcript || "";

    console.log("✅ Sarvam STT response:", transcript);
    return Response.json({ transcript });
  } catch (error) {
    console.error("STT route error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
