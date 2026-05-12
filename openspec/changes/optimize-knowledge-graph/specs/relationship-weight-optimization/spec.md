## ADDED Requirements

### Requirement: Calculate relationship weights based on multiple factors

The system SHALL calculate relationship weights using a multi-factor model: weight = base(0.5) + frequency(0.3) + strength(0.2).

#### Scenario: Calculate base weight

- **WHEN** creating a relationship
- **THEN** the system SHALL assign a base weight of 0.5

#### Scenario: Calculate frequency coefficient

- **WHEN** analyzing function calls
- **THEN** the system SHALL calculate frequency coefficient based on call count (normalized 0-0.3)

#### Scenario: Calculate strength coefficient

- **WHEN** analyzing dependencies
- **THEN** the system SHALL calculate strength coefficient based on dependency depth (0-0.2)

### Requirement: Normalize weights to 0.3-1.0 range

The system SHALL normalize calculated weights to the range 0.3 (weak) to 1.0 (strong).

#### Scenario: Weight below minimum

- **WHEN** calculated weight is < 0.3
- **THEN** the system SHALL set it to 0.3

#### Scenario: Weight above maximum

- **WHEN** calculated weight is > 1.0
- **THEN** the system SHALL set it to 1.0

#### Scenario: Weight within range

- **WHEN** calculated weight is between 0.3 and 1.0
- **THEN** the system SHALL keep it as is

### Requirement: Update existing relationship weights

The system SHALL update existing relationship weights based on the new calculation model.

#### Scenario: Update contains relationships

- **WHEN** updating module-to-class contains relationships
- **THEN** the system SHALL recalculate weights based on class importance and usage frequency

#### Scenario: Update calls relationships

- **WHEN** updating function-to-function calls relationships
- **THEN** the system SHALL recalculate weights based on call frequency and criticality

#### Scenario: Update depends_on relationships

- **WHEN** updating module-to-module depends_on relationships
- **THEN** the system SHALL recalculate weights based on dependency depth and coupling strength

### Requirement: Support weight categories

The system SHALL categorize relationships by weight ranges.

#### Scenario: Strong relationships (0.8-1.0)

- **WHEN** weight >= 0.8
- **THEN** the system SHALL categorize it as "strong"

#### Scenario: Medium relationships (0.5-0.79)

- **WHEN** weight >= 0.5 AND < 0.8
- **THEN** the system SHALL categorize it as "medium"

#### Scenario: Weak relationships (0.3-0.49)

- **WHEN** weight >= 0.3 AND < 0.5
- **THEN** the system SHALL categorize it as "weak"

### Requirement: Generate weight distribution report

The system SHALL generate a report showing the distribution of relationship weights.

#### Scenario: Report weight distribution

- **WHEN** weight optimization is complete
- **THEN** the system SHALL output: strong count, medium count, weak count, average weight

#### Scenario: Identify outliers

- **WHEN** analyzing weight distribution
- **THEN** the system SHALL identify and report any outliers (weights > 2 std dev from mean)

#### Scenario: Compare before/after

- **WHEN** generating report
- **THEN** the system SHALL compare weight distribution before and after optimization
