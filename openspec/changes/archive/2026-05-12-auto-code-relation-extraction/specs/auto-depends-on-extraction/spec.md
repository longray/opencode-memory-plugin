## ADDED Requirements

### Requirement: Import statement extraction

The system SHALL extract all import statements from code files during AST analysis.

#### Scenario: Extract ES6 imports

- **WHEN** analyzing a file with `import { foo } from './utils'`
- **THEN** the system SHALL record the import source './utils' and imported names ['foo']

#### Scenario: Extract default imports

- **WHEN** analyzing a file with `import utils from './utils'`
- **THEN** the system SHALL record the import source and default import name 'utils'

#### Scenario: Extract namespace imports

- **WHEN** analyzing a file with `import * as utils from './utils'`
- **THEN** the system SHALL record the import source and namespace 'utils'

#### Scenario: Extract require statements

- **WHEN** analyzing a file with `const utils = require('./utils')`
- **THEN** the system SHALL record the require source './utils'

### Requirement: Depends-on relationship creation

The system SHALL automatically create depends_on relationships based on import statements.

#### Scenario: Create relationship for internal import

- **WHEN** file A imports from file B (internal project file)
- **THEN** the system SHALL create a depends_on relationship from A to B with weight 0.8

#### Scenario: Skip external dependencies

- **WHEN** an import is from node_modules or built-in
- **THEN** the system SHALL NOT create a relationship

#### Scenario: Handle multiple imports

- **WHEN** a file imports from multiple sources
- **THEN** the system SHALL create a depends_on relationship for each internal import

#### Scenario: Duplicate detection

- **WHEN** a depends_on relationship already exists
- **THEN** the system SHALL skip creation to avoid duplicates

### Requirement: Relationship metadata

The system SHALL include metadata in depends_on relationships.

#### Scenario: Include import names

- **WHEN** creating a depends_on relationship
- **THEN** the description SHALL include the imported names (e.g., "Imports: foo, bar")

#### Scenario: Include import type

- **WHEN** creating a depends_on relationship
- **THEN** the metadata SHALL include the import type (ES6 import, require, etc.)

#### Scenario: Calculate weight

- **WHEN** creating a depends_on relationship
- **THEN** the weight SHALL be 0.8 for direct imports, 0.6 for transitive imports
