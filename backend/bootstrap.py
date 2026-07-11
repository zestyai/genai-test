import os
import sys
import asyncio
from app.config import settings
from app.vector_db import doc_index
from app.database import db

async def bootstrap():
    print("Starting database bootstrapping...")
    
    # 1. Resolve path to artifacts/1
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    artifacts_dir = os.path.join(project_root, "artifacts", "1")
    
    if not os.path.exists(artifacts_dir):
        print(f"Artifacts directory not found at: {artifacts_dir}")
        print("Please run from the project root or verify paths.")
        sys.exit(1)
        
    print(f"Found artifacts directory at: {artifacts_dir}")
    
    # List files
    pdf_files = [f for f in os.listdir(artifacts_dir) if f.endswith(".pdf")]
    print(f"Discovered {len(pdf_files)} PDF files to index.")
    
    for idx, pdf in enumerate(pdf_files):
        pdf_path = os.path.join(artifacts_dir, pdf)
        print(f"[{idx+1}/{len(pdf_files)}] Indexing {pdf} into ChromaDB...")
        try:
            doc_index.add_pdf(pdf_path, folder_id="1")
            print(f"Successfully indexed {pdf}")
            
            # Record in MongoDB metadata if connection available
            try:
                size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
                await db.documents.update_one(
                    {"name": pdf, "folder": "artifacts/1"},
                    {"$set": {"is_indexed": True, "size_mb": round(size_mb, 2)}},
                    upsert=True
                )
            except Exception:
                pass # Fail silently if MongoDB offline
        except Exception as e:
            print(f"Failed to index {pdf}: {e}")
            
    print("Database indexing bootstrap complete!")

if __name__ == "__main__":
    # Run the bootstrap async loop
    asyncio.run(bootstrap())
