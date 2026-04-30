## ADDED Requirements

### Requirement: Context loading by Atom granularity
The system SHALL support loading context at Atom granularity instead of Entity granularity.

#### Scenario: Loading specific Atom content
- **WHEN** AI needs specific knowledge from a large Entity
- **THEN** it SHALL use `entity_atoms` to get tree structure
- **AND** it SHALL identify the specific Atom needed
- **AND** it SHALL load only that Atom's content

#### Scenario: Loading by level
- **WHEN** AI calls `loadContextByLevel(entryId, maxLevel: 2)`
- **THEN** the system SHALL return only Atoms with heading_level <= 2
- **AND** deeper Atoms SHALL be excluded
- **AND** the context SHALL be formatted as markdown

#### Scenario: Loading with parent context
- **WHEN** loading a specific Atom
- **THEN** the system SHALL optionally include parent chain
- **AND** the context SHALL include breadcrumbs (Parent > Child > Target)
- **AND** the full path SHALL provide necessary context

### Requirement: [[atom_id]] link resolution
The system SHALL support resolving [[local_id]] links to specific Atoms.

#### Scenario: Resolving atom link
- **WHEN** content contains `[[01A1B2C3]]`
- **THEN** the system SHALL resolve to the specific Atom
- **AND** it SHALL return Atom content and metadata
- **AND** it SHALL include parent Entity information

#### Scenario: Resolving with alias
- **WHEN** content contains `[[01A1B2C3|Display Name]]`
- **THEN** the system SHALL resolve the link
- **AND** it SHALL use "Display Name" as display text
- **AND** the underlying link SHALL point to 01A1B2C3

#### Scenario: Broken link detection
- **WHEN** content contains `[[invalid_id]]`
- **THEN** the system SHALL mark it as dead link
- **AND** it SHALL log the broken link
- **AND** it SHALL suggest similar valid links if available

#### Scenario: Incoming links discovery
- **WHEN** viewing an Atom
- **THEN** the system SHALL show incoming links (other Atoms linking to it)
- **AND** it SHALL display the linking context
- **AND** it SHALL support bidirectional navigation

### Requirement: Context budget management
The system SHALL manage context budget by selecting relevant Atoms.

#### Scenario: Budget-constrained context loading
- **WHEN** AI has limited context budget (e.g., 2000 tokens)
- **THEN** the system SHALL prioritize high-relevance Atoms
- **AND** it SHALL exclude low-relevance Atoms
- **AND** it SHALL provide summary of excluded content

#### Scenario: Relevance scoring
- **WHEN** selecting Atoms for context
- **THEN** the system SHALL score each Atom by relevance to query
- **AND** scores SHALL consider vector similarity + link proximity
- **AND** highest scoring Atoms SHALL be included first

#### Scenario: Progressive loading
- **WHEN** initial context is insufficient
- **THEN** the AI SHALL request additional specific Atoms
- **AND** the system SHALL load them on demand
- **AND** the total context SHALL stay within budget

### Requirement: Context compression by hierarchy
The system SHALL support compressing context by collapsing Atom hierarchies.

#### Scenario: Collapsing to overview
- **WHEN** AI needs quick understanding without details
- **THEN** the system SHALL provide Entity overview + Atom structure
- **AND** individual Atom contents SHALL be excluded
- **AND** the structure SHALL show what knowledge is available

#### Scenario: Expanding on demand
- **WHEN** AI identifies relevant Atom from overview
- **THEN** it SHALL request full content of specific Atom
- **AND** the system SHALL load only that Atom's content
- **AND** the context SHALL be updated incrementally

#### Scenario: Smart truncation
- **WHEN** Atom content exceeds reasonable length
- **THEN** the system SHALL provide truncated version
- **AND** it SHALL indicate truncation with "..."
- **AND** full content SHALL be available on demand

### Requirement: Cross-Entity Atom linking
The system SHALL support linking Atoms across different Entities.

#### Scenario: Linking to Atom in different Entity
- **WHEN** content references `[[entity_id/atom_id]]`
- **THEN** the system SHALL resolve cross-Entity link
- **AND** it SHALL load the target Atom content
- **AND** it SHALL maintain link graph across Entities

#### Scenario: Discovering related Entities
- **WHEN** viewing an Entity
- **THEN** the system SHALL show related Entities via Atom links
- **AND** relations SHALL be weighted by link strength
- **AND** strongest relations SHALL be shown first
