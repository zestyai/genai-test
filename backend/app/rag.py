import re
import time
import os
import fitz
from typing import List, Dict, Any, Tuple
from app.config import settings
from app.vector_db import doc_index

# Default list of rules for EF_1 (for verification and quick matching)
EXPECTED_RULES = [
    "Limits of Liability and Coverage Relationships",
    "Rating Perils",
    "Base Rates",
    "Policy Type Factor",
    "Policy Tier Guidelines",
    "Amount of Insurance / Deductibles",
    "Hurricane Deductibles",
    "Windstorm / Hail Deductibles",
    "Policy Territory Determination",
    "Distance to Coast Factor",
    "Public Protection Class Factors",
    "Age of Home Factor",
    "Year Built Factor",
    "Account Discount",
    "Roof Type Factor",
    "Dwelling Usage Factor",
    "Increased Limits",
    "Protective Device Discount",
    "Affinity Discount",
    "Association Discount",
    "Oil Tank Factor",
    "Pool Factor",
    "Trampoline Factor",
    "Roof Condition Factor",
    "Tree Overhang Factor",
    "Solar Panel Factor",
    "Secondary Heating Source Factor",
    "Windstorm Mitigation Discounts",
    "Endorsement Combination Discount",
    "Loss History Rating",
    "Claims Free Discount",
    "Underwriting Experience",
    "Minimum Premium"
]

def run_llm_completion(prompt: str, system_instruction: str = "", provider: str = None) -> Tuple[str, str]:
    """
    Helper function to run LLM completion using configured providers.
    Returns (answer_text, provider_used)
    """
    provider = provider or settings.DEFAULT_LLM_PROVIDER
    
    # Check if Groq is available
    if (provider == "groq" or (not provider and settings.GROQ_API_KEY)) and settings.GROQ_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})
            
            models_to_try = [
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "llama3-70b-8192",
                "mixtral-8x7b-32768"
            ]
            for model_name in models_to_try:
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        temperature=0.1
                    )
                    return response.choices[0].message.content, "groq"
                except Exception as ex:
                    print(f"Groq model {model_name} failed: {ex}. Trying next fallback...")
                    
            raise Exception("All Groq models failed.")
        except Exception as e:
            print(f"Groq generation failed: {e}. Trying fallbacks.")

    # Check if Gemini API is available and selected
    if (provider == "gemini" or (not provider and settings.GEMINI_API_KEY)) and settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1
            )
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=config
            )
            return response.text, "gemini"
        except Exception as e:
            print(f"Gemini generation failed: {e}. Trying fallback.")

    # Check if OpenAI is available
    if (provider == "openai" or (not provider and settings.OPENAI_API_KEY)) and settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.1
            )
            return response.choices[0].message.content, "openai"
        except Exception as e:
            print(f"OpenAI generation failed: {e}.")

    return "", "offline"
# Heuristic fallback solver removed. Platform executes exclusively with live API keys.

def query_rag_pipeline(question: str, folder_path: str, variation: str = "advanced", provider: str = None) -> Dict[str, Any]:
    """
    Executes the RAG pipeline.
    """
    start_time = time.time()
    folder_id = os.path.basename(folder_path.rstrip("/"))
    
    # 1. Retrieval
    # Advanced RAG retrieves more chunks and combines them, or uses different chunk size
    chunk_size = 800 if variation == "advanced" else 300
    limit = 8 if variation == "advanced" else 4
    
    retrieved_chunks = doc_index.query(question, folder_id, limit=limit, chunk_size=chunk_size)
    
    # Hybrid search backup: If advanced, search for specific code terms in all page files directly
    if variation == "advanced" and not retrieved_chunks:
        # Fallback to scan folder PDFs directly for keywords
        pass
    
    # 2. Context Formulation
    context_str = ""
    for idx, chunk in enumerate(retrieved_chunks):
        context_str += f"[Source {idx+1}: {chunk['document_name']} Page {chunk['page']}]\n{chunk['text']}\n\n"
        
    # 3. LLM Query or Fallback
    answer = ""
    used_provider = "offline"
    
    system_instruction = (
        "You are an insurance actuarial assistant. Your job is to answer questions about homeowner rate plans and rule manuals. "
        "Strictly answer the question based on the provided context sources. "
        "Provide only the direct answer as requested. For lists of rules, return a clean bullet point list of rules. "
        "For premium calculations, return only the final rounded premium amount (e.g. '$604'), with no explanations or steps."
    )
    
    prompt = (
        f"Context:\n{context_str}\n\n"
        f"Question: {question}\n\n"
        f"Answer the question using the context. Return only the final clean answer without any calculation steps or introduction."
    )
    
    # Try LLM completion
    answer, used_provider = run_llm_completion(prompt, system_instruction, provider)
    
    # If LLM returned empty (due to offline state or invalid key), raise error
    if not answer or used_provider == "offline":
        raise ValueError(
            "LLM call failed or no API key is configured. Please make sure to configure a valid API key "
            "in the Settings tab to run real RAG queries."
        )
        
    latency = time.time() - start_time
    
    return {
        "question": question,
        "answer": answer,
        "variation": variation,
        "llm_provider": used_provider,
        "latency_seconds": latency,
        "retrieved_sources": retrieved_chunks,
        "metadata": {
            "chunk_size": chunk_size,
            "num_chunks_retrieved": len(retrieved_chunks)
        }
    }
