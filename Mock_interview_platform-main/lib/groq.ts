import { createGroq } from "@ai-sdk/groq";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error("❌ GROQ_API_KEY is missing from .env.local");
  throw new Error("GROQ_API_KEY environment variable is not set. Please add it to your .env.local file.");
}

console.log("✅ GROQ_API_KEY loaded successfully");

export const groq = createGroq({
  apiKey: apiKey,
});
