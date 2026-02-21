"""
S3 Storage Service for image uploads and management
"""
import boto3
import base64
import uuid
from typing import Optional, Tuple
from io import BytesIO
from PIL import Image
from botocore.exceptions import ClientError

from core.config import settings


class StorageService:
    """Manages image uploads to S3 and thumbnail generation"""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.images_bucket = settings.S3_BUCKET_IMAGES
        self.thumbnails_bucket = settings.S3_BUCKET_THUMBNAILS
    
    def upload_image(self, image_base64: str, memory_id: uuid.UUID) -> Tuple[str, str]:
        """
        Upload image to S3 and generate thumbnail
        
        Args:
            image_base64: Base64-encoded image data
            memory_id: UUID of the memory for filename
            
        Returns:
            Tuple of (image_url, thumbnail_url)
        """
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        
        # Determine format
        image_format = image.format or 'JPEG'
        extension = image_format.lower()
        if extension == 'jpeg':
            extension = 'jpg'
        
        # Upload original image
        image_key = f"memories/{memory_id}.{extension}"
        image_url = self._upload_to_s3(
            bucket=self.images_bucket,
            key=image_key,
            data=image_data,
            content_type=f"image/{extension}"
        )
        
        # Generate and upload thumbnail
        thumbnail_url = self._generate_and_upload_thumbnail(image, memory_id)
        
        return image_url, thumbnail_url
    
    def _upload_to_s3(self, bucket: str, key: str, data: bytes, content_type: str) -> str:
        """
        Upload data to S3 bucket
        
        Args:
            bucket: S3 bucket name
            key: Object key/path
            data: Raw bytes to upload
            content_type: MIME type
            
        Returns:
            Pre-signed URL of uploaded object (valid for 24 hours)
        """
        try:
            self.s3_client.put_object(
                Bucket=bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                CacheControl='max-age=31536000'  # 1 year cache
            )
            
            # Generate pre-signed URL (24 hours for Celery processing)
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=86400  # 24 hours
            )
            return url
            
        except ClientError as e:
            raise Exception(f"Failed to upload to S3: {str(e)}")
    
    def _generate_and_upload_thumbnail(self, image: Image.Image, memory_id: uuid.UUID) -> str:
        """
        Generate WebP thumbnail and upload to S3
        
        Args:
            image: PIL Image object
            memory_id: UUID for filename
            
        Returns:
            URL of uploaded thumbnail
        """
        # Calculate thumbnail dimensions (max 400px on longest side)
        max_size = 400
        ratio = min(max_size / image.width, max_size / image.height)
        new_size = (int(image.width * ratio), int(image.height * ratio))
        
        # Resize image
        thumbnail = image.copy()
        thumbnail.thumbnail(new_size, Image.Resampling.LANCZOS)
        
        # Convert to WebP with quality 85
        buffer = BytesIO()
        thumbnail.save(buffer, format='WEBP', quality=85)
        thumbnail_data = buffer.getvalue()
        
        # Upload thumbnail
        thumbnail_key = f"memories/{memory_id}.webp"
        thumbnail_url = self._upload_to_s3(
            bucket=self.thumbnails_bucket,
            key=thumbnail_key,
            data=thumbnail_data,
            content_type="image/webp"
        )
        
        return thumbnail_url
    
    def upload_face_thumbnail(self, face_image: Image.Image, person_id: uuid.UUID) -> str:
        """
        Upload a cropped face image to S3
        
        Args:
            face_image: PIL Image of the cropped face
            person_id: UUID of the person for filename
            
        Returns:
            Pre-signed URL of the uploaded face thumbnail
        """
        # Resize face to 200x200
        face_image = face_image.resize((200, 200), Image.Resampling.LANCZOS)
        
        # Convert to JPEG bytes
        buffer = BytesIO()
        if face_image.mode != 'RGB':
            face_image = face_image.convert('RGB')
        face_image.save(buffer, format='JPEG', quality=90)
        face_data = buffer.getvalue()
        
        # Upload to thumbnails bucket under faces/
        face_key = f"faces/{person_id}.jpg"
        face_url = self._upload_to_s3(
            bucket=self.thumbnails_bucket,
            key=face_key,
            data=face_data,
            content_type="image/jpeg"
        )
        
        return face_url

    def delete_image(self, memory_id: uuid.UUID, image_extension: str = "jpg"):
        """
        Delete image and thumbnail from S3
        
        Args:
            memory_id: UUID of the memory
            image_extension: File extension (jpg, png, etc.)
        """
        try:
            # Delete original image
            image_key = f"memories/{memory_id}.{image_extension}"
            self.s3_client.delete_object(Bucket=self.images_bucket, Key=image_key)
            
            # Delete thumbnail
            thumbnail_key = f"memories/{memory_id}.webp"
            self.s3_client.delete_object(Bucket=self.thumbnails_bucket, Key=thumbnail_key)
            
        except ClientError as e:
            # Log error but don't raise - deletion failures are non-critical
            print(f"Warning: Failed to delete S3 objects for memory {memory_id}: {str(e)}")
    
    def generate_presigned_url(self, bucket: str, key: str, expiration: int = 3600) -> str:
        """
        Generate presigned URL for temporary access
        
        Args:
            bucket: S3 bucket name
            key: Object key
            expiration: URL validity in seconds (default 1 hour)
            
        Returns:
            Presigned URL
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            raise Exception(f"Failed to generate presigned URL: {str(e)}")


# Singleton instance
storage_service = StorageService()
