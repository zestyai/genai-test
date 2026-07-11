from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SettingsUpdate(BaseModel):
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    default_llm_provider: Optional[str] = None

class ConfigResponse(BaseModel):
    project_name: str
    is_mongodb_connected: bool
    default_llm_provider: str
    has_openai_key: bool
    has_gemini_key: bool
    has_anthropic_key: bool
    has_groq_key: bool

class QueryRequest(BaseModel):
    question: str
    folder: str = "artifacts/1"
    variation: str = "advanced"  # "vanilla" or "advanced"
    llm_provider: Optional[str] = None  # None for default or override

class SourceSnippet(BaseModel):
    document_name: str
    page: int
    text: str
    score: float

class QueryResponse(BaseModel):
    question: str
    answer: str
    variation: str
    llm_provider: str
    latency_seconds: float
    retrieved_sources: List[SourceSnippet]
    metadata: Dict[str, Any] = Field(default_factory=dict)

class EvalRequest(BaseModel):
    dataset_path: str = "artifacts/questions.csv"
    variations: List[str] = ["vanilla", "advanced"]
    llm_provider: Optional[str] = None

class EvalRunTestCase(BaseModel):
    id: str
    question: str
    expected_output: str
    vanilla_output: Optional[str] = None
    vanilla_score: Optional[float] = None
    vanilla_latency: Optional[float] = None
    advanced_output: Optional[str] = None
    advanced_score: Optional[float] = None
    advanced_latency: Optional[float] = None

class EvalRunReport(BaseModel):
    run_id: str
    timestamp: str
    llm_provider: str
    vanilla_avg_score: float
    vanilla_avg_latency: float
    advanced_avg_score: float
    advanced_avg_latency: float
    test_cases: List[EvalRunTestCase]
