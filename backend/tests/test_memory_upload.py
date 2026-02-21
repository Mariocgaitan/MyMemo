"""
Script to test memory creation with real image
"""
import requests
import base64
import json
from pathlib import Path

# API configuration
API_URL = "http://localhost:8000/api/v1"
USER_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"  # Default user from init_db.py

def encode_image_to_base64(image_path: str) -> str:
    """Convert image to base64 string"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def create_memory(image_path: str, description: str, latitude: float, longitude: float, location_name: str):
    """Create a memory via API"""
    
    print(f"📸 Encoding image: {image_path}")
    image_base64 = encode_image_to_base64(image_path)
    print(f"✅ Image encoded: {len(image_base64)} characters")
    
    # Prepare payload
    payload = {
        "user_id": USER_ID,
        "description_raw": description,
        "location_name": location_name,
        "coordinates": {
            "latitude": latitude,
            "longitude": longitude
        },
        "image_base64": image_base64
    }
    
    print(f"\n🚀 Creating memory...")
    print(f"📝 Description: {description[:50]}...")
    print(f"📍 Location: {location_name} ({latitude}, {longitude})")
    
    # Make request
    response = requests.post(
        f"{API_URL}/memories",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Memory created successfully!")
        print(f"🆔 Memory ID: {data['id']}")
        print(f"🖼️  Image URL: {data.get('image_url', 'N/A')[:80]}...")
        print(f"🔄 Faces Processed: {data.get('faces_processed', False)}")
        print(f"🔄 NLP Processed: {data.get('nlp_processed', False)}")
        return data
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)
        return None

def check_processing_jobs(memory_id: str):
    """Check processing job status"""
    print(f"\n🔍 Checking processing jobs for memory {memory_id}...")
    response = requests.get(f"{API_URL}/memories/{memory_id}/jobs")
    
    if response.status_code == 200:
        jobs = response.json()
        print(f"📊 Found {len(jobs)} processing jobs:")
        for job in jobs:
            print(f"  - {job['job_type']}: {job['status']}")
        return jobs
    else:
        print(f"❌ Error checking jobs: {response.status_code}")
        return []

def get_detected_people():
    """Get all detected people"""
    print(f"\n👥 Fetching detected people...")
    response = requests.get(f"{API_URL}/people")
    
    if response.status_code == 200:
        data = response.json()
        people = data.get('people', [])
        print(f"✅ Found {len(people)} people:")
        for person in people:
            print(f"  - {person['name']} (ID: {person['id']}, Faces: {person['face_count']})")
        return people
    else:
        print(f"❌ Error: {response.status_code}")
        return []

def get_memory_details(memory_id: str):
    """Get detailed memory information"""
    print(f"\n📖 Fetching memory details...")
    response = requests.get(f"{API_URL}/memories/{memory_id}")
    
    if response.status_code == 200:
        memory = response.json()
        print(f"✅ Memory Details:")
        print(f"  - Description: {memory['description_raw']}")
        print(f"  - Location: {memory['location_name']}")
        print(f"  - Faces Processed: {memory['faces_processed']}")
        print(f"  - NLP Processed: {memory['nlp_processed']}")
        
        if memory.get('ai_metadata'):
            print(f"\n🤖 AI Metadata:")
            ai_data = memory['ai_metadata']
            if 'nlp' in ai_data:
                nlp = ai_data['nlp']
                print(f"  - Tags: {', '.join(nlp.get('tags', []))}")
                print(f"  - Sentiment: {nlp.get('sentiment', 'N/A')}")
                print(f"  - Summary: {nlp.get('summary', 'N/A')}")
        
        if memory.get('people_in_memory'):
            print(f"\n👥 People in this memory ({len(memory['people_in_memory'])}):")
            for person_link in memory['people_in_memory']:
                person = person_link['person']
                print(f"  - {person['name']} (Confidence: {person_link.get('confidence', 'N/A')})")
        
        return memory
    else:
        print(f"❌ Error: {response.status_code}")
        return None

if __name__ == "__main__":
    # Read configuration
    tests_dir = Path(__file__).parent
    
    # Image paths
    image1 = tests_dir / "Fotos" / "WhatsApp Image 2026-02-19 at 12.04.43 PM.jpeg"
    
    # Read text and location
    with open(tests_dir / "Texto" / "prueba.txt", "r", encoding="utf-8") as f:
        description = f.read().strip()
    
    with open(tests_dir / "Ubicacion" / "ubi.txt", "r") as f:
        coords = f.read().strip().split(",")
        latitude = float(coords[0])
        longitude = float(coords[1])
    
    print("="*60)
    print("🧪 LifeLog AI - Backend Testing")
    print("="*60)
    
    # Test 1: Create memory with first image (solo)
    print(f"\n📝 TEST 1: Creating memory with first image")
    memory = create_memory(
        image_path=str(image1),
        description=description,
        latitude=latitude,
        longitude=longitude,
        location_name="Taquería de canasta, CDMX"
    )
    
    if memory:
        memory_id = memory['id']
        
        # Wait a bit for Celery processing
        import time
        print("\n⏳ Waiting 15 seconds for Celery to process...")
        time.sleep(15)
        
        # Check jobs
        check_processing_jobs(memory_id)
        
        # Get updated memory details
        get_memory_details(memory_id)
        
        # Get detected people
        get_detected_people()
        
        print("\n" + "="*60)
        print("✅ Test completed!")
        print(f"🔗 View in Swagger: http://localhost:8000/docs#/memories/get_memory_api_v1_memories__memory_id__get")
        print("="*60)
