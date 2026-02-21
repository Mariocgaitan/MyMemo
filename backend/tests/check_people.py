"""Check memory-people relationships"""
import requests

API_URL = "http://localhost:8000"
MEMORY_ID = "fd4b76e6-8e4d-48d8-9e87-dd430305f8d5"

print("\n👥 CHECKING MEMORY-PEOPLE RELATIONSHIPS")
print("="*70)

# Get people
response = requests.get(f"{API_URL}/api/v1/people")
people = response.json()

print(f"\n📊 Total people: {len(people)}")

for person in people:
    person_id = person['id']
    name = person['name']
    times = person['times_detected']
    
    # Get memories for this person
    response = requests.get(f"{API_URL}/api/v1/people/{person_id}/memories")
    memories = response.json()
    
    print(f"\n👤 {name} (ID: {person_id[:8]}...)")
    print(f"   Times detected: {times}")
    print(f"   Memories: {len(memories)}")
    
    for mem in memories:
        is_our_memory = "⭐" if mem['id'] == MEMORY_ID else "  "
        print(f"   {is_our_memory} - {mem['description_raw'][:50]}...")

print("\n" + "="*70 + "\n")
