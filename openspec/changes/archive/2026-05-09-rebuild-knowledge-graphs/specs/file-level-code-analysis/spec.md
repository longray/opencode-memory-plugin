## ADDED Requirements

### Requirement: Scan all files using glob patterns

The system SHALL use glob patterns to recursively scan all JavaScript/TypeScript files in the project, including subdirectories.

#### Scenario: Scan lib/ directory recursively

- **WHEN** running the file scanner on lib/
- **THEN** it SHALL find all .js files including those in subdirectories (websocket/, precompute/)

#### Scenario: Scan tools/ directory

- **WHEN** running the file scanner on tools/
- **THEN** it SHALL find all 5 tool files (core.js, search.js, graph.js, browse.js, sync.js)

#### Scenario: Generate file manifest

- **WHEN** the scan is complete
- **THEN** it SHALL output a manifest with: file path, line count, export count, and whether it meets the entity threshold

### Requirement: Analyze each file independently

The system SHALL analyze each file independently to extract its classes, functions, and module information.

#### Scenario: Analyze wrapper-client.js

- **WHEN** analyzing lib/wrapper-client.js
- **THEN** it SHALL extract: 4 classes, 6 functions, 1096 lines, dependencies

#### Scenario: Analyze atom-tree.js

- **WHEN** analyzing lib/atom-tree.js
- **THEN** it SHALL extract: 10 functions, 325 lines, exports (buildAtomTree, flattenAtomTree, etc.)

#### Scenario: Analyze bm25.js

- **WHEN** analyzing lib/bm25.js
- **THEN** it SHALL extract: BM25Index class, 2 functions, 274 lines

### Requirement: Create entities for files meeting threshold

The system SHALL create code_module entities for files that meet the threshold (>100 lines OR has exports).

#### Scenario: File meets threshold

- **WHEN** a file has >100 lines OR has exports
- **THEN** the system SHALL create a code_module entity with Chapter atoms (模块概述, 导出列表, 依赖关系)

#### Scenario: File below threshold

- **WHEN** a file has <=100 lines AND no exports
- **THEN** the system SHALL skip it or include it in parent module's description

### Requirement: Extract and store file metadata

The system SHALL extract and store file metadata including line count, complexity, exports, and dependencies.

#### Scenario: Store line count

- **WHEN** creating a code_module entity
- **THEN** it SHALL include line count in the metadata

#### Scenario: Store export list

- **WHEN** creating a code_module entity
- **THEN** it SHALL include a list of all exported functions/classes

#### Scenario: Store dependency list

- **WHEN** creating a code_module entity
- **THEN** it SHALL include a list of imported modules
