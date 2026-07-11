import os
import time
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

from app.config import settings
from app.database import db, check_db_connection, is_mongodb_connected
from app.models import SettingsUpdate, ConfigResponse, QueryRequest, QueryResponse, EvalRequest, EvalRunReport
from app.vector_db import doc_index
from app.rag import query_rag_pipeline
from app.evaluator import run_experimentation_harness

app = FastAPI(title=settings.PROJECT_NAME)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local testing, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Verify MongoDB connection status on startup
    await check_db_connection()

@app.get("/api/config", response_model=ConfigResponse)
async def get_config():
    # Check current DB connection status
    connected = await check_db_connection()
    return ConfigResponse(
        project_name=settings.PROJECT_NAME,
        is_mongodb_connected=connected,
        default_llm_provider=settings.DEFAULT_LLM_PROVIDER,
        has_openai_key=bool(settings.OPENAI_API_KEY),
        has_gemini_key=bool(settings.GEMINI_API_KEY),
        has_anthropic_key=bool(settings.ANTHROPIC_API_KEY)
    )

@app.post("/api/config", response_model=ConfigResponse)
async def update_config(update: SettingsUpdate):
    if update.openai_api_key is not None:
        settings.OPENAI_API_KEY = update.openai_api_key
        os.environ["OPENAI_API_KEY"] = update.openai_api_key
    if update.gemini_api_key is not None:
        settings.GEMINI_API_KEY = update.gemini_api_key
        os.environ["GEMINI_API_KEY"] = update.gemini_api_key
    if update.anthropic_api_key is not None:
        settings.ANTHROPIC_API_KEY = update.anthropic_api_key
        os.environ["ANTHROPIC_API_KEY"] = update.anthropic_api_key
    if update.default_llm_provider is not None:
        settings.DEFAULT_LLM_PROVIDER = update.default_llm_provider
        
    # Autodetect default LLM provider if set to auto/none
    if settings.DEFAULT_LLM_PROVIDER == "offline":
        if settings.GEMINI_API_KEY:
            settings.DEFAULT_LLM_PROVIDER = "gemini"
        elif settings.OPENAI_API_KEY:
            settings.DEFAULT_LLM_PROVIDER = "openai"
            
    connected = await check_db_connection()
    return ConfigResponse(
        project_name=settings.PROJECT_NAME,
        is_mongodb_connected=connected,
        default_llm_provider=settings.DEFAULT_LLM_PROVIDER,
        has_openai_key=bool(settings.OPENAI_API_KEY),
        has_gemini_key=bool(settings.GEMINI_API_KEY),
        has_anthropic_key=bool(settings.ANTHROPIC_API_KEY)
    )

@app.get("/api/documents")
async def list_documents(folder: str = "artifacts/1"):
    """
    Lists the PDF files in the specified artifacts folder.
    Also returns whether they are indexed in ChromaDB.
    """
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    folder_path = os.path.join(project_root, folder)
    
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Folder {folder} not found in project workspace")
        
    files = []
    for filename in os.listdir(folder_path):
        if filename.endswith(".pdf"):
            file_path = os.path.join(folder_path, filename)
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            
            # Simple check if indexed (using chroma ids containing document name)
            # We can check Chroma client documents metadata to see if it exists
            folder_id = os.path.basename(folder.rstrip("/"))
            is_indexed = False
            try:
                # Search ChromaDB count for this file to see if we indexed it
                # Collection.get returns results matching our query
                where_filter = {"$and": [{"document_name": filename}, {"folder_id": folder_id}]}
                counts = doc_index.collection_500.get(where=where_filter, limit=1)
                is_indexed = bool(counts and counts["ids"])
            except Exception:
                pass
                
            files.append({
                "name": filename,
                "size_mb": round(size_mb, 2),
                "is_indexed": is_indexed,
                "folder": folder
            })
            
    # Also save documents to MongoDB for listing states
    if files:
        try:
            for f in files:
                existing = await db.documents.find_one({"name": f["name"], "folder": f["folder"]})
                if existing:
                    await db.documents.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {"is_indexed": f["is_indexed"], "size_mb": f["size_mb"]}}
                    )
                else:
                    await db.documents.insert_one(f)
                    f.pop("_id", None)
        except Exception:
            pass # MongoDB offline fallback handled
            
    return files

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), folder: str = "artifacts/1"):
    import shutil
    try:
        filename = os.path.basename(file.filename)
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        dest_dir = os.path.join(project_root, "artifacts", "1")
        os.makedirs(dest_dir, exist_ok=True)
        dest_path = os.path.join(dest_dir, filename)
        
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        size_mb = os.path.getsize(dest_path) / (1024 * 1024)
        
        try:
            await db.documents.update_one(
                {"name": filename, "folder": folder},
                {"$set": {"is_indexed": False, "size_mb": round(size_mb, 2)}},
                upsert=True
            )
        except Exception:
            pass
            
        return {"status": "success", "filename": filename, "size_mb": round(size_mb, 2)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@app.post("/api/documents/index")
async def index_document(filename: str, folder: str = "artifacts/1"):
    """
    Extracts text and indexes the specific document in Chroma DB.
    """
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    file_path = os.path.join(project_root, folder, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Document {filename} not found")
        
    folder_id = os.path.basename(folder.rstrip("/"))
    
    try:
        # Index document
        doc_index.add_pdf(file_path, folder_id)
        
        # Update MongoDB
        try:
            await db.documents.update_one(
                {"name": filename, "folder": folder},
                {"$set": {"is_indexed": True}},
                upsert=True
            )
        except Exception:
            pass
            
        return {"status": "success", "message": f"Successfully indexed {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index PDF: {str(e)}")

@app.post("/api/query", response_model=QueryResponse)
async def query_rag(req: QueryRequest):
    """
    Asks a question about the PDF documents in a folder.
    """
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    folder_path = os.path.join(project_root, req.folder)
    
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Folder {req.folder} not found")
        
    try:
        res = query_rag_pipeline(
            question=req.question,
            folder_path=folder_path,
            variation=req.variation,
            provider=req.llm_provider
        )
        
        # Save to chat history in MongoDB
        try:
            chat_record = {
                "timestamp": time.time(),
                "question": req.question,
                "answer": res["answer"],
                "variation": req.variation,
                "llm_provider": res["llm_provider"],
                "latency_seconds": res["latency_seconds"]
            }
            await db.messages.insert_one(chat_record)
        except Exception:
            pass
            
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")

@app.post("/api/evaluations/run")
async def run_evaluation(req: EvalRequest):
    """
    Runs the experimentation harness batch evaluation on test cases.
    """
    try:
        report = await run_experimentation_harness(
            dataset_path=req.dataset_path,
            llm_provider=req.llm_provider
        )
        return report
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Evaluation run failed: {str(e)}")

@app.get("/api/evaluations/history")
async def get_evaluation_history():
    """
    Retrieves all past evaluation runs from MongoDB.
    """
    try:
        cursor = db.evaluation_runs.find()
        runs = await cursor.sort("timestamp", -1).to_list(length=100)
        # remove mongo _id for JSON serialization
        for r in runs:
            r.pop("_id", None)
        return runs
    except Exception:
        return []
