# Psych Battery Status Report

## Recent Fixes & Investigations (June 7, 2026)

### 1. Assessment Engine API Payload Fix
- **Issue:** The engine was crashing when calling `api.submissions.create` due to passing the Assessment ID as a plain string.
- **Resolution:** Updated the payload in `AssessmentEngine.tsx` to `({ assessmentId: id })`, resolving the `400 Bad Request`.

### 2. Text Frame Clipping
- **Issue:** Text inside slides was occasionally getting cut off in the `AssessmentEngine` despite fitting well in the `AssessmentEditor`.
- **Resolution:** The engine was dynamically sizing to the full viewport, altering the `cqi` typography scaling. We wrapped the `SlideRenderer` in `AssessmentEngine` with the exact same `16/9` container constraints used in the editor.

### 3. "Number on Black Square" Overlay
- **Issue:** An overlaid number was appearing during the TAT module on blackout slides.
- **Resolution:** This was the circular `per-slide` countdown timer overlay. We removed this overlay from the Candidate view (`AssessmentEngine.tsx`) to prevent distraction during timed blackout modules.

### 4. TAT Module "Skipping"
- **Issue:** The engine appeared to completely skip the TAT module and proceed to WAT.
- **Investigation:**
  - Audited the sequence logic (`advanceToNextModule`, `handleNextSlide`).
  - Verified the database query returns all 28 TAT slides for the `mock-student` token payload.
  - Checked `setInterval` and `useAssessmentData` mappings; no programmatic branch bypasses the module autonomously.
- **Current Status:** Deployed deep diagnostic console logging to the Engine. The "skipping" impression may have been mitigated by the overlay/layout fixes. Deferred for further testing and log review if the issue persists.
