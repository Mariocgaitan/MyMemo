"""
Application Configuration
Loads settings from environment variables
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    """
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str
    
    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_IMAGES: str = "lifelogs-images-prod"
    S3_BUCKET_THUMBNAILS: str = "lifelogs-thumbnails-prod"
    S3_BUCKET_BACKUPS: str = "lifelogs-backups"
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_MAX_TOKENS: int = 500
    
    # Face Recognition
    FACE_RECOGNITION_TOLERANCE: float = 0.6
    FACE_RECOGNITION_MODEL: str = "hog"  # hog or cnn
    
    # Cost Management
    MONTHLY_BUDGET_USD: float = 50.0
    ALERT_THRESHOLD_PERCENTAGE: int = 80
    
    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Application
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_VERSION: str = "v1"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    MEMORY_CREATION_LIMIT_PER_HOUR: int = 10
    MEMORY_CREATION_LIMIT_PER_DAY: int = 50
    
    # Image Processing
    MAX_IMAGE_SIZE_MB: int = 10
    THUMBNAIL_SIZE: int = 400
    IMAGE_QUALITY: int = 85
    
    @property
    def origins_list(self) -> List[str]:
        """Get ALLOWED_ORIGINS as a list"""
        if isinstance(self.ALLOWED_ORIGINS, str):
            return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(',')]
        return self.ALLOWED_ORIGINS
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


# Global settings instance
settings = Settings()
