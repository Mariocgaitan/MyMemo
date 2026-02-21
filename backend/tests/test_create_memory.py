"""
Test script to create a memory with image upload
"""
import base64
import requests
import json
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000"
PHOTOS_DIR = Path(__file__).parent / "Fotos"
TEXT_FILE = Path(__file__).parent / "Texto" / "prueba.txt"
LOCATION_FILE = Path(__file__).parent / "Ubicacion" / "ubi.txt"

def read_text_file(filepath):
    """Read text from file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read().strip()

def read_location_file(filepath):
    """Read location coordinates from file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        coords = f.read().strip().split(',')
        return float(coords[0]), float(coords[1])

def image_to_base64(image_path):
    """Convert image to base64 string"""
    with open(image_path, 'rb') as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def create_memory(photo_name, description, latitude, longitude):
    """Create a memory via API"""
    
    # Read image
    photo_path = PHOTOS_DIR / photo_name
    print(f"\n📸 Processing: {photo_name}")
    print(f"   Size: {photo_path.stat().st_size / 1024:.2f} KB")
    
    # Convert to base64
    print("   Converting to base64...")
    base64_image = image_to_base64(photo_path)
    
    # Prepare payload
    payload = {
        "description_raw": description,
        "coordinates": {
            "latitude": latitude,
            "longitude": longitude
        },
        "image_base64": base64_image,
        "location_name": "Taquería de canasta, CDMX"
    }
    
    # Make API request
    print("   Uploading to API...")
    response = requests.post(
        f"{API_BASE_URL}/api/v1/memories",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    # Check response
    if response.status_code == 201:
        data = response.json()
        print(f"\n✅ Memory created successfully!")
        print(f"   Memory ID: {data['id']}")
        print(f"   Image URL: {data['image_url'][:80]}...")
        print(f"   Thumbnail URL: {data['thumbnail_url'][:80]}...")
        print(f"   Faces Processed: {data['faces_processed']}")
        print(f"   Description Processed: {data['description_processed']}")
        return data
    else:
        print(f"\n❌ Error creating memory:")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        return None

def main():
    """Main test function"""
    print("=" * 70)
    print("🚀 LifeLog AI - Backend Test")
    print("=" * 70)
    
    # Read test data
    description = read_text_file(TEXT_FILE)
    latitude, longitude = read_location_file(LOCATION_FILE)
    
    print(f"\n📝 Description: {description}")
    print(f"📍 Location: {latitude}, {longitude}")
    
    # Get all photos
    photos = sorted(PHOTOS_DIR.glob("*.jpeg"))
    print(f"\n📂 Found {len(photos)} photos")
    
    if not photos:
        print("❌ No photos found in Fotos directory!")
        return
    
    # Test with first photo
    print("\n" + "=" * 70)
    print("TEST 1: Creating memory with first photo (solo selfie)")
    print("=" * 70)
    
    result = create_memory(
        photos[0].name,
        description,
        latitude,
        longitude
    )
    
    if result:
        memory_id = result['id']
        
        # Wait a bit for Celery processing
        print("\n⏳ Waiting 10 seconds for Celery to process...")
        import time
        time.sleep(10)
        
        # Check processing status
        print("\n🔍 Checking processing status...")
        jobs_response = requests.get(f"{API_BASE_URL}/api/v1/memories/{memory_id}/jobs")
        
        if jobs_response.status_code == 200:
            jobs = jobs_response.json()
            print(f"\n📊 Processing Jobs:")
            for job in jobs:
                status_emoji = "✅" if job['status'] == 'completed' else "🔄" if job['status'] == 'processing' else "⏳"
                print(f"   {status_emoji} {job['job_type']}: {job['status']}")
        
        # Check detected people
        print("\n👥 Checking detected people...")
        people_response = requests.get(f"{API_BASE_URL}/api/v1/people")
        
        if people_response.status_code == 200:
            people_data = people_response.json()
            people = people_data['results']
            print(f"   Total people detected: {len(people)}")
            
            for person in people:
                print(f"   - {person['name']}: {person['face_count']} face(s)")
        
        # Check AI metadata
        print("\n🤖 Getting memory details with AI metadata...")
        memory_response = requests.get(f"{API_BASE_URL}/api/v1/memories/{memory_id}")
        
        if memory_response.status_code == 200:
            memory = memory_response.json()
            
            if memory.get('ai_metadata') and memory['ai_metadata'].get('nlp'):
                nlp = memory['ai_metadata']['nlp']
                print(f"\n   📊 NLP Extraction Results:")
                print(f"   - Tags: {', '.join(nlp.get('tags', []))}")
                print(f"   - Sentiment: {nlp.get('sentiment', 'N/A')}")
                print(f"   - Summary: {nlp.get('summary', 'N/A')}")
                print(f"   - Entities: {', '.join(nlp.get('entities', []))}")
        
        # Check usage/costs
        print("\n💰 Checking AI usage costs...")
        usage_response = requests.get(f"{API_BASE_URL}/api/v1/usage/summary")
        
        if usage_response.status_code == 200:
            usage = usage_response.json()
            print(f"   Total cost: ${usage['total_cost']:.4f}")
            print(f"   Total requests: {usage['total_requests']}")
            print(f"   Total tokens: {usage.get('total_tokens', 0)}")
        
        print("\n" + "=" * 70)
        print("✅ Test completed!")
        print("=" * 70)
        print(f"\n📝 Next steps:")
        print(f"   1. Check Swagger UI: http://localhost:8000/docs")
        print(f"   2. View memory: GET /api/v1/memories/{memory_id}")
        print(f"   3. Rename person: PATCH /api/v1/people/{{person_id}}")
        print(f"   4. Test with other 2 photos to see face matching!")

if __name__ == "__main__":
    main()
