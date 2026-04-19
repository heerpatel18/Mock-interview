import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/rag/extract-pdf-text";

/**
 * API route to extract text from PDF buffer.
 * This server-side route handles PDF extraction without exposing Node.js-only modules to the client.
 * 
 * @param request POST request with PDF file in FormData
 * @returns Extracted text from PDF
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const extractedText = await extractTextFromPdfBuffer(buffer);

    return NextResponse.json(
      { text: extractedText },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PDF Extraction API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `PDF extraction failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
