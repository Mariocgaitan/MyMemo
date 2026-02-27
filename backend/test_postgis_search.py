import asyncio
import sys
import os
sys.path.append('c:/Users/mario/Repositorios/MyMemo/backend')

from sqlalchemy import text
from core.database import async_session_maker

async def test_search():
    async with async_session_maker() as db:
        try:
            query = text("""
                SELECT id, coordinates
                FROM memories
                WHERE coordinates IS NOT NULL
                LIMIT 1
            """)
            res = await db.execute(query)
            row = res.fetchone()
            print("First memory coordinates:", row)
            
            nearby_query = text("""
                SELECT id, ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) as distance
                FROM memories
                WHERE coordinates IS NOT NULL
                AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius)
                LIMIT 5
            """)
            print("Running nearby query...")
            res2 = await db.execute(nearby_query, {"lon": -99.1332, "lat": 19.4326, "radius": 50000})
            rows = res2.fetchall()
            print("Nearby results:", rows)
        except Exception as e:
            print("Query Error:", str(e))

if __name__ == "__main__":
    asyncio.run(test_search())
