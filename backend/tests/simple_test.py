"""
Simple test to create memory and see validation errors
"""
import base64
import requests
import json
from pathlib import Path

# Read test data
photos_dir = Path(__file__).parent / "Fotos"
photos = list(photos_dir.glob("*.jpeg"))
first_photo = photos[0]

print(f"Reading: {first_photo.name}")
print(f"Size: {first_photo.stat().st_size:,} bytes")

# Convert to base64
with open(first_photo, 'rb') as f:
    base64_image = base64.b64encode(f.read()).decode('utf-8')

print(f"Base64 length: {len(base64_image):,} characters")

# Read description
text_file = Path(__file__).parent / "Texto" / "prueba.txt"
with open(text_file, 'r', encoding='utf-8') as f:
    description = f.read().strip()

print(f"Description: {description[:50]}...")

# Prepare payload
payload = {
    "description": description,  # Changed from description_raw to description
    "coordinates": {
        "latitude": 19.4368,
        "longitude": -99.1332
    },
    "image_base64": base64_image, 
    "location_name": "Taquería de canasta, CDMX"
}

print("\nSending POST request to http://localhost:8000/api/v1/memories...")

# Make request
response = requests.post(
    "http://localhost:8000/api/v1/memories",
    json=payload
)

print(f"\nStatus Code: {response.status_code}")
print(f"Response:")
print(json.dumps(response.json(), indent=2))
