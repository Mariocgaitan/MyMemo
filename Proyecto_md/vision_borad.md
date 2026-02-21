# Project Specification: LifeLog AI (MVP)

## 1. Project Overview
**Role:** You are the Lead Full-Stack Developer & DevOps Engineer.
**Goal:** Build a Personal Geo-Spatial Memory System (PWA).
**Core Value:** A mobile-first web app to log daily experiences (photos, text, location) enriched by AI (Face Recognition & NLP).

## 2. Team Roles
* **User (Me):** Product Owner & Communicator.
* **Gemini:** Solutions Architect & Consultant (Logic/Strategy).
* **Claude (You):** Lead Developer (Implementation, Code, Deployment).

## 3. Tech Stack (Strict Requirement)
* **Frontend:** React (Vite) + TailwindCSS. Must be PWA compliant (Service Workers for offline capabilities).
* **Maps:** Leaflet.js + OpenStreetMap (No Google Maps API).
* **Backend:** Python FastAPI (Async).
* **Database:** PostgreSQL + PostGIS (Geolocation) + pgvector (Vector Embeddings).
* **Storage:** AWS S3 (for image files).
* **AI/ML:**
    * *Vision:* `face_recognition` (dlib) or `DeepFace` for embeddings.
    * *NLP:* OpenAI API (GPT-4o-mini) for structured data extraction.
* **Infrastructure:** Docker & Docker Compose (Local dev), ready for AWS EC2 deployment.

## 4. Key User Flows
1.  **Map View (Home):** User sees a global map with clustered pins of past memories.
2.  **Memory Creation (The "Check-in"):**
    * User clicks "Add Memory".
    * App captures GPS coordinates (High Accuracy).
    * User takes/uploads photo(s).
    * User inputs manual text (e.g., "Tacos at Orinoco, great vibes").
    * User manually inputs Location Name (No auto-complete API for now).
3.  **AI Processing (Background):**
    * System detects faces. If known (e.g., "Brau"), auto-tag. If unknown, allow user to label once (One-shot learning).
    * System processes text to extract JSON metadata (Sentiment, Tags, Price).

## 5. Constraints
* **Offline First:** The app must allow capturing a memory even without signal. Sync when online.
* **Privacy:** Single-user system initially.
* **Cost Efficiency:** Use WebP compression for images.