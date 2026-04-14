"""
FastAPI microservice for PDF text extraction using pypdf.
Endpoint: POST /extract-pdf
Returns: { "text": "...", "error": null | "message" }

1. User uploads resume
2. Node backend receives file
3. Node sends file → FastAPI
4. FastAPI extracts text
5. FastAPI returns JSON
6. Node receives text
7. Node sends text → LLM (Groq)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pypdf import PdfReader
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
PDF_DEBUG_LOG = False

#Creates your API server
app = FastAPI(title="PDF Text Extractor")

# React frontend Node backend to call this Python server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#POST request . Accepts a file
@app.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    print(f"[DEBUG] Request received for file: {file.filename}")
    
    try:
        # Validate file : file exist has name to file
        if not file or not file.filename:
            return JSONResponse(
                status_code=400,
                content={
                    "text": "",
                    "error": "No file provided"
                }
            )
        
        # Read file contents into memory
        contents = await file.read()
        
        if not contents:
            return JSONResponse(
                status_code=400,
                content={
                    "text": "",
                    "error": "File is empty"
                }
            )
        
        # Convert to File Object . contents = raw binary bytes
        try:
            reader = PdfReader(io.BytesIO(contents))
        except Exception as e:
            logger.warning(f"Failed to parse PDF: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={
                    "text": "",
                    "error": "Invalid or corrupted PDF file"
                }
            )
        
        # Extract text from all pages . reader.pages = list of page objects
        text = ""
        for page_num, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
                text += page_text + "\n"
            except Exception as e:
                logger.warning(f"Failed to extract text from page {page_num + 1}: {str(e)}")
                continue
        
        # Check if text is empty or only whitespace
        if not text.strip():
            return JSONResponse(
                status_code=200,
                content={
                    "text": "",
                    "error": "No extractable text (scanned or invalid PDF)"
                }
            )

        if PDF_DEBUG_LOG:
            preview = " ".join(text.split())[:500]
            print(f"[PDF DEBUG] Extracted characters: {len(text.strip())}")
            print(f"[PDF DEBUG] Preview: {preview}")

        # Return success response
        return JSONResponse(
            status_code=200,
            content={
                "text": text.strip(),
                "error": None
            }
        )
    
    # Corrupt PDF,Parsing failure,Unexpected crash
    except Exception as e:
        logger.error(f"Unexpected error processing PDF: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "text": "",
                "error": f"Server error: {str(e)}"
            }
        )

# used for Checking server alive
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "ok"}


if __name__ == "__main__":
    import os
    import uvicorn
    PDF_DEBUG_LOG = os.getenv("PDF_DEBUG_LOG") == "1"
    print("[INFO] Starting PDF extraction service on http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)

