## ADDED Requirements

### Requirement: Display overall health score

The system SHALL display an overall health score (0-100) in the quality dashboard.

#### Scenario: Calculate health score

- **WHEN** displaying dashboard
- **THEN** the system SHALL calculate: (coverage + relationship + search) / 3

#### Scenario: Show health grade

- **WHEN** displaying score
- **THEN** the system SHALL show grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

#### Scenario: Color code health score

- **WHEN** displaying score
- **THEN** the system SHALL color code: green (>=80), yellow (60-79), red (<60)

#### Scenario: Show score breakdown

- **WHEN** displaying score
- **THEN** the system SHALL show breakdown: coverage score, relationship score, search score

### Requirement: Display entity statistics

The system SHALL display entity statistics in the dashboard.

#### Scenario: Show total entity count

- **WHEN** displaying dashboard
- **THEN** the system SHALL show total entity count

#### Scenario: Show entity type distribution

- **WHEN** displaying dashboard
- **THEN** the system SHALL show count by type: code_module, code_class, code_function, decision, solution, pattern

#### Scenario: Show directory coverage

- **WHEN** displaying dashboard
- **THEN** the system SHALL show coverage % for: lib/, tools/, cli/, agents/

#### Scenario: Show entity growth

- **WHEN** displaying dashboard
- **THEN** the system SHALL show: entities added today, this week

### Requirement: Display relationship network metrics

The system SHALL display relationship network metrics.

#### Scenario: Show network density

- **WHEN** displaying dashboard
- **THEN** the system SHALL show current network density (actual/possible)

#### Scenario: Show isolated entity count

- **WHEN** displaying dashboard
- **THEN** the system SHALL show count of entities with 0 relationships

#### Scenario: Show average relationships per entity

- **WHEN** displaying dashboard
- **THEN** the system SHALL show average relationships per entity

#### Scenario: Show relationship type distribution

- **WHEN** displaying dashboard
- **THEN** the system SHALL show count by type: contains, calls, depends_on, related, implements

### Requirement: Display search quality metrics

The system SHALL display search quality metrics.

#### Scenario: Show recent search latency

- **WHEN** displaying dashboard
- **THEN** the system SHALL show average latency of last 10 searches

#### Scenario: Show search accuracy

- **WHEN** displaying dashboard
- **THEN** the system SHALL show precision@K for recent searches

#### Scenario: Show search mode usage

- **WHEN** displaying dashboard
- **THEN** the system SHALL show usage %: keyword/vector/hybrid

#### Scenario: Show search anomalies

- **WHEN** displaying dashboard
- **THEN** the system SHALL show count of recent anomalies (timeout, 0 results)

### Requirement: Support dashboard refresh

The system SHALL support refreshing the dashboard.

#### Scenario: Manual refresh

- **WHEN** user presses 'r' key
- **THEN** the system SHALL refresh all metrics immediately

#### Scenario: Auto refresh

- **WHEN** auto-refresh is enabled
- **THEN** the system SHALL refresh every 60 seconds

#### Scenario: Toggle auto refresh

- **WHEN** user presses 'a' key
- **THEN** the system SHALL toggle auto-refresh on/off

#### Scenario: Show last refresh time

- **WHEN** displaying dashboard
- **THEN** the system SHALL show last refresh timestamp

### Requirement: Display actionable recommendations

The system SHALL display actionable recommendations in the dashboard.

#### Scenario: Show top issues

- **WHEN** displaying dashboard
- **THEN** the system SHALL show top 3 issues requiring attention

#### Scenario: Show suggested actions

- **WHEN** displaying dashboard
- **THEN** the system SHALL show suggested SOP commands to run

#### Scenario: Show quick fix options

- **WHEN** displaying dashboard
- **THEN** the system SHALL show one-click fix options for detected issues

#### Scenario: Priority code issues

- **WHEN** displaying issues
- **THEN** the system SHALL color code by priority: critical (red), warning (yellow), info (blue)
