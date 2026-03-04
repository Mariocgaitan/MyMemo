import sys
sys.path.append("/app")
from PIL import Image
import uuid
import traceback
from services.storage_service import storage_service

def test_s3_upload():
    print("Creating RGB test face crop...")
    img = Image.new('RGB', (150, 150), color='green')
    test_id = uuid.uuid4()
    
    try:
        print(f"Uploading to S3 with id {test_id}...")
        result = storage_service.upload_face_thumbnail(img, test_id)
        print(f"Success! S3 Key returned: {result}")
        
    except Exception as e:
        print("Upload failed!")
        traceback.print_exc()

if __name__ == "__main__":
    test_s3_upload()
