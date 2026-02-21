"""
Database initialization script
Creates all tables and extensions
"""

import asyncio
from sqlalchemy import text
from core.database import engine, Base
from models.database import User, Memory, Person, MemoryPerson, ProcessingJob, UsageMetric, MemoryVersion


async def init_db():
    """
    Initialize database:
    1. Verify extensions are installed
    2. Create all tables
    3. Create default user (for MVP single-user mode)
    """
    
    async with engine.begin() as conn:
        print("🔍 Verifying PostgreSQL extensions...")
        
        # Check extensions
        result = await conn.execute(
            text("SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'pg_trgm', 'uuid-ossp')")
        )
        extensions = result.fetchall()
        
        for ext_name, ext_version in extensions:
            print(f"  ✅ {ext_name} v{ext_version}")
        
        if len(extensions) < 3:
            print("  ⚠️  Some extensions are missing. Expected: postgis, pg_trgm, uuid-ossp")
            print("  Run the init-extensions.sql script manually if needed.")
        
        print("\n📊 Creating database tables...")
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        print("  ✅ All tables created successfully")
        
        # Create full-text search index on memories description
        print("\n🔍 Creating full-text search index...")
        await conn.execute(
            text("""
                CREATE INDEX IF NOT EXISTS idx_memories_description_fts 
                ON memories 
                USING GIN(to_tsvector('english', description_raw))
            """)
        )
        print("  ✅ Full-text search index created")
        
        # Create default user for MVP
        print("\n👤 Creating default user...")
        result = await conn.execute(
            text("SELECT COUNT(*) FROM users")
        )
        user_count = result.scalar()
        
        if user_count == 0:
            await conn.execute(
                text("""
                    INSERT INTO users (id, email, created_at, updated_at)
                    VALUES (gen_random_uuid(), 'default@lifelogs.local', NOW(), NOW())
                """)
            )
            print("  ✅ Default user created")
        else:
            print(f"  ℹ️  Users already exist ({user_count} users)")
        
        await conn.commit()
    
    print("\n✨ Database initialization complete!")
    print("\n📋 Summary:")
    
    async with engine.connect() as conn:
        # Count tables
        result = await conn.execute(
            text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
        )
        tables = result.fetchall()
        
        print(f"  📦 Tables: {len(tables)}")
        for table in tables:
            print(f"     - {table[0]}")


async def drop_all_tables():
    """
    Drop all tables (use with caution!)
    """
    print("⚠️  Dropping all tables...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    print("  ✅ All tables dropped")


if __name__ == "__main__":
    print("=" * 60)
    print("  LifeLog AI - Database Initialization")
    print("=" * 60)
    print()
    
    # Run initialization
    asyncio.run(init_db())
    
    print("\n" + "=" * 60)
    print("  Database is ready! 🚀")
    print("=" * 60)
