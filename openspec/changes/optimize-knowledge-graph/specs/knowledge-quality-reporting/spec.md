## ADDED Requirements

### Requirement: Generate entity distribution report

The system SHALL generate a report showing the distribution of entities by type.

#### Scenario: Count entities by type

- **WHEN** generating report
- **THEN** the system SHALL count: code_module, code_class, code_function, decision, solution, pattern, other

#### Scenario: Calculate type percentages

- **WHEN** generating report
- **THEN** the system SHALL calculate percentage for each type

#### Scenario: Compare with targets

- **WHEN** generating report
- **THEN** the system SHALL compare actual distribution with target distribution

#### Scenario: Identify type imbalances

- **WHEN** analyzing distribution
- **THEN** the system SHALL flag types that are under-represented or over-represented

### Requirement: Generate directory coverage report

The system SHALL generate a report showing coverage by directory.

#### Scenario: Count entities per directory

- **WHEN** generating report
- **THEN** the system SHALL count entities for: lib/, lib/websocket/, lib/precompute/, tools/, cli/, agents/

#### Scenario: Calculate coverage percentage

- **WHEN** generating report
- **THEN** the system SHALL calculate coverage % for each directory (entities / files)

#### Scenario: Identify under-covered directories

- **WHEN** analyzing coverage
- **THEN** the system SHALL flag directories with < 80% coverage

#### Scenario: Track coverage trends

- **WHEN** generating report
- **THEN** the system SHALL compare current coverage with previous reports

### Requirement: Generate relationship network report

The system SHALL generate a report analyzing the relationship network.

#### Scenario: Count relationships by type

- **WHEN** generating report
- **THEN** the system SHALL count: contains, calls, depends_on, other

#### Scenario: Calculate average relationships per entity

- **WHEN** generating report
- **THEN** the system SHALL calculate: total relationships / total entities

#### Scenario: Identify highly connected entities

- **WHEN** analyzing network
- **THEN** the system SHALL identify entities with > 10 relationships (hubs)

#### Scenario: Identify sparsely connected entities

- **WHEN** analyzing network
- **THEN** the system SHALL identify entities with < 2 relationships

#### Scenario: Calculate network density

- **WHEN** generating report
- **THEN** the system SHALL calculate: actual relationships / possible relationships

### Requirement: Generate search quality report

The system SHALL generate a report measuring search quality metrics.

#### Scenario: Measure keyword search accuracy

- **WHEN** generating report
- **THEN** the system SHALL test keyword searches and calculate precision@K

#### Scenario: Measure vector search accuracy

- **WHEN** generating report
- **THEN** the system SHALL test vector searches and calculate precision@K

#### Scenario: Measure hybrid search accuracy

- **WHEN** generating report
- **THEN** the system SHALL test hybrid searches and calculate precision@K

#### Scenario: Measure Chinese search accuracy

- **WHEN** generating report
- **THEN** the system SHALL test Chinese queries and calculate precision@K

#### Scenario: Measure search latency

- **WHEN** generating report
- **THEN** the system SHALL measure average search latency for each mode

#### Scenario: Compare search modes

- **WHEN** generating report
- **THEN** the system SHALL compare accuracy and latency across keyword/vector/hybrid modes

### Requirement: Generate topic distribution report

The system SHALL generate a report showing the distribution of topics.

#### Scenario: Count entries per topic

- **WHEN** generating report
- **THEN** the system SHALL count entries for each topic

#### Scenario: Identify top topics

- **WHEN** generating report
- **THEN** the system SHALL list top 20 topics by entry count

#### Scenario: Identify orphan topics

- **WHEN** analyzing topics
- **THEN** the system SHALL identify topics with only 1 entry

#### Scenario: Calculate topic diversity

- **WHEN** generating report
- **THEN** the system SHALL calculate: unique topics / total entries

### Requirement: Generate comprehensive quality score

The system SHALL generate an overall quality score for the knowledge graph.

#### Scenario: Calculate coverage score

- **WHEN** calculating quality score
- **THEN** the system SHALL calculate: (file coverage + class coverage + function coverage) / 3

#### Scenario: Calculate relationship score

- **WHEN** calculating quality score
- **THEN** the system SHALL calculate: (relationship density + avg relationships per entity) / 2

#### Scenario: Calculate search score

- **WHEN** calculating quality score
- **THEN** the system SHALL calculate: (keyword accuracy + vector accuracy + hybrid accuracy) / 3

#### Scenario: Calculate overall quality score

- **WHEN** generating report
- **THEN** the system SHALL calculate: (coverage + relationship + search) / 3

#### Scenario: Grade quality score

- **WHEN** calculating score
- **THEN** the system SHALL assign grade: A (90-100), B (80-89), C (70-79), D (60-69), F (< 60)

### Requirement: Generate actionable recommendations

The system SHALL generate actionable recommendations based on report findings.

#### Scenario: Recommend entity additions

- **WHEN** coverage gaps are found
- **THEN** the system SHALL recommend specific entities to add

#### Scenario: Recommend relationship additions

- **WHEN** sparse connections are found
- **THEN** the system SHALL recommend specific relationships to add

#### Scenario: Recommend weight adjustments

- **WHEN** weight anomalies are found
- **THEN** the system SHALL recommend specific weight adjustments

#### Scenario: Recommend search improvements

- **WHEN** search accuracy is low
- **THEN** the system SHALL recommend specific improvements

#### Scenario: Prioritize recommendations

- **WHEN** generating recommendations
- **THEN** the system SHALL prioritize by impact and effort
