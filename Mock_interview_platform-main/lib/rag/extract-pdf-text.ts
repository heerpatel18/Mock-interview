/**
 * Extract text from PDF buffer by calling Python FastAPI service.
 * This replaces pdf-parse with pypdf via a microservice.
 * 
 * Architecture:
 * Browser → Next.js route.ts → Node.js calls this function → Python FastAPI → returns text
 * 
 * @param buffer - PDF file content as Buffer
 * @returns Extracted text from PDF
 * @throws Error if PDF extraction fails
 */
import FormData from "form-data";
import fetch from "node-fetch";

// 
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("PDF buffer is empty");
  }

  const form = new FormData();

  form.append("file", buffer, {
    filename: "resume.pdf",
    contentType: "application/pdf",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    console.log("[PDF Extraction] Sending PDF to FastAPI service...");

    // Call the FastAPI service to extract text from PDF 
    const response = await fetch("http://127.0.0.1:8001/extract-pdf", {
      method: "POST",
      body: form,
      headers: form.getHeaders(), 
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`PDF service returned ${response.status}`);
    }

    // text extracted from PDF is in response body as JSON 
    const data = await response.json();

    if (data.error) {
      console.warn("[PDF Extraction] Warning:", data.error);
    } else {
      console.log("[PDF Extraction] Success");
    }

    const extractedText = data.text ?? "";

    if (process.env.PDF_DEBUG_LOG === "1") {
      console.log(`[PDF Extraction] Extracted text length: ${extractedText.length}`);
      console.log(
        `[PDF Extraction] Preview: ${extractedText
          .slice(0, 500)
          .replace(/\s+/g, " ")
          .trim()}`
      );
    }

    return extractedText;

  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("PDF extraction timeout");
    }
    throw new Error("PDF extraction failed: " + error.message);
  } finally {
    clearTimeout(timeoutId);
  }
}
