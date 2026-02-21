"""Check the results of the completed memory processing"""
import requests
import json

API_URL = "http://localhost:8000"
MEMORY_ID = "2c3748c8-1923-4497-bf3f-7f23532bbdd9"

print("\n" + "="*70)
print("🔍 MEMORY PROCESSING RESULTS")
print("="*70)

# Get memory details
response = requests.get(f"{API_URL}/api/v1/memories/{MEMORY_ID}")
memory = response.json()

print(f"\n📝 Memory: {MEMORY_ID}")
print(f"📸 Description: {memory['description_raw']}")
print(f"📍 Location: {memory['location_name']}")

# Print AI metadata
if memory.get('ai_metadata'):
    ai_data = memory['ai_metadata']
    
    # NLP Results
    if 'nlp' in ai_data:
        nlp = ai_data['nlp']
        print(f"\n🤖 NLP EXTRACTION:")
        print(f"   📌 Tags: {nlp.get('tags', [])}")
        print(f"   😊 Sentiment: {nlp.get('sentiment', 'N/A')}")
        print(f"   📄 Summary: {nlp.get('summary', 'N/A')}")
        print(f"   🎭 Activity: {nlp.get('activity', 'N/A')}")
        print(f"   🏷️  Themes: {nlp.get('themes', [])}")
    
    # Face Recognition Results
    if 'faces' in ai_data:
        faces = ai_data['faces']
        print(f"\n👤 FACE RECOGNITION:")
        print(f"   👥 Faces detected: {len(faces)}")
        for i, face in enumerate(faces, 1):
            print(f"   {i}. {face['name']} (confidence: {face['confidence']:.2%}, new: {face['is_new']})")

# Get all people
response = requests.get(f"{API_URL}/api/v1/people")
people = response.json()
print(f"\n👥 TOTAL PEOPLE IN DATABASE: {len(people)}")
for person in people:
    print(f"   - {person['name']} (detected {person['times_detected']} times)")

print("\n" + "="*70)
print("✅ BACKEND TESTING COMPLETE!")
print("="*70 + "\n")
