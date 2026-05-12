## ADDED Requirements

### Requirement: Detect isolated entities

The system SHALL detect entities that have no relationships (neither incoming nor outgoing).

#### Scenario: Identify isolated entities

- **WHEN** running relationship validation
- **THEN** the system SHALL identify entities with 0 incoming AND 0 outgoing relationships

#### Scenario: Report isolated entities

- **WHEN** isolated entities are found
- **THEN** the system SHALL report: entity ID, entity type, entity name, suggested actions

#### Scenario: Exclude intentionally isolated entities

- **WHEN** configuring validation
- **THEN** the system SHALL allow whitelisting certain entity types (e.g., constants)

### Requirement: Validate relationship completeness

The system SHALL validate that expected relationships exist for different entity types.

#### Scenario: Validate class contains methods

- **WHEN** a code_class entity exists
- **THEN** the system SHALL verify it has contains relationships to its methods

#### Scenario: Validate module contains classes

- **WHEN** a code_module entity exists
- **THEN** the system SHALL verify it has contains relationships to its exported classes

#### Scenario: Validate module contains functions

- **WHEN** a code_module entity exists
- **THEN** the system SHALL verify it has contains relationships to its exported functions

#### Scenario: Report missing relationships

- **WHEN** expected relationships are missing
- **THEN** the system SHALL report: source entity, expected relationship type, suggested target

### Requirement: Validate relationship weight合理性

The system SHALL validate that relationship weights are within reasonable ranges.

#### Scenario: Detect abnormally low weights

- **WHEN** a relationship has weight < 0.3
- **THEN** the system SHALL flag it as potentially incorrect

#### Scenario: Detect abnormally high weights

- **WHEN** a relationship has weight > 1.0
- **THEN** the system SHALL flag it as potentially incorrect

#### Scenario: Detect uniform weights

- **WHEN** multiple relationships have identical weights (e.g., all 0.7)
- **THEN** the system SHALL flag them for weight optimization

#### Scenario: Report weight anomalies

- **WHEN** weight anomalies are detected
- **THEN** the system SHALL report: relationship ID, current weight, suggested weight, reason

### Requirement: Validate relationship type correctness

The system SHALL validate that relationship types are appropriate for the connected entities.

#### Scenario: Validate contains relationships

- **WHEN** a contains relationship exists
- **THEN** the system SHALL verify the source is a container (module/class) and target is contained

#### Scenario: Validate calls relationships

- **WHEN** a calls relationship exists
- **THEN** the system SHALL verify both source and target are functions/methods

#### Scenario: Validate depends_on relationships

- **WHEN** a depends_on relationship exists
- **THEN** the system SHALL verify source and target are modules/files

#### Scenario: Report type mismatches

- **WHEN** relationship type mismatches are found
- **THEN** the system SHALL report: relationship ID, current type, expected type

### Requirement: Generate relationship validation report

The system SHALL generate a comprehensive validation report.

#### Scenario: Report validation summary

- **WHEN** validation is complete
- **THEN** the system SHALL output: total entities, total relationships, issues found, pass rate

#### Scenario: Report isolated entities

- **WHEN** validation is complete
- **THEN** the system SHALL list all isolated entities with details

#### Scenario: Report missing relationships

- **WHEN** validation is complete
- **THEN** the system SHALL list all missing relationships with suggestions

#### Scenario: Report weight anomalies

- **WHEN** validation is complete
- **THEN** the system SHALL list all weight anomalies with recommendations

#### Scenario: Generate fix suggestions

- **WHEN** issues are found
- **THEN** the system SHALL generate actionable fix suggestions for each issue
