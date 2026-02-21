"""
NLP Extraction Service - Pure business logic (serverless-ready)

This module contains portable NLP metadata extraction logic
that can be used by Celery tasks, Lambda functions, or any other orchestrator.
"""
import uuid
import json
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import select

from models.database import Memory, ProcessingJob, UsageMetric
from sqlalchemy.orm.attributes import flag_modified
from core.config import settings


class NLPExtractionService:
    """Service for NLP metadata extraction using OpenAI"""
    
    def __init__(self):
        """Initialize NLP service (OpenAI client created lazily)"""
        self._client = None
    
    @property
    def client(self) -> OpenAI:
        """Lazy initialization of OpenAI client"""
        if self._client is None:
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client
    
    def extract_metadata(
        self,
        db: Session,
        memory_id: str,
        job: Optional[ProcessingJob] = None
    ) -> Dict[str, Any]:
        """
        Extract metadata from memory description using OpenAI
        
        Args:
            db: Database session
            memory_id: UUID of the memory to process
            job: Optional processing job for status tracking
            
        Returns:
            Result dict with extracted metadata, cost, and status
            
        Raises:
            json.JSONDecodeError: If OpenAI response is not valid JSON
            Exception: If extraction fails
        """
        try:
            # Get memory
            memory = db.execute(
                select(Memory).where(Memory.id == uuid.UUID(memory_id))
            ).scalar_one_or_none()
            
            if not memory:
                return {"error": f"Memory {memory_id} not found"}
            
            # Update job status if provided
            if job:
                job.status = "processing"
                job.started_at = datetime.now(timezone.utc)
                db.commit()
            
            # Prepare prompt for OpenAI
            prompt = self._build_extraction_prompt(memory)
            
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a metadata extraction assistant. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,  # Low temperature for consistent extraction
                max_tokens=500
            )
            
            # Parse response
            extracted_metadata = self._parse_openai_response(response)
            
            # Update memory metadata
            db.refresh(memory)  # Get latest version to avoid overwriting face recognition data
            if not memory.ai_metadata:
                memory.ai_metadata = {}
            
            memory.ai_metadata.update({
                "nlp": extracted_metadata,
                "nlp_processed_at": datetime.now(timezone.utc).isoformat()
            })
            flag_modified(memory, "ai_metadata")
            
            # Calculate and record cost
            total_cost = self._record_usage(db, memory, response)
            
            # Update job status
            if job:
                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc)
            
            db.commit()
            
            return {
                "memory_id": memory_id,
                "extracted_metadata": extracted_metadata,
                "tokens_used": response.usage.prompt_tokens + response.usage.completion_tokens,
                "cost_usd": round(total_cost, 6),
                "status": "completed"
            }
            
        except json.JSONDecodeError as e:
            error_msg = f"Failed to parse OpenAI response as JSON: {str(e)}"
            
            if job:
                job.status = "failed"
                job.error_message = error_msg
                job.attempts += 1
                db.commit()
            
            raise json.JSONDecodeError(error_msg, e.doc, e.pos)
            
        except Exception as e:
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.attempts += 1
                db.commit()
            
            raise e
    
    def _build_extraction_prompt(self, memory: Memory) -> str:
        """Build extraction prompt for OpenAI"""
        return f"""Analyze the following personal memory description and extract structured metadata.

Memory Description: "{memory.description_raw}"
Location: {memory.location_name}

Extract the following information in JSON format:
1. tags: Array of relevant tags/keywords (max 10)
2. entities: Array of named entities (people, places, organizations)
3. sentiment: One of "positive", "neutral", "negative"
4. summary: A brief 1-sentence summary
5. themes: Array of main themes (e.g., "family", "travel", "work")
6. time_of_day: Inferred time if mentioned (e.g., "morning", "afternoon", "evening", "night", null if unknown)
7. weather: Weather if mentioned (null if unknown)
8. activity: Main activity described (e.g., "hiking", "dinner", "celebration")

Return ONLY valid JSON, no markdown or extra text."""
    
    def _parse_openai_response(self, response) -> Dict[str, Any]:
        """Parse and clean OpenAI response"""
        extracted_text = response.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        if extracted_text.startswith("```json"):
            extracted_text = extracted_text[7:]
        if extracted_text.startswith("```"):
            extracted_text = extracted_text[3:]
        if extracted_text.endswith("```"):
            extracted_text = extracted_text[:-3]
        
        return json.loads(extracted_text.strip())
    
    def _record_usage(self, db: Session, memory: Memory, response) -> float:
        """Record usage metrics and calculate cost"""
        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        
        # Pricing: $0.150 per 1M input tokens, $0.600 per 1M output tokens
        input_cost = (input_tokens / 1_000_000) * 0.150
        output_cost = (output_tokens / 1_000_000) * 0.600
        total_cost = input_cost + output_cost
        
        # Record usage metric
        usage_metric = UsageMetric(
            id=uuid.uuid4(),
            user_id=memory.user_id,
            metric_type="openai_nlp_extraction",
            metric_value=1.0,
            cost_usd=total_cost,
            extra_data={
                "model": "gpt-4o-mini",
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "memory_id": str(memory.id)
            }
        )
        db.add(usage_metric)
        
        return total_cost


# Singleton instance
nlp_service = NLPExtractionService()
