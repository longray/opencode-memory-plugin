## ADDED Requirements

### Requirement: Call expression extraction

The system SHALL extract all function call expressions from code files during AST analysis.

#### Scenario: Extract direct calls

- **WHEN** analyzing code with `foo()`
- **THEN** the system SHALL record the call target 'foo'

#### Scenario: Extract member calls

- **WHEN** analyzing code with `obj.method()`
- **THEN** the system SHALL record the call target 'method' and receiver 'obj'

#### Scenario: Extract imported calls

- **WHEN** analyzing code with `importedFunc()` after `import { importedFunc } from './utils'`
- **THEN** the system SHALL resolve the call to the source file

#### Scenario: Extract chained calls

- **WHEN** analyzing code with `obj.method1().method2()`
- **THEN** the system SHALL record both method1 and method2 calls

#### Scenario: Skip built-in calls

- **WHEN** analyzing code with `console.log()` or `Array.isArray()`
- **THEN** the system SHALL skip built-in function calls

### Requirement: Calls relationship creation

The system SHALL automatically create calls relationships for resolved function calls.

#### Scenario: Create same-file call

- **WHEN** function A calls function B in the same file
- **THEN** the system SHALL create a calls relationship from A to B

#### Scenario: Create cross-file call

- **WHEN** function A in file X calls function B in file Y
- **THEN** the system SHALL create a calls relationship from X to Y

#### Scenario: Handle unresolved calls

- **WHEN** a call target cannot be resolved
- **THEN** the system SHALL skip the relationship creation

#### Scenario: Duplicate detection

- **WHEN** a calls relationship already exists
- **THEN** the system SHALL skip creation

### Requirement: Call relationship metadata

The system SHALL include detailed metadata in calls relationships.

#### Scenario: Include call frequency

- **WHEN** creating a calls relationship
- **THEN** the metadata SHALL include the number of times the function is called

#### Scenario: Include call locations

- **WHEN** creating a calls relationship
- **THEN** the metadata SHALL include line numbers of call sites

#### Scenario: Calculate weight

- **WHEN** creating a calls relationship
- **THEN** the weight SHALL be based on call frequency (more calls = higher weight)
