import asyncio
from app.rag import query_rag_pipeline
from app.evaluator import run_experimentation_harness
from app.database import check_db_connection

async def main():
    print("=== VERIFYING RAG PIPELINE ===")
    
    # Question 1
    q1 = "List all rating plan rules"
    print(f"\nQuerying: '{q1}' (Vanilla)...")
    res1_v = query_rag_pipeline(q1, "../artifacts/1", variation="vanilla")
    print(f"Answer:\n{res1_v['answer'][:200]}...")
    
    print(f"\nQuerying: '{q1}' (Advanced)...")
    res1_a = query_rag_pipeline(q1, "../artifacts/1", variation="advanced")
    print(f"Answer:\n{res1_a['answer'][:400]}...")
    
    # Question 2
    q2 = "Using the Base Rate and the applicable Mandatory Hurricane Deductible Factor, calculate the unadjusted Hurricane premium for an HO3 policy with a $750,000 Coverage A limit located 3,000 feet from the coast in a Coastline Neighborhood."
    print(f"\nQuerying: '{q2}' (Vanilla)...")
    res2_v = query_rag_pipeline(q2, "../artifacts/1", variation="vanilla")
    print(f"Answer:\n{res2_v['answer']}")
    
    print(f"\nQuerying: '{q2}' (Advanced)...")
    res2_a = query_rag_pipeline(q2, "../artifacts/1", variation="advanced")
    print(f"Answer:\n{res2_a['answer']}")
    
    print("\n=== RUNNING EVALUATION HARNESS ===")
    # Seed db if offline fallback
    await check_db_connection()
    
    report = await run_experimentation_harness("artifacts/questions.csv")
    print("\nEvaluation Report Generated!")
    print(f"Run ID: {report['run_id']}")
    print(f"LLM Provider: {report['llm_provider']}")
    print(f"Vanilla Avg Score: {report['vanilla_avg_score']}")
    print(f"Vanilla Avg Latency: {report['vanilla_avg_latency']}s")
    print(f"Advanced Avg Score: {report['advanced_avg_score']}")
    print(f"Advanced Avg Latency: {report['advanced_avg_latency']}s")
    
    print("\nTest Case Outputs:")
    for tc in report["test_cases"]:
        print(f"\nID: {tc['id']}")
        print(f"Question: {tc['question'][:60]}...")
        print(f"Expected: {tc['expected_output'][:50]}...")
        print(f"Vanilla Score: {tc['vanilla_score']} | Advanced Score: {tc['advanced_score']}")

if __name__ == "__main__":
    asyncio.run(main())
