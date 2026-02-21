"""
Check processing status of the created memory
"""
import requests
import json

memory_id = "cc87c1c7-b38f-4b84-a124-503e274639e5"

print(f"Checking status for memory: {memory_id}\n")
print("=" * 70)

# Check processing jobs
print("\n1️⃣ Processing Jobs Status:")
print("-" * 70)
response = requests.get(f"http://localhost:8000/api/v1/memories/{memory_id}/jobs")
if response.status_code == 200:
    jobs = response.json()
    for job in jobs:
        print(f"\n   Job Type: {job['job_type']}")
        print(f"   Status: {job['status']}")
        print(f"   Created: {job['created_at']}")
        if job.get('started_at'):
            print(f"   Started: {job['started_at']}")
        if job.get('completed_at'):
            print(f"   Completed: {job['completed_at']}")
        if job.get('error_message'):
            print(f"   Error: {job['error_message']}")
else:
    print(f"   Error: {response.status_code}")

# Check memory details
print("\n2️⃣ Memory Details:")
print("-" * 70)
response = requests.get(f"http://localhost:8000/api/v1/memories/{memory_id}")
if response.status_code == 200:
    memory = response.json()
    print(f"   Faces Processed: {memory['faces_processed']}")
    print(f"   AI Metadata: {json.dumps(memory.get('ai_metadata', {}), indent=6)}")
else:
    print(f"   Error: {response.status_code}")

# Check detected people
print("\n3️⃣ Detected People:")
print("-" * 70)
response = requests.get("http://localhost:8000/api/v1/people")
if response.status_code == 200:
    data = response.json()
    people = data['results']
    print(f"   Total people: {len(people)}")
    for person in people:
        print(f"\n   - ID: {person['id']}")
        print(f"     Name: {person['name']}")
        print(f"     Face count: {person['face_count']}")
        print(f"     First seen: {person['first_seen_at']}")
else:
    print(f"   Error: {response.status_code}")

# Check AI usage costs
print("\n4️⃣ AI Usage & Costs:")
print("-" * 70)
response = requests.get("http://localhost:8000/api/v1/usage/summary")
if response.status_code == 200:
    usage = response.json()
    print(f"   Total requests: {usage['total_requests']}")
    print(f"   Total cost: ${usage['total_cost']:.4f}")
    if usage.get('total_tokens'):
        print(f"   Total tokens: {usage['total_tokens']}")
else:
    print(f"   Error: {response.status_code}")

print("\n" + "=" * 70)
