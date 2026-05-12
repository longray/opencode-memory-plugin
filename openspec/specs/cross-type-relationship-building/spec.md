# cross-type-relationship-building Specification

## Purpose

TBD - created by archiving change enhance-knowledge-graph-relations. Update Purpose after archive.

## Requirements

### Requirement: Extract keywords from conversation knowledge entities

The system SHALL extract keywords from decision/solution/pattern entities for matching with code entities.

#### Scenario: Extract technical terms from decision entity

- **WHEN** processing a decision entity
- **THEN** the system SHALL extract technical terms (module names, class names, technology names)

#### Scenario: Extract implementation details from solution entity

- **WHEN** processing a solution entity
- **THEN** the system SHALL extract implementation keywords (function names, file names, approaches)

#### Scenario: Extract pattern components from pattern entity

- **WHEN** processing a pattern entity
- **THEN** the system SHALL extract pattern components (classes, functions, data structures)

### Requirement: Match conversation entities with code entities

The system SHALL match conversation knowledge entities with relevant code entities based on keyword overlap.

#### Scenario: Match decision to code module

- **WHEN** a decision mentions "WebSocket" and "reconnection"
- **THEN** the system SHALL match it to lib/websocket/reliable-client.js module

#### Scenario: Match solution to code function

- **WHEN** a solution describes "atomic write" pattern
- **THEN** the system SHALL match it to atomic-write.js module and its functions

#### Scenario: Match pattern to code class

- **WHEN** a pattern describes "State Machine" pattern
- **THEN** the system SHALL match it to StateManager class in websocket/state-manager.js

### Requirement: Calculate semantic similarity between entities

The system SHALL calculate semantic similarity between conversation and code entities using hybrid search.

#### Scenario: Calculate BM25 similarity

- **WHEN** matching entities
- **THEN** the system SHALL calculate BM25 keyword similarity score

#### Scenario: Calculate vector similarity

- **WHEN** matching entities
- **THEN** the system SHALL calculate vector semantic similarity score

#### Scenario: Combine similarity scores

- **WHEN** calculating final similarity
- **THEN** the system SHALL combine: similarity = 0.7*BM25 + 0.3*vector

### Requirement: Establish cross-type relationships

The system SHALL establish relationships between conversation knowledge and code entities.

#### Scenario: Create applies_to relationship

- **WHEN** a decision applies to a code module
- **THEN** the system SHALL create applies_to relationship (decision → code_module)

#### Scenario: Create implements relationship

- **WHEN** a pattern is implemented as code
- **THEN** the system SHALL create implements relationship (pattern → code_function)

#### Scenario: Create related_to relationship

- **WHEN** a solution is related to code entities
- **THEN** the system SHALL create related_to relationship (bidirectional)

#### Scenario: Create depends_on relationship

- **WHEN** a solution depends on a decision
- **THEN** the system SHALL create depends_on relationship (solution → decision)

### Requirement: Validate cross-type relationships

The system SHALL validate that cross-type relationships are semantically correct.

#### Scenario: Validate applies_to relationships

- **WHEN** validating relationships
- **THEN** the system SHALL verify decision applies_to code_module is semantically valid

#### Scenario: Validate implements relationships

- **WHEN** validating relationships
- **THEN** the system SHALL verify pattern implements code_function is semantically valid

#### Scenario: Detect incorrect relationships

- **WHEN** validation finds incorrect relationships
- **THEN** the system SHALL flag them for manual review

### Requirement: Calculate relationship weights for cross-type relationships

The system SHALL calculate appropriate weights for cross-type relationships.

#### Scenario: Weight based on match strength

- **WHEN** creating a relationship
- **THEN** the system SHALL calculate weight based on keyword match strength (0.3-0.5)

#### Scenario: Weight based on entity importance

- **WHEN** creating a relationship
- **THEN** the system SHALL adjust weight based on code entity importance (+0.1-0.2)

#### Scenario: Weight based on semantic similarity

- **WHEN** creating a relationship
- **THEN** the system SHALL adjust weight based on semantic similarity (+0.1-0.3)

#### Scenario: Normalize cross-type weights

- **WHEN** calculating final weight
- **THEN** the system SHALL normalize to [0.3, 1.0] range
