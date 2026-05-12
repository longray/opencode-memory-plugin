## ADDED Requirements

### Requirement: Load and execute SOP definitions

The system SHALL load and execute SOP definitions from YAML files.

#### Scenario: Load SOP from YAML

- **WHEN** executing `sop run <name>`
- **THEN** the system SHALL load SOP definition from `.opencode/sops/<name>.yaml`

#### Scenario: Validate SOP structure

- **WHEN** loading SOP
- **THEN** the system SHALL validate required fields: name, description, steps

#### Scenario: Execute SOP steps sequentially

- **WHEN** executing SOP
- **THEN** the system SHALL execute steps in order, showing progress

#### Scenario: Handle step failures

- **WHEN** a step fails
- **THEN** the system SHALL stop execution and report error

### Requirement: Support SOP parameter overrides

The system SHALL support parameter overrides when executing SOPs.

#### Scenario: Override threshold parameter

- **WHEN** executing `sop run weight-optimization --threshold 0.6`
- **THEN** the system SHALL use 0.6 instead of default 0.5

#### Scenario: Override multiple parameters

- **WHEN** executing with multiple `--param` flags
- **THEN** the system SHALL apply all overrides

#### Scenario: Validate parameter values

- **WHEN** overriding parameters
- **THEN** the system SHALL validate values are in allowed ranges

#### Scenario: Show parameter help

- **WHEN** executing `sop run <name> --help`
- **THEN** the system SHALL show available parameters and defaults

### Requirement: Support dry-run mode

The system SHALL support dry-run mode for SOP execution.

#### Scenario: Preview SOP execution

- **WHEN** executing `sop run <name> --dry-run`
- **THEN** the system SHALL show what would be done without making changes

#### Scenario: Show affected entities

- **WHEN** in dry-run mode
- **THEN** the system SHALL list entities that would be modified

#### Scenario: Show estimated impact

- **WHEN** in dry-run mode
- **THEN** the system SHALL show estimated metrics changes

#### Scenario: Require confirmation for non-dry-run

- **WHEN** executing without --dry-run
- **THEN** the system SHALL ask for confirmation before making changes

### Requirement: Support step-by-step execution

The system SHALL support executing specific steps of an SOP.

#### Scenario: Execute specific step

- **WHEN** executing `sop run <name> --step detect`
- **THEN** the system SHALL execute only the "detect" step

#### Scenario: Execute step range

- **WHEN** executing `sop run <name> --step-range 1-3`
- **THEN** the system SHALL execute steps 1 through 3

#### Scenario: Skip specific steps

- **WHEN** executing `sop run <name> --skip verify`
- **THEN** the system SHALL skip the "verify" step

#### Scenario: List available steps

- **WHEN** executing `sop run <name> --list-steps`
- **THEN** the system SHALL list all steps with descriptions

### Requirement: Generate SOP execution reports

The system SHALL generate reports after SOP execution.

#### Scenario: Show execution summary

- **WHEN** SOP completes
- **THEN** the system SHALL show: steps executed, success/failure count, duration

#### Scenario: Show detailed changes

- **WHEN** SOP completes
- **THEN** the system SHALL show detailed list of changes made

#### Scenario: Show before/after metrics

- **WHEN** SOP completes
- **THEN** the system SHALL show metrics before and after execution

#### Scenario: Save execution report

- **WHEN** SOP completes
- **THEN** the system SHALL save report to `.opencode/sop-reports/<name>-<timestamp>.md`

### Requirement: List available SOPs

The system SHALL list available SOPs.

#### Scenario: List all SOPs

- **WHEN** executing `sop list`
- **THEN** the system SHALL list all available SOPs with descriptions

#### Scenario: Show SOP details

- **WHEN** executing `sop show <name>`
- **THEN** the system SHALL show SOP details: description, steps, parameters

#### Scenario: Filter by category

- **WHEN** executing `sop list --category maintenance`
- **THEN** the system SHALL filter SOPs by category

#### Scenario: Show last execution

- **WHEN** listing SOPs
- **THEN** the system SHALL show last execution time and status for each SOP
