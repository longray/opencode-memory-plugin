## ADDED Requirements

### Requirement: Diagnose knowledge graph issues

The system SHALL diagnose knowledge graph issues automatically.

#### Scenario: Detect isolated entities

- **WHEN** running diagnosis
- **THEN** the system SHALL detect entities with 0 relationships

#### Scenario: Detect low-weight relationships

- **WHEN** running diagnosis
- **THEN** the system SHALL detect relationships with weight < 0.5

#### Scenario: Detect missing relationships

- **WHEN** running diagnosis
- **THEN** the system SHALL detect entities that should have relationships but don't

#### Scenario: Detect duplicate entities

- **WHEN** running diagnosis
- **THEN** the system SHALL detect potential duplicate entities (similarity > 0.9)

#### Scenario: Detect incomplete entities

- **WHEN** running diagnosis
- **THEN** the system SHALL detect entities missing required fields

### Requirement: Generate fix recommendations

The system SHALL generate fix recommendations for detected issues.

#### Scenario: Recommend relation for isolated entity

- **WHEN** isolated entity detected
- **THEN** the system SHALL recommend potential relations based on semantic similarity

#### Scenario: Recommend weight adjustment

- **WHEN** low-weight relation detected
- **THEN** the system SHALL recommend recalculating weight

#### Scenario: Recommend relation creation

- **WHEN** missing relation detected
- **THEN** the system SHALL recommend creating relation with suggested target

#### Scenario: Recommend entity merge

- **WHEN** duplicate detected
- **THEN** the system SHALL recommend merging entities

#### Scenario: Show fix preview

- **WHEN** generating recommendations
- **THEN** the system SHALL show preview of changes

### Requirement: Support dry-run diagnosis

The system SHALL support dry-run mode for diagnosis.

#### Scenario: Preview issues without fixing

- **WHEN** running `fix --dry-run`
- **THEN** the system SHALL show issues without making changes

#### Scenario: Show fix count

- **WHEN** in dry-run mode
- **THEN** the system SHALL show count of issues by type

#### Scenario: Show estimated impact

- **WHEN** in dry-run mode
- **THEN** the system SHALL show estimated metrics improvement

#### Scenario: Export diagnosis report

- **WHEN** in dry-run mode
- **THEN** the system SHALL support exporting report to file

### Requirement: Support automatic fix mode

The system SHALL support automatic fix mode for safe fixes.

#### Scenario: Auto-fix safe issues

- **WHEN** running `fix --auto`
- **THEN** the system SHALL automatically fix issues marked as "safe"

#### Scenario: Skip unsafe fixes

- **WHEN** auto-fixing
- **THEN** the system SHALL skip issues requiring manual review

#### Scenario: Show auto-fix progress

- **WHEN** auto-fixing
- **THEN** the system SHALL show progress: X of Y issues fixed

#### Scenario: Generate auto-fix report

- **WHEN** auto-fix completes
- **THEN** the system SHALL show what was fixed and what was skipped

### Requirement: Support interactive fix mode

The system SHALL support interactive fix mode for manual review.

#### Scenario: Show issue interactively

- **WHEN** running `fix --interactive`
- **THEN** the system SHALL show each issue and ask for confirmation

#### Scenario: Support fix options

- **WHEN** showing issue
- **THEN** the system SHALL support: [y]es fix, [n]o skip, [s]how details, [q]uit

#### Scenario: Apply fix on confirmation

- **WHEN** user confirms
- **THEN** the system SHALL apply the fix immediately

#### Scenario: Skip to next on decline

- **WHEN** user declines
- **THEN** the system SHALL skip to next issue

#### Scenario: Show details on request

- **WHEN** user requests details
- **THEN** the system SHALL show full entity/relationship details

### Requirement: Support fix by issue type

The system SHALL support fixing specific issue types.

#### Scenario: Fix isolated entities only

- **WHEN** running `fix isolated-entities`
- **THEN** the system SHALL only fix isolated entity issues

#### Scenario: Fix low-weight relations only

- **WHEN** running `fix low-weight-relations`
- **THEN** the system SHALL only fix low-weight relation issues

#### Scenario: Fix missing relations only

- **WHEN** running `fix missing-relations`
- **THEN** the system SHALL only fix missing relation issues

#### Scenario: Fix duplicates only

- **WHEN** running `fix duplicates`
- **THEN** the system SHALL only fix duplicate issues

#### Scenario: Combine fix types

- **WHEN** running `fix isolated-entities,missing-relations`
- **THEN** the system SHALL fix both types

### Requirement: Support undo functionality

The system SHALL support undoing fixes.

#### Scenario: Undo last fix

- **WHEN** running `fix --undo`
- **THEN** the system SHALL undo the last fix operation

#### Scenario: Undo specific fix

- **WHEN** running `fix --undo <fix-id>`
- **THEN** the system SHALL undo the specified fix

#### Scenario: Show fix history

- **WHEN** running `fix --history`
- **THEN** the system SHALL show recent fixes with IDs

#### Scenario: Limit undo depth

- **WHEN** undoing
- **THEN** the system SHALL limit undo to last 10 operations

### Requirement: Validate fixes

The system SHALL validate fixes after application.

#### Scenario: Verify fix success

- **WHEN** fix applied
- **THEN** the system SHALL verify the issue is resolved

#### Scenario: Detect fix side effects

- **WHEN** fix applied
- **THEN** the system SHALL check for unintended side effects

#### Scenario: Rollback on failure

- **WHEN** fix fails validation
- **THEN** the system SHALL rollback the fix

#### Scenario: Show validation results

- **WHEN** validation completes
- **THEN** the system SHALL show validation results
