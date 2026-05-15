## ADDED Requirements

### Requirement: Concurrent atom batch creation

The system SHALL support concurrent execution of atom batch creation requests to the backend.

#### Scenario: Concurrent batch with concurrency=2

- **WHEN** importing a large number of atoms (e.g. 2000+) with concurrency=2 and BATCH_SIZE=100
- **THEN** the system SHALL execute 2 batch requests simultaneously, completing in roughly half the time of serial execution

#### Scenario: Backend timeout during concurrent batch

- **WHEN** a concurrent batch request times out (HTTP 408 or connection timeout)
- **THEN** the system SHALL retry that batch once with serial execution and log a warning

### Requirement: Dynamic concurrency probing

The system SHALL probe backend concurrency capability on first batch to determine safe concurrency level.

#### Scenario: Probe succeeds with concurrency=2

- **WHEN** the first 3 atom batches all succeed with concurrent execution
- **THEN** the system SHALL continue with concurrency=2 for remaining batches

#### Scenario: Probe fails, fallback to serial

- **WHEN** any of the first 3 concurrent atom batches fails or times out
- **THEN** the system SHALL fall back to serial execution (concurrency=1) for all remaining batches and log a warning

### Requirement: HTTP connection reuse

The system SHALL reuse HTTP connections via Keep-Alive for all backend API calls, using `undici.Agent` + `setGlobalDispatcher()` (Node.js native fetch does not support `node:http.Agent`).

#### Scenario: Connection reuse during import

- **WHEN** the import process makes a large number of API calls to the backend
- **THEN** the HTTP client SHALL reuse TCP connections instead of creating new connections for each request

#### Scenario: Connection cleanup

- **WHEN** import process completes
- **THEN** the HTTP client SHALL allow the Keep-Alive connections to expire naturally (no explicit destroy needed)
