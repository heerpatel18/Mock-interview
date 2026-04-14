# Python PDF Extraction Service Setup Guide

## 2026 Update Summary

This guide now reflects the current architecture:
- Interview form includes **company selection or custom JD input**.
- Final `jobDescription` is sent during interview generation and saved in Firestore.
- Feedback flow reads interview `jobDescription` and uses it for **Cultural & Role Fit** scoring.
- PDF extraction runs through Python FastAPI (`pdf_server.py`) using `pypdf`.

## Prerequisites
- Python 3.8+
- pip

## Installation & Setup

### 1. Install Python Dependencies
```bash
cd lib/rag
pip install -r requirements.txt
```

### 2. Start the FastAPI Server
```bash
python pdf_server.py
```

Server runs on: **http://localhost:8001**

Health check: `GET /health`

---

## Integration with Node.js

### Current Flow
1. Browser uploads PDF
2. `app/api/vapi/generate/route.ts` receives FormData with PDF (+ form fields + JD/company metadata)
3. `extractTextFromPdfBuffer()` in `extract-pdf-text.ts` calls Python service
4. Python service extracts text using pypdf
5. Text returned to `route.ts`
6. Resume RAG pipeline (`normalizeResumeText` -> `extractProjectsWithTech` -> `filterProjectsByTech`) processes text
7. Groq generates questions
8. Interview document is saved with `jobDescription` and `companyType`

### No Changes Required to route.ts
The function signature is unchanged. Your existing code flow works as-is.

---

## Interview + Feedback Flow (JD Integration)

### Interview Generation
- Frontend file: `app/(root)/interview/page.tsx`
- New fields:
  - `companyType` (dropdown)
  - `customJD` (textarea)
- Final JD computed as:
  - `customJD.trim() || COMPANY_JDS[companyType] || ""`
- Sent to `/api/vapi/generate` as:
  - JSON (standard mode)
  - FormData (resume mode)

### Firestore Interview Document
Saved by `app/api/vapi/generate/route.ts` with:
- `jobDescription`
- `companyType`
- plus existing interview metadata

### Feedback Generation
- Server action: `lib/actions/general.action.ts` (`createFeedback`)
- Fetches interview by `interviewId`
- Uses interview `jobDescription` fallback if missing
- Injects JD + transcript into Cultural & Role Fit guidance for Groq

---

## How It Works

### Python Service (`pdf_server.py`)
- **Endpoint**: `POST /extract-pdf`
- **Input**: PDF file via multipart/form-data
- **Output**: JSON with extracted text and optional error message
- **Error Handling**:
  - Empty PDF → returns error message with empty text
  - Scanned/image PDFs → returns error message with empty text  
  - Invalid file → returns 400 status
  - Any exception → returns 500 status with error details

### Node.js Function (`extractTextFromPdfBuffer`)
- **Input**: Buffer containing PDF bytes
- **Processing**:
  - Validates buffer is non-empty
  - Converts to Blob and FormData
  - Sends POST request via fetch
  - Timeout: 10 seconds (AbortController)
  - Validates JSON response
  - Logs warnings if service returns error
- **Output**: Extracted text string (empty string if extraction fails)
- **Error Handling**:
  - Throws meaningful errors for network issues
  - Handles timeout gracefully
  - Handles JSON parse errors

---

## Example Usage

```typescript
// In route.ts (existing code, no changes)
import { extractTextFromPdfBuffer } from "@/lib/rag/extract-pdf-text";

// When receiving PDF from browser:
const buffer = await resumePdfFile.arrayBuffer();
const resumeBuffer = Buffer.from(buffer);

// Call the function - it now uses Python service internally
const resumeText = await extractTextFromPdfBuffer(resumeBuffer);

// Resume text is then processed through your RAG pipeline
const normalized = normalizeResumeText(resumeText);
const projects = extractProjectsWithTech(normalized);
```

---

## Troubleshooting

### "Connection refused" Error
- Ensure Python service is running: `python lib/rag/pdf_server.py`
- Check port 8001 is not blocked

### "PDF extraction service timeout"
- Python service is slow
- Check file size (very large PDFs may exceed 10s)
- Increase timeout in `extract-pdf-text.ts` if needed

### "No extractable text" Error
- PDF is scanned/image-based (not text-based)
- PDF is corrupted or invalid format
- Handled gracefully - returns empty string to frontend

### Service crashes
- Check Python version: `python --version` (needs 3.8+)
- Verify pypdf is installed: `pip list | grep pypdf`
- Check logs from `python pdf_server.py`

---

## Production Notes

1. **Docker**: Wrap `pdf_server.py` in Docker for production deployment
2. **Process Manager**: Use PM2 or systemd for long-running Python service
3. **Logging**: FastAPI logs all extraction errors (check console output)
4. **Resource Limits**: Consider max file size and request timeout based on your needs
5. **Load Balancing**: For high throughput, run multiple PDF service instances with load balancer

---

## Environment/Runtime Notes

- Python service endpoint used by Node:
  - `http://127.0.0.1:8001/extract-pdf`
- Node timeout in `extract-pdf-text.ts`:
  - 10 seconds
- Optional verbose extraction logs:
  - set `PDF_DEBUG_LOG=1`

---

## Removing Old Dependencies

If `pdfjs-dist` is still installed and unused, remove it:

```bash
npm uninstall pdfjs-dist
```

Current flow is:

**Browser -> Node route -> Python FastAPI PDF extraction -> Node RAG pipeline -> Groq question generation -> Firestore save (with JD/company metadata) -> Interview -> Transcript -> Feedback generation with JD-aware Cultural & Role Fit**
