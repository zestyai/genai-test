import csv
import os
import time
import re
from datetime import datetime
import uuid
import difflib
from typing import List, Dict, Any
from app.config import settings
from app.database import db
from app.rag import query_rag_pipeline

def compute_similarity_score(expected: str, generated: str) -> float:
    """
    Computes a text similarity score between expected and generated answers.
    Returns a score between 0.0 and 1.0.
    """
    exp_clean = expected.strip().lower()
    gen_clean = generated.strip().lower()
    
    # 1. Exact Match Check (especially for numerical answers like "$604" vs "604" or "604.0")
    # Clean non-alphanumeric characters
    exp_digits = "".join(re.findall(r'\d+', exp_clean))
    gen_digits = "".join(re.findall(r'\d+', gen_clean))
    
    if exp_digits and gen_digits:
        if exp_digits == gen_digits:
            return 1.0
        # If it's a short numeric code (e.g. 604) and is explicitly mentioned as a word in the generated text
        if len(exp_digits) > 0 and len(exp_digits) < 5:
            if re.search(r'\b' + re.escape(exp_digits) + r'\b', gen_clean) or exp_clean in gen_clean:
                return 1.0
        
    # 2. SequenceMatcher similarity
    seq = difflib.SequenceMatcher(None, exp_clean, gen_clean)
    similarity = seq.ratio()
    
    # 3. Rule matching for EF_1 (list of rules)
    # Check what fraction of expected bullet points are found in generated text
    if "*" in expected or "\n" in expected:
        expected_items = [line.replace("*", "").strip().lower() for line in expected.split("\n") if line.strip()]
        if expected_items:
            found_count = sum(1 for item in expected_items if item in gen_clean)
            item_score = found_count / len(expected_items)
            # Combine SequenceMatcher and item match score
            similarity = max(similarity, item_score)
            
    return round(similarity, 4)

async def run_experimentation_harness(dataset_path: str = "artifacts/questions.csv", llm_provider: str = None) -> Dict[str, Any]:
    """
    Runs the experimentation harness over the CSV dataset.
    Compares vanilla vs advanced RAG pipelines.
    Saves the results to MongoDB.
    """
    run_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    # Resolve absolute path to the dataset
    # By default, questions.csv is in the workspace artifacts folder
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    csv_path = os.path.join(project_root, dataset_path)
    
    if not os.path.exists(csv_path):
        # Fallback to local search in artifacts
        csv_path = os.path.join(project_root, "artifacts", "questions.csv")
        
    test_cases = []
    
    try:
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Expected keys: id, question, expected_output, PDF Folder
                test_cases.append({
                    "id": row.get("id", ""),
                    "question": row.get("question", ""),
                    "expected_output": row.get("expected_output", ""),
                    "pdf_folder": row.get("PDF Folder", "")
                })
    except Exception as e:
        print(f"Error reading CSV {csv_path}: {e}")
        # Default fallback test cases if csv is missing
        test_cases = [
            {
                "id": "EF_1",
                "question": "List all rating plan rules",
                "expected_output": "* Limits of Liability and Coverage Relationships\n* Rating Perils...",
                "pdf_folder": "1"
            },
            {
                "id": "EF_2",
                "question": "Using the Base Rate and the applicable Mandatory Hurricane Deductible Factor, calculate the unadjusted Hurricane premium...",
                "expected_output": "$604",
                "pdf_folder": "1"
            }
        ]

    eval_test_cases = []
    vanilla_scores = []
    vanilla_latencies = []
    advanced_scores = []
    advanced_latencies = []
    
    provider_used = llm_provider or settings.DEFAULT_LLM_PROVIDER
    
    for tc in test_cases:
        q_id = tc["id"]
        question = tc["question"]
        expected = tc["expected_output"]
        pdf_folder_name = tc["pdf_folder"]
        
        # Build path to folder
        folder_path = os.path.join(project_root, "artifacts", pdf_folder_name)
        
        # 1. Run Vanilla RAG
        vanilla_res = query_rag_pipeline(question, folder_path, variation="vanilla", provider=provider_used)
        v_out = vanilla_res["answer"]
        v_lat = vanilla_res["latency_seconds"]
        v_score = compute_similarity_score(expected, v_out)
        
        # 2. Run Advanced RAG
        advanced_res = query_rag_pipeline(question, folder_path, variation="advanced", provider=provider_used)
        a_out = advanced_res["answer"]
        a_lat = advanced_res["latency_seconds"]
        a_score = compute_similarity_score(expected, a_out)
        
        # Track metrics
        vanilla_scores.append(v_score)
        vanilla_latencies.append(v_lat)
        advanced_scores.append(a_score)
        advanced_latencies.append(a_lat)
        
        eval_test_cases.append({
            "id": q_id,
            "question": question,
            "expected_output": expected,
            "vanilla_output": v_out,
            "vanilla_score": v_score,
            "vanilla_latency": v_lat,
            "advanced_output": a_out,
            "advanced_score": a_score,
            "advanced_latency": a_lat
        })
        
        # Update provider if actual API ran
        if vanilla_res["llm_provider"] != "offline":
            provider_used = vanilla_res["llm_provider"]

    vanilla_avg_score = sum(vanilla_scores) / len(vanilla_scores) if vanilla_scores else 0.0
    vanilla_avg_latency = sum(vanilla_latencies) / len(vanilla_latencies) if vanilla_latencies else 0.0
    advanced_avg_score = sum(advanced_scores) / len(advanced_scores) if advanced_scores else 0.0
    advanced_avg_latency = sum(advanced_latencies) / len(advanced_latencies) if advanced_latencies else 0.0
    
    report = {
        "run_id": run_id,
        "timestamp": timestamp,
        "llm_provider": provider_used,
        "vanilla_avg_score": float(round(vanilla_avg_score, 4)),
        "vanilla_avg_latency": float(round(vanilla_avg_latency, 4)),
        "advanced_avg_score": float(round(advanced_avg_score, 4)),
        "advanced_avg_latency": float(round(advanced_avg_latency, 4)),
        "test_cases": eval_test_cases
    }
    
    # Save to MongoDB
    await db.evaluation_runs.insert_one(report)
    
    # Remove _id so it doesn't fail FastAPI serialization
    report.pop("_id", None)
    
    return report
