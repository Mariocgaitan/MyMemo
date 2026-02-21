# 🐛 Bug Report: Face Recognition Task Failing

**Date:** February 19, 2026  
**Status:** ❌ BLOCKING - Backend testing phase cannot complete

---

## 📋 Summary

Face recognition Celery task is failing with two errors:
1. **SQLAlchemy InterfaceError**: "cannot perform operation: another operation is in progress"
2. **UnboundLocalError**: Variable `job` referenced before assignment in exception handler

---

## 🔍 Current Environment

### Technology Stack
- **Python**: 3.12
- **Celery**: 5.6.2 with **threads pool** (concurrency=4)
- **SQLAlchemy**: 2.x with asyncpg for PostgreSQL
- **Database**: PostgreSQL 16 + PostGIS 3.4.3
- **Package Manager**: **uv** (NOT pip) ⚠️
- **Docker**: All services running in docker-compose

### Recent Changes
1. ✅ Fixed pkg_resources issue (downgraded setuptools 82.0.0 → 69.5.1)
2. ✅ Changed Celery pool from prefork → threads (to prevent worker crashes)
3. ✅ face_recognition library now imports successfully
4. ✅ NLP extraction task works perfectly in same environment

---

## ⚠️ The Problem

### Test Execution
```bash
cd backend/tests
python test_celery.py
```

### Result
```
✅ Memory created: db15ba2b-5fe2-469e-ac7b-2b17e07c8ac9
⏳ Waiting 15 seconds...
Status:
   - nlp_extraction: pending
   - face_recognition: failed  ❌
```

### Error Logs

**Error 1: SQLAlchemy InterfaceError**
```
sqlalchemy.exc.InterfaceError: (sqlalchemy.dialects.postgresql.asyncpg.InterfaceError) 
<class 'asyncpg.exceptions._base.InterfaceError'>: 
cannot perform operation: another operation is in progress

[SQL: SELECT memories.id, memories.user_id, memories.description_raw, 
       memories.location_name, ST_AsBinary(memories.coordinates) AS coordinates, 
       memories.image_url, memories.thumbnail_url, memories.ai_metadata, 
       memories.faces_processed, memories.visibility, memories.created_at, 
       memories.updated_at
FROM memories
WHERE memories.id = $1::UUID]
[parameters: (UUID('db15ba2b-5fe2-469e-ac7b-2b17e07c8ac9'),)]
```

**Error 2: UnboundLocalError**
```python
File "/app/tasks/face_recognition.py", line 198, in process_faces_async
    if job:
       ^^^
UnboundLocalError: cannot access local variable 'job' where it is not associated 
with a value
```

---

## 📁 Affected Files

### 1. `backend/tasks/face_recognition.py`

**Problem Location: Lines 30-220**

The async function `process_faces_async()` has these issues:

#### Issue A: Variable Scope Problem
```python
# Line 47: job is declared here inside try block
job_result = await db.execute(...)
job = job_result.scalar_one_or_none()

# Line 198: Referenced in exception handler (outside try scope)
except Exception as e:
    if job:  # ❌ UnboundLocalError if exception happens before line 47
        job.status = "failed"
```

**Root Cause**: If an exception occurs BEFORE line 47 (e.g., during Memory fetch), the variable `job` is never assigned, but the exception handler tries to reference it.

#### Issue B: SQLAlchemy Session in Celery Threads
```python
async with AsyncSessionLocal() as db:
    # Multiple await db.execute() calls
    # Problem: asyncpg connection state conflicts in thread pool?
```

**Context**: 
- Task decorated with `@celery_app.task(bind=True, max_retries=3)`
- Uses AsyncSessionLocal (async SQLAlchemy session)
- Running in Celery threads pool (4 workers)
- Same pattern works fine in `nlp_extraction.py` task

---

## 🔎 Code Analysis

### Current Function Structure

```python
@celery_app.task(bind=True, max_retries=3)
def process_face_recognition(self, memory_id: str):
    # Setup imports (pkg_resources fix applied, imports work)
    import face_recognition
    
    async def process_faces_async(task, memory_id):
        async with AsyncSessionLocal() as db:
            try:
                # 1. Fetch Memory (Lines 50-56)
                result = await db.execute(select(Memory).where(...))
                memory = result.scalar_one_or_none()
                
                # 2. Fetch ProcessingJob (Lines 58-64)
                job_result = await db.execute(select(ProcessingJob).where(...))
                job = job_result.scalar_one_or_none()  # <-- job assigned here
                
                # 3. Update job status
                if job:
                    job.status = "processing"
                    job.started_at = db.execute(select(func.now())).scalar()
                    await db.commit()
                
                # 4. Download image from S3
                response = requests.get(memory.image_url)
                
                # 5. Process faces with face_recognition library
                image = face_recognition.load_image_file(...)
                face_locations = face_recognition.face_locations(image)
                face_encodings = face_recognition.face_encodings(image, face_locations)
                
                # 6. Match faces with existing people
                # ... (lines 100-170)
                
                # 7. Update memory and job
                memory.faces_processed = True
                if job:
                    job.status = "completed"
                await db.commit()
                
            except Exception as e:
                # ❌ ERROR HERE: job might not be defined
                if job:  # Line 198
                    job.status = "failed"
                    job.error_message = str(e)
                    await db.commit()
                
                if task.request.retries < task.max_retries:
                    raise task.retry(exc=e, countdown=60)
    
    return asyncio.run(process_faces_async(self, memory_id))
```

---

## ✅ What Works (For Comparison)

### NLP Extraction Task (`backend/tasks/nlp_extraction.py`)

