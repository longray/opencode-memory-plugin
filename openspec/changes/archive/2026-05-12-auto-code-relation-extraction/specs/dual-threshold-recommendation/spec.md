## ADDED Requirements

### Requirement: Dual threshold strategy

The system SHALL use dual thresholds for automatic relationship creation.

#### Scenario: Auto-create high confidence relations

- **WHEN** a recommended relation has similarity >= 0.85
- **THEN** the system SHALL automatically create the relation without user confirmation

#### Scenario: Queue medium confidence relations

- **WHEN** a recommended relation has similarity >= 0.75 and < 0.85
- **THEN** the system SHALL add it to a pending review queue

#### Scenario: Ignore low confidence relations

- **WHEN** a recommended relation has similarity < 0.75
- **THEN** the system SHALL ignore the recommendation

#### Scenario: Configurable thresholds

- **WHEN** user configures custom thresholds (e.g., auto_create: 0.90, review: 0.80)
- **THEN** the system SHALL use the configured values

### Requirement: Pending review queue

The system SHALL maintain a queue of relations awaiting user review.

#### Scenario: Add to review queue

- **WHEN** a medium confidence relation is recommended
- **THEN** the system SHALL add it to the pending review queue with metadata

#### Scenario: Display review queue

- **WHEN** user requests to see pending relations
- **THEN** the system SHALL display the queue with similarity scores and entity abstracts

#### Scenario: Approve from queue

- **WHEN** user approves a pending relation
- **THEN** the system SHALL create the relation

#### Scenario: Reject from queue

- **WHEN** user rejects a pending relation
- **THEN** the system SHALL remove it from the queue and not create

#### Scenario: Auto-expire pending relations

- **WHEN** a pending relation is older than 7 days
- **THEN** the system SHALL automatically remove it from the queue

### Requirement: Relation recommendation trigger

The system SHALL automatically trigger relation recommendations.

#### Scenario: Trigger on new entity

- **WHEN** a new entity is created
- **THEN** the system SHALL automatically run relation recommendation for that entity

#### Scenario: Trigger on batch upload

- **WHEN** a batch of entities is uploaded
- **THEN** the system SHALL run relation recommendation for the batch

#### Scenario: Scheduled recommendation

- **WHEN** scheduled time is reached (e.g., weekly)
- **THEN** the system SHALL run full relation recommendation

#### Scenario: Manual trigger still works

- **WHEN** user manually runs relation recommendation
- **THEN** the system SHALL execute regardless of automatic triggers

### Requirement: Recommendation reporting

The system SHALL report recommendation results.

#### Scenario: Report auto-created count

- **WHEN** automatic recommendation completes
- **THEN** the system SHALL report how many relations were auto-created

#### Scenario: Report pending count

- **WHEN** recommendation completes
- **THEN** the system SHALL report how many relations are pending review

#### Scenario: Report ignored count

- **WHEN** recommendation completes
- **THEN** the system SHALL report how many recommendations were below threshold

#### Scenario: Display sample recommendations

- **WHEN** recommendation completes
- **THEN** the system SHALL display a sample of recommended relations with scores
