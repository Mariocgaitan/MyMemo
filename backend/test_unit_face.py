import asyncio
import uuid
import sys
import os

sys.path.append("/app")
from core.database import async_session_maker
from models.database import Memory
from sqlalchemy import select
from services.face_service import face_service

async def run_test():
    async_session = async_session_maker()
    async with async_session() as db:
        result = await db.execute(select(Memory).limit(1))
        memory = result.scalar_one_or_none()
        
        if not memory:
            print("No memories in DB to test.")
            return

        print(f"Testing face_service on Memory ID: {memory.id}")
        
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        
        db_url = os.getenv("DATABASE_URL", "postgresql://lifelogs_user:lifelogs_pass@db:5432/lifelogs_db")
        if "postgresql+asyncpg" in db_url:
            db_url = db_url.replace("postgresql+asyncpg", "postgresql")
            
        engine = create_engine(db_url)
        SyncSession = sessionmaker(bind=engine)
        
        with SyncSession() as sync_db:
            try:
                result = face_service.detect_and_recognize_faces(sync_db, memory.id)
                print("Face recognition completed!")
                print("Result:", result)
            except Exception as e:
                import traceback
                print("FAILED!")
                traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
