import os
import time
import fitz  # PyMuPDF
import chromadb
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings
from typing import List, Dict, Any, Tuple
import re
import numpy as np
from app.config import settings

# A lightweight TF-IDF-like embedding function for local offline mode
# This ensures that even without an API key, we have a functional local vector space
class LocalOfflineEmbeddingFunction(EmbeddingFunction):
    def __init__(self, vocab_size: int = 1536):
        self.vocab_size = vocab_size

    def __call__(self, input: Documents) -> Embeddings:
        embeddings = []
        for text in input:
            # Simple hash-based bag-of-words text vectorization (1536 dimensions)
            vec = np.zeros(self.vocab_size, dtype=np.float32)
            words = re.findall(r'\w+', text.lower())
            if words:
                for w in words:
                    # Deterministic hash to map words to index
                    idx = abs(hash(w)) % self.vocab_size
                    vec[idx] += 1.0
                # L2 Normalize
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
            embeddings.append(vec.tolist())
        return embeddings

# Multi-provider Embedding Function that delegates to OpenAI, Gemini, or local
class MultiProviderEmbeddingFunction(EmbeddingFunction):
    _gemini_api_failed = False

    def __init__(self):
        self.local_fn_1536 = LocalOfflineEmbeddingFunction(vocab_size=1536)
        self.local_fn_3072 = LocalOfflineEmbeddingFunction(vocab_size=3072)

    def __call__(self, input: Documents) -> Embeddings:
        # Check if we have API keys configured
        if settings.GEMINI_API_KEY:
            if MultiProviderEmbeddingFunction._gemini_api_failed:
                return self.local_fn_3072(input)
                
            try:
                from google import genai
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                
                # Split input documents into sub-batches of at most 90 documents (limit is 100)
                sub_batch_size = 90
                all_values = []
                
                for k in range(0, len(input), sub_batch_size):
                    batch_input = input[k:k+sub_batch_size]
                    
                    # Retry with exponential backoff for 429 rate limits
                    for attempt in range(6):
                        try:
                            response = client.models.embed_content(
                                model="gemini-embedding-001",
                                contents=batch_input
                            )
                            all_values.extend([emb.values for emb in response.embeddings])
                            break
                        except Exception as e:
                            err_str = str(e)
                            if ("429" in err_str or "RESOURCE_EXHAUSTED" in err_str) and attempt < 5:
                                sleep_time = (2 ** attempt) + 3
                                print(f"Gemini API Rate limit hit. Sleeping {sleep_time}s and retrying (attempt {attempt+1}/5)...")
                                time.sleep(sleep_time)
                            else:
                                raise e
                    
                    # Sleep slightly between sub-batches to respect rate limits
                    time.sleep(0.6)
                    
                return all_values
            except Exception as e:
                err_str = str(e)
                if "Quota exceeded" in err_str or "limit" in err_str or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "400" in err_str:
                    MultiProviderEmbeddingFunction._gemini_api_failed = True
                print(f"Gemini embedding failed, falling back to local 3072-dim embeddings: {e}")
                return self.local_fn_3072(input)
                
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=input
                )
                return [emb.embedding for emb in response.data]
            except Exception as e:
                print(f"OpenAI embedding failed, falling back to local 1536-dim embeddings: {e}")
                return self.local_fn_1536(input)

        # Fallback to offline vectorizer (1536 dimensions)
        return self.local_fn_1536(input)

