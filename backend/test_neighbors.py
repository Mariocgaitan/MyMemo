import cv2
import numpy as np
from PIL import Image, ImageEnhance
import urllib.request
import io
import sys

def test_face_crop(image_url):
    print(f"Downloading {image_url}")
    req = urllib.request.Request(image_url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    image_bytes = response.read()
    
    pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pil_original = pil.copy()
    
    max_dimension = 1000
    ratio = 1.0
    if pil.width > max_dimension or pil.height > max_dimension:
        ratio = max(pil.width / max_dimension, pil.height / max_dimension)
        new_size = (int(pil.width / ratio), int(pil.height / ratio))
        pil = pil.resize(new_size, Image.Resampling.LANCZOS)
    
    pil = ImageEnhance.Contrast(pil).enhance(1.3)
    pil = ImageEnhance.Brightness(pil).enhance(1.05)
    
    image = np.array(pil)
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)
    
    for neighbors in [3, 4, 5, 6]:
        cv_faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=neighbors, minSize=(20, 20))
        print(f"minNeighbors={neighbors} -> found {len(cv_faces)} faces")

if __name__ == "__main__":
    test_face_crop("https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200")