**Same pattern, but works perfectly:**
```python
@celery_app.task(bind=True, max_retries=3)
def process_nlp_extraction(self, memory_id: str):
    async def process_nlp_async(task, memory_id):
        async with AsyncSessionLocal() as db:
            try:
                # Fetch memory
                result = await db.execute(select(Memory).where(...))
                memory = result.scalar_one_or_none()
                
                # Fetch job
                job_result = await db.execute(select(ProcessingJob).where(...))
                job = job_result.scalar_one_or_none()
                
                # Call OpenAI API (synchronous)
                response = openai_client.chat.completions.create(...)
                
                # Update database
                await db.commit()
                
            except Exception as e:
                # Handle error (same pattern)
                if job:
                    job.status = "failed"
                await db.commit()
    
    return asyncio.run(process_nlp_async(self, memory_id))
```

**Key Difference**: NLP task calls synchronous OpenAI API, face recognition calls synchronous face_recognition library + sync requests.get() for S3 download. Both should work the same way.

---

## 🤔 Hypothesis

### Theory 1: Database Session State Conflict
The SQLAlchemy error "another operation is in progress" suggests:
- Multiple async operations on same connection?
- Connection pool exhaustion in threads?
- asyncpg not playing well with Celery threads?

### Theory 2: Code Bug (Variable Scope)
The `UnboundLocalError` is definitely a code bug:
- Need to initialize `job = None` before try block
- Or check if job is defined before referencing

### Theory 3: Resource Timing
- Face recognition downloads image from S3 (sync requests.get)
- Face recognition loads models (first time may be slow)
- Database connection might timeout or get recycled?

---

## 🛠️ Suggested Fixes

### Fix 1: Initialize job Variable (Quick Fix)
```python
async def process_faces_async(task, memory_id):
    job = None  # <-- Add this line
    
    async with AsyncSessionLocal() as db:
        try:
            # ... rest of code
```

### Fix 2: Use New Session for Error Handling
```python
except Exception as e:
    # Create new session for error handling
    async with AsyncSessionLocal() as error_db:
        job_result = await error_db.execute(
            select(ProcessingJob).where(...)
        )
        job = job_result.scalar_one_or_none()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            await error_db.commit()
```

### Fix 3: Check Database Session Configuration
```python
# In backend/core/database.py
# Verify async engine configuration for thread pool usage
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,      # Check this
    max_overflow=20,   # Check this
    pool_pre_ping=True # Enable connection health checks
)
```

---

## 📊 Test Data

### Memory Created
- **ID**: db15ba2b-5fe2-469e-ac7b-2b17e07c8ac9
- **Image**: WhatsApp Image 2026-02-19 at 12.06.58 PM.jpeg
- **S3 URL**: https://mymemo-images-prod-2026.s3.amazonaws.com/...
- **Description**: "En unos taquitos de canasta con ángel..."
- **GPS**: 19.4368, -99.1332 (CDMX)

### Docker Services Status
```bash
$ docker ps
lifelogs_backend      Up
lifelogs_db          healthy
lifelogs_redis       healthy  
lifelogs_celery      Up (threads pool, concurrency=4)
lifelogs_frontend    Up
```

---

## 🎯 Success Criteria

Face recognition task should:
1. ✅ Download image from S3
2. ✅ Detect faces using face_recognition library
3. ✅ Create Person records in database
4. ✅ Update ProcessingJob status to "completed"
5. ✅ Return face count and face locations

**Current**: Fails at database query stage with InterfaceError

---

## 📦 Dependencies

### Installed (verified working)
- ✅ face_recognition 1.3.0
- ✅ face_recognition_models (from GitHub)
- ✅ setuptools 69.5.1 (provides pkg_resources)
- ✅ dlib (compiled with BLAS support)
- ✅ All 4 model files present:
  - dlib_face_recognition_resnet_model_v1.dat (22MB)
  - mmod_human_face_detector.dat (729KB)
  - shape_predictor_5_face_landmarks.dat (9MB)
  - shape_predictor_68_face_landmarks.dat (99MB)

### Package Manager
**⚠️ IMPORTANT**: This project uses **uv**, NOT pip
```bash
# Correct way to install packages:
docker-compose exec celery_worker uv pip install <package>

# NOT:
docker-compose exec celery_worker pip install <package>
```

---

## 🔍 Debug Commands

```bash
# Check Celery worker logs
docker-compose logs celery_worker --tail 100

# Test face_recognition import
docker-compose exec celery_worker python -c "import face_recognition; print('OK')"

# Check database connections
docker-compose exec db psql -U lifelogs_user -d lifelogs_db -c "SELECT count(*) FROM pg_stat_activity;"

# Run test
cd backend/tests
python test_celery.py

# Check ProcessingJob records
docker-compose exec db psql -U lifelogs_user -d lifelogs_db -c "SELECT id, job_type, status, error_message FROM processing_jobs ORDER BY created_at DESC LIMIT 5;"
```

---

## 💡 Additional Context

### Why Threads Pool?
Originally used prefork pool (12 workers), but face_recognition library crashed workers:
```
WorkerLostError('Worker exited prematurely: exitcode 0')
```

Switched to threads pool (4 workers) which prevented crashes, but now hitting SQLAlchemy async issues.

### Alternative: Solo Pool?
Could try `--pool=solo` (single worker, no parallelism) to see if it's a concurrency issue.

---

## 🆘 Next Steps

1. **Fix the UnboundLocalError** - Initialize `job = None` before try block
2. **Fix the SQLAlchemy InterfaceError** - Investigate async session handling in threads
3. **Test with solo pool** - See if concurrency is the problem
4. **Consider sync tasks** - Maybe face_recognition should use sync database sessions?

---

**This bug is blocking the completion of backend testing. Once fixed, we can proceed to frontend development.**
