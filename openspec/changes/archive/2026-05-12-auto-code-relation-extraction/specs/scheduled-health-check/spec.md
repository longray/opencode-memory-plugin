## ADDED Requirements

### Requirement: Scheduled health check execution

The system SHALL automatically run health checks on a configurable schedule.

#### Scenario: Daily health check

- **WHEN** the configured schedule time is reached (default: daily at 9:00 AM)
- **THEN** the system SHALL automatically run the health check

#### Scenario: Configurable schedule

- **WHEN** user configures `"schedule": "0 */6 * * *"` (every 6 hours)
- **THEN** the system SHALL run health checks every 6 hours

#### Scenario: Disable scheduled checks

- **WHEN** user configures `"enabled": false`
- **THEN** the system SHALL not run scheduled health checks

#### Scenario: Manual trigger still works

- **WHEN** user manually runs health check via CLI
- **THEN** the system SHALL execute the check regardless of schedule

### Requirement: Health check reporting

The system SHALL generate and display health check reports.

#### Scenario: Generate report on schedule

- **WHEN** a scheduled health check completes
- **THEN** the system SHALL generate a report with entity count, relation count, network density, and health score

#### Scenario: Display report in console

- **WHEN** a health check completes
- **THEN** the system SHALL display the report in the OpenCode console

#### Scenario: Save report to file

- **WHEN** a health check completes
- **THEN** the system SHALL save the report to `~/.opencode/reports/health-YYYY-MM-DD.json`

### Requirement: Health threshold alerting

The system SHALL alert when health metrics fall below configured thresholds.

#### Scenario: Alert on low health score

- **WHEN** health score is below threshold (default: 80)
- **THEN** the system SHALL display a warning message

#### Scenario: Alert on low network density

- **WHEN** network density is below threshold (default: 0.02)
- **THEN** the system SHALL suggest running relation recommendation

#### Scenario: Alert on high orphan rate

- **WHEN** more than 20% of entities have no relations
- **THEN** the system SHALL warn about isolated entities

#### Scenario: Configurable thresholds

- **WHEN** user configures custom thresholds
- **THEN** the system SHALL use the configured values instead of defaults

### Requirement: Health check performance

The system SHALL ensure scheduled health checks do not impact performance.

#### Scenario: Async execution

- **WHEN** a scheduled health check runs
- **THEN** the system SHALL execute asynchronously without blocking user operations

#### Scenario: Timeout protection

- **WHEN** a health check exceeds timeout (default: 60 seconds)
- **THEN** the system SHALL abort and report timeout

#### Scenario: Low priority execution

- **WHEN** a scheduled health check runs
- **THEN** the system SHALL use low priority to minimize resource impact