class DocumentIndex:
    def __init__(self):
        # Create persistent client
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self.embedding_fn = MultiProviderEmbeddingFunction()
        
        # We separate collections by chunk-size for experimentation!
        # This will be very cool for comparing chunk size parameters
        self.collection_500 = self.chroma_client.get_or_create_collection(
            name="documents_chunk_500",
            embedding_function=self.embedding_fn
        )
        self.collection_1000 = self.chroma_client.get_or_create_collection(
            name="documents_chunk_1000",
            embedding_function=self.embedding_fn
        )

    def extract_text_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extracts text page by page from a PDF file using PyMuPDF.
        Returns a list of dicts: [{'page': 1, 'text': '...'}, ...]
        """
        doc_pages = []
        try:
            doc = fitz.open(pdf_path)
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text")  # "text" layout preserves structure better
                doc_pages.append({
                    "page": page_num + 1,
                    "text": text
                })
            doc.close()
        except Exception as e:
            print(f"Error reading PDF {pdf_path}: {e}")
        return doc_pages

    def chunk_text(self, pages: List[Dict[str, Any]], chunk_size: int = 500, chunk_overlap: int = 100) -> List[Dict[str, Any]]:
        """
        Chunks page text while maintaining references to original page numbers.
        """
        chunks = []
        for page_data in pages:
            page_num = page_data["page"]
            text = page_data["text"]
            
            # Simple token or character based splitter
            # Since character based is more reliable for raw text length:
            words = text.split()
            if not words:
                continue
                
            i = 0
            while i < len(words):
                chunk_words = words[i:i + chunk_size]
                chunk_text = " ".join(chunk_words)
                chunks.append({
                    "page": page_num,
                    "text": chunk_text
                })
                i += (chunk_size - chunk_overlap)
        return chunks

    def add_pdf(self, pdf_path: str, folder_id: str):
        """
        Parses a PDF file and indexes its chunks in the collection.
        """
        doc_name = os.path.basename(pdf_path)
        pages = self.extract_text_from_pdf(pdf_path)
        
        # 1. Index 500-chunk size
        chunks_500 = self.chunk_text(pages, chunk_size=300, chunk_overlap=50)
        self._index_chunks(self.collection_500, chunks_500, doc_name, folder_id)
        
        # 2. Index 1000-chunk size
        chunks_1000 = self.chunk_text(pages, chunk_size=800, chunk_overlap=100)
        self._index_chunks(self.collection_1000, chunks_1000, doc_name, folder_id)

    def _index_chunks(self, collection, chunks, doc_name: str, folder_id: str):
        if not chunks:
            return
            
        documents = []
        metadatas = []
        ids = []
        
        for idx, chunk in enumerate(chunks):
            # Clean text slightly
            cleaned_text = re.sub(r'\s+', ' ', chunk["text"]).strip()
            if not cleaned_text:
                continue
            documents.append(cleaned_text)
            metadatas.append({
                "document_name": doc_name,
                "folder_id": folder_id,
                "page": chunk["page"]
            })
            # Unique ID
            ids.append(f"{folder_id}_{doc_name}_chunk_{idx}_{collection.name}")
            
        # Add to collection in batches if very large
        batch_size = 90
        for i in range(0, len(documents), batch_size):
            collection.add(
                documents=documents[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size],
                ids=ids[i:i+batch_size]
            )

    def query(self, query_text: str, folder_id: str, limit: int = 5, chunk_size: int = 500) -> List[Dict[str, Any]]:
        """
        Performs vector search in the Chroma DB collection matching the given folder_id.
        """
        collection = self.collection_500 if chunk_size == 500 else self.collection_1000
        
        # Filter by folder
        where_filter = {"folder_id": folder_id}
        
        try:
            results = collection.query(
                query_texts=[query_text],
                n_results=limit,
                where=where_filter
            )
            
            formatted_results = []
            if results and results["documents"]:
                docs = results["documents"][0]
                metas = results["metadatas"][0]
                distances = results["distances"][0] if "distances" in results else [0.0]*len(docs)
                
                for d, m, dist in zip(docs, metas, distances):
                    # Score can be derived from distance (cosine similarity distance is 1 - similarity)
                    # Lower distance = higher similarity
                    score = 1.0 - dist if dist is not None else 0.5
                    formatted_results.append({
                        "document_name": m["document_name"],
                        "page": m["page"],
                        "text": d,
                        "score": float(score)
                    })
            return formatted_results
        except Exception as e:
            print(f"Error querying ChromaDB collection {collection.name}: {e}")
            return []

    def delete_by_document(self, doc_name: str, folder_id: str):
        """
        Deletes a document from all collections.
        """
        where_filter = {"$and": [{"document_name": doc_name}, {"folder_id": folder_id}]}
        try:
            self.collection_500.delete(where=where_filter)
            self.collection_1000.delete(where=where_filter)
        except Exception as e:
            print(f"Error deleting doc {doc_name} from collections: {e}")

# Global instance
doc_index = DocumentIndex()
