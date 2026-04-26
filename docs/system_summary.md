# System Summary — Local IndexedDB Interview Analytics

## Why IndexedDB is used
- IndexedDB provides fast local storage inside the browser.
- It enables offline analytics and leaderboard support without waiting for round-trip Firestore queries.
- Local storage is perfect for user-specific attempt history and comparison data.

## Why grouping by interviewId
- `interviewId` is computed from the interview form values: role + language.
- This grouping ensures repeated attempts for the same role/language landing in the same analytics bucket.
- Example groups: `frontend_en_default`, `backend_hi_default`.

## Why no overwrite model
- Every interview run is a unique attempt and should be preserved.
- Storing every attempt enables comparison across multiple sessions.
- No overwrite guarantees historical accuracy and visible improvement trends.

## Why comparison exists for 2+ attempts
- Two attempts allow direct side-by-side performance comparison.
- Three or more attempts enable ranking and trend analysis.
- This helps users see progress, best/worst sessions, and score averages.

## What the new layer does
- Firestore remains the source of truth for feedback generation.
- IndexedDB becomes the analytics cache layer.
- UI can display a local leaderboard and comparison view without additional Firestore reads.
- The system supports 1+ local attempts, comparison, and filtered analytics.
