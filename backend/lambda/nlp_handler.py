"""
AWS Lambda Handler for NLP Extraction (SERVERLESS VERSION)

This handler is NOT used in the current Lightsail deployment.
It's prepared for future serverless migration.

To deploy:
1. Package this file with dependencies (openai, etc.)
2. Upload as Lambda layer or include in deployment package
3. Configure EventBridge or SQS trigger
4. Set environment variables (DATABASE_URL, OPENAI_API_KEY, etc.)
"""
import json
import os
from typing import Dict, Any

# This would be imported from Lambda layer
from services.nlp_service import nlp_service
from core.database import SyncSessionLocal
from models.database import ProcessingJob
from sqlalchemy import select
import uuid


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for NLP metadata extraction
    
    Event structure (from SQS or EventBridge):
    {
        "memory_id": "uuid-string",
        "user_id": "uuid-string",
        "attempt": 1
    }
    
    Args:
        event: Lambda event dict
        context: Lambda context object
        
    Returns:
        Response dict with statusCode and body
    """
    try:
        # Parse event
        if 'Records' in event:
            # From SQS
            body = json.loads(event['Records'][0]['body'])
            memory_id = body['memory_id']
        else:
            # Direct invocation or EventBridge
            memory_id = event['memory_id']
        
        print(f"Processing NLP extraction for memory: {memory_id}")
        
        # Process with service
        with SyncSessionLocal() as db:
            # Get job
            job = db.execute(
                select(ProcessingJob).where(
                    ProcessingJob.memory_id == uuid.UUID(memory_id),
                    ProcessingJob.job_type == "nlp_extraction"
                )
            ).scalar_one_or_none()
            
            # Run service
            result = nlp_service.extract_metadata(
                db=db,
                memory_id=memory_id,
                job=job
            )
            
            print(f"Result: {result}")
            
            return {
                'statusCode': 200,
                'body': json.dumps(result)
            }
    
    except Exception as e:
        print(f"Error processing NLP extraction: {str(e)}")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'memory_id': event.get('memory_id', 'unknown')
            })
        }


# For local testing
if __name__ == "__main__":
    test_event = {
        "memory_id": "your-test-uuid-here"
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
