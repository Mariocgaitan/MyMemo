import requests

url = "http://localhost:8000/api/v1/memories/"
img_data = requests.get("https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200").content
files = {'image': ('test.jpg', img_data, 'image/jpeg')}
data = {
    'description_raw': 'Test memory',
    'latitude': 19.4326,
    'longitude': -99.1332,
    'location_name': 'Mexico',
    'visibility': 'private'
}

response = requests.post(url, files=files, data=data)
print("Response:", response.status_code, response.text)
