## ADDED Requirements

### Requirement: Recursively scan subdirectories

The system SHALL recursively scan all subdirectories under lib/, including websocket/, precompute/, and any future subdirectories.

#### Scenario: Scan websocket/ subdirectory

- **WHEN** scanning lib/websocket/
- **THEN** it SHALL find all 6 files: reliable-client.js, state-manager.js, heartbeat.js, ack-manager.js, diff-subscription.js, index.js

#### Scenario: Scan precompute/ subdirectory

- **WHEN** scanning lib/precompute/
- **THEN** it SHALL find all 3 files: client.js, batch-processor.js, fingerprint-cache.js, index.js

#### Scenario: Handle nested directories

- **WHEN** encountering nested directories (e.g., lib/a/b/c/)
- **THEN** it SHALL recursively scan all levels and include all files

### Requirement: Configure exclusion patterns

The system SHALL support exclusion patterns to skip test files, node_modules, and other non-production code.

#### Scenario: Exclude test files

- **WHEN** configuring exclusion patterns
- **THEN** it SHALL exclude **/\*.test.js, **/\*.spec.js, tests/**, **tests**/**

#### Scenario: Exclude node_modules

- **WHEN** configuring exclusion patterns
- **THEN** it SHALL exclude node_modules/**, .git/**, .opencode/\*\*

#### Scenario: Exclude build artifacts

- **WHEN** configuring exclusion patterns
- **THEN** it SHALL exclude dist/**, build/**, coverage/\*\*

### Requirement: Generate subdirectory coverage report

The system SHALL generate a coverage report showing which subdirectories are covered and which are missing.

#### Scenario: Report subdirectory coverage

- **WHEN** the scan is complete
- **THEN** it SHALL output: lib/websocket/ 6/6 files (100%), lib/precompute/ 4/4 files (100%)

#### Scenario: Identify missing subdirectories

- **WHEN** a subdirectory exists but has 0 coverage
- **THEN** it SHALL flag it as missing and require explanation

#### Scenario: Track new subdirectories

- **WHEN** a new subdirectory is added to the codebase
- **THEN** the coverage report SHALL detect it and ensure it's included
