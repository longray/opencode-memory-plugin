## ADDED Requirements

### Requirement: Symbol table path resolution

The system SHALL resolve import paths to absolute file paths using Node.js module resolution algorithm.

#### Scenario: Resolve relative import

- **WHEN** a JavaScript file contains `import { foo } from './utils'`
- **THEN** the system SHALL resolve the path to the absolute file path of the utils module

#### Scenario: Skip external dependencies

- **WHEN** an import path starts with a non-relative path (e.g., 'lodash', 'react')
- **THEN** the system SHALL skip the import and not create a relationship

#### Scenario: Handle file extensions

- **WHEN** resolving a path without extension (e.g., './utils')
- **THEN** the system SHALL try extensions in order: .js, .ts, .mjs, .cjs, /index.js

### Requirement: Symbol table entity mapping

The system SHALL maintain a mapping from file paths to entity IDs for all uploaded code files.

#### Scenario: Build path-to-entity mapping

- **WHEN** uploading a batch of code files
- **THEN** the system SHALL build a Map of file paths to their corresponding entity IDs

#### Scenario: Lookup entity by path

- **WHEN** creating a depends_on relationship for an import
- **THEN** the system SHALL look up the target entity ID using the resolved file path

#### Scenario: Handle missing mappings

- **WHEN** an import path cannot be resolved to an entity
- **THEN** the system SHALL log a warning and skip the relationship creation

### Requirement: Symbol table persistence

The system SHALL persist the symbol table to disk for reuse across sessions.

#### Scenario: Save symbol table

- **WHEN** the symbol table is updated
- **THEN** the system SHALL save it to `~/.opencode/cache/symbol-table.json` with debouncing (1000ms)

#### Scenario: Load symbol table

- **WHEN** the plugin initializes
- **THEN** the system SHALL load the existing symbol table from disk if present

#### Scenario: Rebuild from backend

- **WHEN** the local symbol table is missing or corrupted
- **THEN** the system SHALL rebuild it by querying the backend for all code entities
