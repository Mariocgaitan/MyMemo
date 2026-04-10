# MyTravelMemo - Product and Technical Strategy (Pre-Implementation)

## 1. Product Definition

MyTravelMemo is a public discovery layer on top of MyMemo.

Goal:
- Let users publish selected memories to a public marketplace of places.
- Keep private life data in MyMemo private by default.
- Create a recommendation system now, leaving promotions/monetization explicitly pending for a later stage.

Core principle:
- MyMemo = private journal.
- MyTravelMemo = optional public snapshots of place experiences.

## 2. Scope of Public Content

Public by design (only if user chooses to share):
- cover_photo
- short_description
- place_name (Google Place)
- place_coordinates
- visit_date (coarse, optional: month/year)
- emotion_summary (optional, derived)
- rating (optional, simple 1-5)

Never public from private memory:
- detected_faces
- people identities
- private tags/categories
- raw ai_metadata internals
- exact private timeline
- private comments or hidden fields

Default behavior:
- share_to_world = false (opt-in)

## 3. UX Strategy (New Full Tab / New Environment)

MyTravelMemo should feel like a different product surface inside the app.

Navigation:
- New root tab: MyTravelMemo.
- Separate layout style (brand variant) but same auth session.

Primary UX model (hybrid):
- Default: feed-first with place cards and filters.
- Secondary: map mode toggle for geographic exploration.

Experience rule (confirmed):
- The product experience must feel natural and community-first.
- Promotions/sponsors are not part of the default primary journey.
- Promotions will live in a separate section users can open intentionally.

Reason:
- Feed is better for ranking, monetization, and mobile consumption.
- Map is better for spatial intent and nearby discovery.

Main screens:
1. Discover Feed
- Personalized cards.
- Place chips (food, sports, parks, coffee, nightlife, etc.).

2. Map Explore
- Pins by place clusters.
- Tap cluster -> place drawer with public memories.
- Tap memory -> public detail page.

3. Place Detail
- Public memories for that place.
- Sentiment distribution summary.

4. Promotions (separate section)
- Explicit user entry (not forced in feed flow).
- Sponsored places/campaigns with clear label.
- No interruption of main discovery UX.

5. Share Flow (from MyMemo memory detail)
- Toggle: "Share in MyTravelMemo".
- Privacy preview before publish.
- Public description is the same as private description (no separate edit).

## 4. Data Model (Conceptual)

New entities:
1. public_memories
- id
- source_memory_id
- user_id
- place_id (Google Place ID)
- public_photo_url
- public_description
- public_visibility_status (active, hidden, moderated)
- moderation_status (pending, approved, rejected)
- created_at

2. places_catalog
- place_id
- name
- lat
- lng
- types
- city
- country

3. place_promotions (future stage, not in current implementation)
- id
- place_id
- sponsor_id
- campaign_type
- start_at
- end_at
- budget
- status

4. recommendation_events
- user_id
- event_type (view, click, save, visit_intent, hide)
- place_id
- public_memory_id
- timestamp

## 5. Recommendation System Strategy

Recommendation should be staged, not one-shot.

Phase 1: rule-based + profile vectors
- Build user preference profile from private MyMemo behavior.
- Signals:
  - place types visited
  - activity hints from descriptions
  - time-of-day patterns
  - sentiment by place type
- Candidate generation:
  - nearby places
  - trending places in city
  - places similar to user historical preferences

Phase 2: learning-to-rank
- Inputs:
  - user-place affinity
  - popularity quality signals
  - freshness
  - distance
  - sentiment compatibility
- Output:
  - ranked list with diversity constraints.

Phase 3: monetization ranking layer
- Sponsored candidates injected with strict caps:
  - max % of feed positions
  - min relevance threshold
  - explicit sponsorship label

Cold start handling:
- New user: ask interests quickly (3-5 chips).
- New place: use place type + geo + early engagement priors.

## 6. Moderation and Trust Strategy

Need two independent pipelines:

Text moderation:
- Allow negative reviews and strong opinions.
- Block hate speech, harassment, threats, sexual violence, doxxing, extremist promotion.
- No political or religious content in MyTravelMemo (laico scope).
- No propaganda content.

Image moderation:
- Detect nudity/sexual explicit content.
- Detect violent/gore content.
- Detect minors + explicit risk patterns.

Enforcement model:
1. Pre-publish checks
- fast auto filter
- if high risk: hold for review

2. Post-publish safety
- user reporting tools
- re-review queue
- strike system for repeated violations

Moderation outcomes:
- approve
- soft-hide + appeal
- reject + policy reason
- account-level sanctions for repeated abuse

## 7. Privacy and Legal Baseline

Must-have controls:
- Clear consent when sharing publicly.
- Ability to unpublish anytime.
- Data retention and deletion policy.
- Terms for public content license.
- Sponsored content transparency label.

Regional/legal checks:
- privacy law compliance by target market.
- copyright claims handling.
- right-to-be-forgotten workflow.

## 8. Monetization Model (Deferred)

Primary:
- promoted places
- sponsored campaigns (days/specials/coupons)

Product timing (confirmed):
- Monetization is future-stage.
- Initial focus is user growth and recommendation quality.
- All monetization implementation is explicitly deferred (no coding in current stage).

