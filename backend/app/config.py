import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "PDF QA RAG Evaluation Platform"
    
    # MongoDB Config
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "pdf_qa_rag"
    
    # Vector DB Config
    CHROMA_PERSIST_DIR: str = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "chroma_db")
    )
    
    # LLM Keys
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    
    # Default LLM Provider (openai, gemini, anthropic, groq, or offline)
    DEFAULT_LLM_PROVIDER: str = "groq"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
