"""Simple test to verify refactored code works"""
import sys
sys.path.insert(0, 'C:\\Users\\mario\\Repositorios\\MyMemo\\backend')

import requests

print("\n🧪 Testing Refactored Services...")
print("=" * 70)

# Create new memory
files = {'photo': open('C:\\Users\\mario\\Repositorios\\MyMemo\\backend\\tests\\Fotos\\WhatsApp Image 2026-02-19 at 12.06.58 PM.jpeg', 'rb')}
data = {
    'description': 'Quick test after refactor',
    'location_name': 'Test Location',
    'latitude': 19.4326,
    'longitude': -99.1332
}

print("\n1️⃣ Creating memory...")
r = requests.post('http://localhost:8000/api/v1/memories', files=files, data=data)
if r.status_code != 201:
    print(f"❌ Failed to create memory: {r.status_code}")
    print(r.text)
    sys.exit(1)

memory = r.json()
memory_id = memory['id']
print(f"✅ Memory created: {memory_id}")

# Wait for processing
print("\n2️⃣ Waiting 15 seconds for processing...")
import time
time.sleep(15)

# Check status
print("\n3️⃣ Checking results...")
r = requests.get(f'http://localhost:8000/api/v1/memories/{memory_id}/jobs')
jobs = r.json()

for job in jobs:
    status_emoji = "✅" if job['status'] == "completed" else "❌" if job['status'] == "failed" else "⏳"
    print(f"   {status_emoji} {job['job_type']}: {job['status']}")
    if job['error_message']:
        print(f"      Error: {job['error_message']}")

# Check metadata
r = requests.get(f'http://localhost:8000/api/v1/memories/{memory_id}')
memory = r.json()
ai_metadata = memory.get('ai_metadata', {})

has_nlp = 'nlp' in ai_metadata
has_faces = 'faces' in ai_metadata

print(f"\n4️⃣ AI Metadata:")
print(f"   {'✅' if has_nlp else '❌'} NLP extraction")
print(f"   {'✅' if has_faces else '❌'} Face recognition")

if has_nlp and has_faces:
    print("\n🎉 REFACTOR SUCCESSFUL! All services working!")
else:
    print("\n⚠️  Some services incomplete")

print("=" * 70)
