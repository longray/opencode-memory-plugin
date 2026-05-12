## ADDED Requirements

### Requirement: Extract import relationships

The system SHALL extract import relationships between modules to establish depends_on relationships.

#### Scenario: Extract ES6 imports

- **WHEN** analyzing a file with ES6 imports (import X from 'Y')
- **THEN** it SHALL extract the imported module and create a depends_on relationship

#### Scenario: Extract CommonJS requires

- **WHEN** analyzing a file with CommonJS requires (const X = require('Y'))
- **THEN** it SHALL extract the required module and create a depends_on relationship

#### Scenario: Extract relative imports

- **WHEN** analyzing a file with relative imports (import X from '../lib/Y')
- **THEN** it SHALL resolve the relative path and create a depends_on relationship to the actual file

### Requirement: Extract function call relationships

The system SHALL extract function call relationships to establish calls relationships.

#### Scenario: Extract internal function calls

- **WHEN** analyzing a function that calls another function in the same file
- **THEN** it SHALL create a calls relationship between the caller and callee

#### Scenario: Extract cross-file function calls

- **WHEN** analyzing a function that calls a function from another module
- **THEN** it SHALL create a calls relationship to the imported function

#### Scenario: Extract method calls

- **WHEN** analyzing a method that calls another method
- **THEN** it SHALL create a calls relationship between the methods

### Requirement: Establish contains relationships

The system SHALL establish contains relationships to represent the hierarchical structure (module contains class, class contains function).

#### Scenario: Module contains class

- **WHEN** a module exports a class
- **THEN** it SHALL create a contains relationship from the module entity to the class entity

#### Scenario: Module contains function

- **WHEN** a module exports a function
- **THEN** it SHALL create a contains relationship from the module entity to the function entity

#### Scenario: Class contains method

- **WHEN** a class has methods
- **THEN** it SHALL create contains relationships from the class entity to each method entity

### Requirement: Create bidirectional relationships

The system SHALL create bidirectional relationships where appropriate (e.g., caller ↔ callee).

#### Scenario: Bidirectional calls

- **WHEN** function A calls function B
- **THEN** it SHALL create: A --calls--> B AND B --called_by--> A

#### Scenario: Bidirectional contains

- **WHEN** module M contains class C
- **THEN** it SHALL create: M --contains--> C AND C --contained_in--> M

#### Scenario: Bidirectional depends

- **WHEN** module A depends on module B
- **THEN** it SHALL create: A --depends_on--> B AND B --depended_by--> A

### Requirement: Validate relationship integrity

The system SHALL validate that all relationships point to existing entities and there are no dangling references.

#### Scenario: Validate calls relationships

- **WHEN** validating relationships
- **THEN** it SHALL verify that all calls relationships point to existing function entities

#### Scenario: Validate depends_on relationships

- **WHEN** validating relationships
- **THEN** it SHALL verify that all depends_on relationships point to existing module entities

#### Scenario: Validate contains relationships

- **WHEN** validating relationships
- **THEN** it SHALL verify that all contains relationships point to existing class/function entities

#### Scenario: Report dangling references

- **WHEN** dangling references are found
- **THEN** it SHALL report them with: source entity, target entity (missing), relationship type
