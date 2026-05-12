## ADDED Requirements

### Requirement: Validate file-level coverage

The system SHALL validate that all production files are covered by code_module entities.

#### Scenario: Calculate file coverage percentage

- **WHEN** validation runs
- **THEN** it SHALL calculate: (covered files / total files) \* 100%

#### Scenario: Enforce 100% file coverage

- **WHEN** file coverage is below 100%
- **THEN** it SHALL fail validation and list all missing files

#### Scenario: Report file coverage details

- **WHEN** validation completes
- **THEN** it SHALL output: Total files: 37, Covered: 37, Coverage: 100%

### Requirement: Validate class-level coverage

The system SHALL validate that all classes are covered by code_class entities.

#### Scenario: Calculate class coverage percentage

- **WHEN** validation runs
- **THEN** it SHALL calculate: (covered classes / total classes) \* 100%

#### Scenario: Enforce 80% class coverage threshold

- **WHEN** class coverage is below 80%
- **THEN** it SHALL fail validation and list all missing classes

#### Scenario: Report class coverage details

- **WHEN** validation completes
- **THEN** it SHALL output: Total classes: 19, Covered: 16, Coverage: 84%

### Requirement: Validate function-level coverage

The system SHALL validate that exported functions are covered by code_function entities.

#### Scenario: Calculate function coverage percentage

- **WHEN** validation runs
- **THEN** it SHALL calculate: (covered functions / total exported functions) \* 100%

#### Scenario: Enforce 60% function coverage threshold

- **WHEN** function coverage is below 60%
- **THEN** it SHALL fail validation and list all missing functions

#### Scenario: Report function coverage details

- **WHEN** validation completes
- **THEN** it SHALL output: Total functions: 50, Covered: 35, Coverage: 70%

### Requirement: Generate coverage checklist

The system SHALL generate a coverage checklist showing which files/classes/functions are covered and which are missing.

#### Scenario: Generate file checklist

- **WHEN** validation runs
- **THEN** it SHALL output a checklist: lib/websocket/reliable-client.js [x], lib/websocket/state-manager.js [x], etc.

#### Scenario: Generate class checklist

- **WHEN** validation runs
- **THEN** it SHALL output a checklist: BM25Index [x], ProjectResolver [x], FileWatcher [x], etc.

#### Scenario: Generate function checklist

- **WHEN** validation runs
- **THEN** it SHALL output a checklist: buildEntryContent [x], extractByLevel [x], updateLinkMap [x], etc.

### Requirement: Block progression on low coverage

The system SHALL block progression to the next phase if coverage thresholds are not met.

#### Scenario: Block on file coverage failure

- **WHEN** file coverage < 100%
- **THEN** it SHALL block Phase 3 (Class building) and require remediation

#### Scenario: Block on class coverage failure

- **WHEN** class coverage < 80%
- **THEN** it SHALL block Phase 4 (Function building) and require remediation

#### Scenario: Block on function coverage failure

- **WHEN** function coverage < 60%
- **THEN** it SHALL block Phase 5 (Relationship building) and require remediation
