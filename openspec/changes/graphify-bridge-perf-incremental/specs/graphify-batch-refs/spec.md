## ADDED Requirements

### Requirement: Batch reference creation

The system SHALL use `createReferences()` batch API instead of individual `createRelation()` calls for importing graph links.

#### Scenario: Batch refs import

- **WHEN** importing 2843 references
- **THEN** the system SHALL call `createReferences()` with batches of 100 references each, resulting in ~29 API calls instead of 2843

#### Scenario: Batch refs progress bar

- **WHEN** batch reference creation is in progress
- **THEN** the system SHALL display progress bar showing batch progress (e.g., "Refs [████░░░░] 40% (12/29 batches)")

#### Scenario: Batch API fallback

- **WHEN** `createReferences()` batch call fails with a non-retryable error
- **THEN** the system SHALL fall back to individual `createRelation()` calls for that batch

### Requirement: Progress bar adaptation

The existing 3-phase progress bar SHALL adapt to both full and incremental import modes.

#### Scenario: Full import progress

- **WHEN** running full import
- **THEN** progress bar SHALL show all 3 phases (Entities/Atoms/Refs) with total counts from graph.json

#### Scenario: Incremental import progress

- **WHEN** running incremental import with only 30 changed atoms and 80 changed refs
- **THEN** progress bar SHALL show only the changed items, not the full graph totals
