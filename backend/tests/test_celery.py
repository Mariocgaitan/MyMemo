"""
Test if we can manually trigger Celery tasks
"""
import requests

memory_id = "cc87c1c7-b38f-4b84-a124-503e274639e5"

print("Manual trigger test for memory:", memory_id)
print("=" * 70)

# Instead of testing the task directly, let's create a NEW memory
# and see if tasks get triggered

import base64
from pathlib import Path

# Read second photo
photos_dir = Path(__file__).parent / "Fotos"
photos = list(photos_dir.glob("*.jpeg"))
second_photo = photos[1] if len(photos) > 1 else photos[0]

print(f"\n1️⃣ Creating NEW memory with: {second_photo.name}")

with open(second_photo, 'rb') as f:
    base64_image = base64.b64encode(f.read()).decode('utf-8')

text_file = Path(__file__).parent / "Texto" / "prueba.txt"
with open(text_file, 'r', encoding='utf-8') as f:
    description = f.read().strip()

payload = {
    "description": f"{description} (Test #2)",
    "coordinates": {
        "latitude": 19.4368,
        "longitude": -99.1332
    },
    "image_base64": base64_image,
    "location_name": "Taquería de canasta, CDMX - Test 2"
}

response = requests.post("http://localhost:8000/api/v1/memories", json=payload)

if response.status_code == 201:
    memory = response.json()
    new_memory_id = memory['id']
    print(f"   ✅ Memory created: {new_memory_id}")
    
    # Wait a bit
    print("\n2️⃣ Waiting 15 seconds for Celery processing...")
    import time
    time.sleep(15)
    
    # Check jobs
    print("\n3️⃣ Checking processing status...")
    jobs_response = requests.get(f"http://localhost:8000/api/v1/memories/{new_memory_id}/jobs")
    
    if jobs_response.status_code == 200:
        jobs = jobs_response.json()
        for job in jobs:
            print(f"   - {job['job_type']}: {job['status']}")
    
    # Check Redis queue
    print("\n4️⃣ Checking Celery queue in Redis...")
    import subprocess
    result = subprocess.run(
        ["docker-compose", "exec", "-T", "redis", "redis-cli", "LLEN", "celery"],
        capture_output=True,
        text=True
    )
    queue_length = result.stdout.strip()
    print(f"   Queue length: {queue_length}")
    
else:
    print(f"   ❌ Error: {response.status_code}")
    print(response.json())
