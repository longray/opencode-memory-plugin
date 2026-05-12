## ADDED Requirements

### Requirement: Create independent entities for each file

The system SHALL create independent code_module entities for each important file, avoiding the anti-pattern of merging multiple files into one entity.

#### Scenario: Create entity for bm25.js

- **WHEN** analyzing lib/bm25.js
- **THEN** it SHALL create a separate code_module entity for bm25.js, NOT merge it with other files

#### Scenario: Create entity for atom-tree.js

- **WHEN** analyzing lib/atom-tree.js
- **THEN** it SHALL create a separate code_module entity for atom-tree.js with its 10 functions

#### Scenario: Create entity for websocket/reliable-client.js

- **WHEN** analyzing lib/websocket/reliable-client.js
- **THEN** it SHALL create a separate code_module entity, NOT merge all websocket files into one

### Requirement: Define entity granularity thresholds

The system SHALL define clear thresholds for when to create an entity vs. when to skip or include in parent.

#### Scenario: File exceeds line threshold

- **WHEN** a file has >100 lines
- **THEN** it SHALL create an independent code_module entity

#### Scenario: File has exports

- **WHEN** a file has exports (functions, classes, or objects)
- **THEN** it SHALL create an independent code_module entity regardless of line count

#### Scenario: File below threshold and no exports

- **WHEN** a file has <=100 lines AND no exports
- **THEN** it SHALL be included in the parent module's description or skipped

### Requirement: Create Chapter atoms for each entity

The system SHALL create Chapter atoms for each code_module entity to organize the content hierarchically.

#### Scenario: Create module overview chapter

- **WHEN** creating a code_module entity
- **THEN** it SHALL include a Chapter atom named "模块概述" with file purpose and main functionality

#### Scenario: Create exports chapter

- **WHEN** creating a code_module entity
- **THEN** it SHALL include a Chapter atom named "导出列表" listing all exports

#### Scenario: Create dependencies chapter

- **WHEN** creating a code_module entity
- **THEN** it SHALL include a Chapter atom named "依赖关系" listing all imports and dependencies

### Requirement: Avoid entity merging anti-pattern

The system SHALL explicitly avoid the anti-pattern of merging multiple files into a single entity.

#### Scenario: Reject lib/ merged entity

- **WHEN** the system detects an entity describing multiple files (e.g., "lib/ contains 26 files")
- **THEN** it SHALL reject it and create separate entities for each file

#### Scenario: Reject tools/ merged entity

- **WHEN** the system detects an entity describing multiple tool files
- **THEN** it SHALL reject it and create separate entities for each tool file

#### Scenario: Validate entity granularity

- **WHEN** validating entities
- **THEN** it SHALL check that each entity describes exactly one file, not multiple