Rules:
- ads must be relevant to user interests and location context.
- never hide sponsorship label.
- avoid over-saturation of promoted content.

KPI base:
- CTR on recommendations
- visit intent actions
- place conversion events
- ad revenue per active user
- retention impact vs non-sponsored experience

## 9. Rollout Plan (Execution)

Stage A - Foundation
- public memory schema
- share toggle from private memory
- basic public feed

Stage B - Discovery
- map explore mode
- place detail pages
- reporting and moderation v1

Stage C - Personalization
- recommendation v1 rule-based
- interaction telemetry

Stage D - Monetization (deferred)
- sponsored placements
- campaign management basics

Stage E - Optimization
- ranking improvements
- anti-abuse hardening
- creator/business analytics

## 10. Critical Decisions to Close Before Coding

Resolved decisions (locked):
- 1 = Yes (share default off)
- 2 = No (public description does not diverge)
- 3 = Yes (multiple public memories allowed for same place/day)
- 4 = Read-only public posts in v1
- 5 = Hate/discrimination blocked; strong negative opinion allowed
- 6 = Political/religious content not allowed in MyTravelMemo
- 7 = Human review SLA: best-effort in MVP
- 8 = Appeals handled manually by admin (best-effort in MVP)
- 9 = Objective priority: relevance + exploration
- 10 = Sponsored cap: 10 per 20 feed items (for future sponsored mode)
- 11 = Radius defaults adapt by city density
- 12 = Recency decay: soft
- 16 = Public fields copied: photo, location, description, emotion
- 17 = Coarse date only
- 18 = Anonymous public profile
- 19 = Hard delete in public when source memory is deleted

Open decisions (pending close):
- none

Deferred decisions (not blocking current coding phase):
- 13 = Business onboarding mode (manual vs self-serve)
- 14 = Billing model (CPM/CPC/CPA/hybrid)
- 15 = Minimum quality requirements for promoted places

Product rules:
1. Is share default strictly off for all users?
2. Is public description editable independently from private description?
3. Can user post multiple public memories for same place/day?
4. Will comments exist in v1, or read-only public posts?

Safety rules:
5. Exact hate speech policy scope and language coverage.
6. What political/religious content is allowed vs blocked?
7. Human review SLA for flagged content.
8. Appeals process and who resolves it.

Recommendation rules:
9. What is the first objective: relevance, exploration, or monetization?
10. Max sponsored slots per 20 feed items.
11. Geographic radius defaults by city density.
12. Whether to include recency decay and how strong.

Definition note:
- Recency decay = older interactions/posts progressively lose ranking weight over time so newer behavior has more influence.

Business rules:
13. Self-serve ads for businesses or manual onboarding first?
14. Billing model: CPM, CPC, CPA, or hybrid.
15. Minimum quality requirements before a place can advertise.

Definition note:
- Business rules here means the operational rules for who can advertise, how campaigns are created, and which billing/quality controls apply.

Data/privacy rules:
16. Which exact fields are copied from private memory to public memory.
17. Whether to store exact visit timestamp or coarse date only.
18. Public profile exposure level (anonymous alias vs handle).
19. Hard delete behavior when user deletes source memory.

## 11. Suggested MVP Definition (Strict)

MVP includes:
- share toggle + privacy preview
- public feed
- map mode
- place detail
- recommendation v1 (rule-based)
- text/image moderation basic

MVP excludes:
- comments
- social graph
- active monetization flows
- promotions/sponsored modules
- advanced ad bidding
- full business portal
- fully ML-trained ranking model
- any revenue-generation implementation in this coding phase

---

## 12. Implementation Reference

Full coding blueprint is in: `MYTRAVELMEMO_CODING_PLAN.md`

That document contains:
- Strategic assessment of limits and opportunities
- Identity layer design (how to make it feel personal, not a review site)
- Database schema (SQL for 5 new tables + ALTER on memories)
- Backend file structure (new files + minimal extensions to existing files)
- All API endpoints with signatures
- Phase 1 recommendation algorithm (formula + weights)
- Moderation pipeline design (free OpenAI Moderation API + vision)
- Frontend component tree
- All MyMemo ↔ TravelMemo connection points
- Security boundaries
- Execution order by stage (A → D)
- What NOT to build in MVP
- Risk register

## 13. Delivery Split: Must-have V1 vs Post-V1

Must-have V1 (release quality):
- Share toggle from Memory Detail with privacy preview
- Public memory projection with strict privacy boundary (no faces/no private tags/no exact timeline)
- Discover feed + map mode + place detail
- Recommendation v1 rule-based (relevance + exploration)
- Moderation v1 (text + image), SLA best-effort, manual appeal resolution by admin
- Recency decay set to soft
- Basic trust/context signals (emotion-first card language)
- Save place action as lightweight interaction
- Observability and safety checks for public endpoints

Post-V1 (deferred):
- Any monetization/revenue module
- Promotions/sponsored placements in product surfaces
- Business onboarding and billing model
- Advanced ad ranking/bidding
- Full business portal
- ML-trained ranking model (phase 2+)
- Social graph features (comments/follow/replies)
