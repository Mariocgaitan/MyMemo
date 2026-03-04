import cv2
import face_recognition
import numpy as np
from PIL import Image, ImageEnhance
import urllib.request
import io
import sys

# Test function mimicking face_service.py
def test_face_crop(image_url):
    print(f"Downloading test image from {image_url}")
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
    print(f"Original size: {pil_original.size}, Shrunk size: {pil.size}, Ratio: {ratio}")
    
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)
    
    cv_faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=6, minSize=(20, 20))
    print(f"OpenCV found {len(cv_faces)} faces on small image.")
    
    face_locations = [
        (int((y) * ratio), int((x + w) * ratio), int((y + h) * ratio), int((x) * ratio))
        for (x, y, w, h) in cv_faces
    ]
    
    for idx, (top, right, bottom, left) in enumerate(face_locations):
        print(f"Face {idx} bounds in original: Top:{top} Right:{right} Bottom:{bottom} Left:{left}")
        
        # Test crop on Original just like backend does
        pad_x = int((right - left) * 0.3)
        pad_y = int((bottom - top) * 0.3)
        crop_left   = max(0, left - pad_x)
        crop_top    = max(0, top - pad_y)
        crop_right  = min(pil_original.width, right + pad_x)
        crop_bottom = min(pil_original.height, bottom + pad_y)
        
        face_crop = pil_original.crop((crop_left, crop_top, crop_right, crop_bottom))
        face_crop.save(f"test_crop_{idx}.jpg")
        print(f"Saved test_crop_{idx}.jpg with size {face_crop.size}")

if __name__ == "__main__":
    # Small test image of people
    test_face_crop("https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200")
