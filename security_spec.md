# Security Specification - SSB Psychological Assessment Platform

## Data Invariants
1. A submission must belong to a valid user and a valid assessment.
2. A student can only have one active submission per assessment at a time.
3. Accessors can only evaluate submissions assigned to them (unless they are admin).
4. Timestamps (createdAt, startedAt, updatedAt) must be server-validated.
5. User roles are immutable by the user themselves.

## The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Spoofing**: Attempting to create a user profile with a different UID.
2. **Role Escalation**: Student attempting to set their role to 'admin' or 'assessor'.
3. **Shadow Field update**: Adding a hidden `isVerified: true` field to a submission.
4. **Orphaned Submission**: Creating a submission for a non-existent assessment.
5. **Unauthorized Read**: Student trying to read another student's submission.
6. **Unauthorized Evaluation**: Student trying to set their own score or remarks.
7. **Cross-Assessor Leak**: Assessor trying to read a submission they aren't assigned to.
8. **Resource Poisoning**: Injecting a 1MB string into a slide word or instruction.
9. **Timestamp Manipulation**: Sending a client-side date for `startedAt`.
10. **Admin Bypass**: Student attempting to write to the `/admins/` collection.
11. **Slide Tampering**: Student trying to modify Assessment slides.
12. **Premature Evaluation**: Assessor trying to complete an evaluation before files are uploaded.

## Test Runner (Conceptual)
Tests will verify that all operations violating the above invariants or using the dirty payloads are rejected with PERMISSION_DENIED.
