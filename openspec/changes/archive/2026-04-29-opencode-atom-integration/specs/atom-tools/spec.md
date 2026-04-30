## ADDED Requirements

### Requirement: memory_write supports atoms parameter
The `memory_write` tool SHALL accept an optional `atoms` parameter to create hierarchical knowledge structures.

#### Scenario: Creating memory with Atom tree
- **WHEN** user calls `memory_write` with `atoms` parameter containing valid Atom definitions
- **THEN** the system SHALL create an Entity with the specified Atom tree structure
- **AND** each Atom SHALL have a unique `local_id` within the Entity
- **AND** parent-child relationships SHALL be established via `parent_id`

#### Scenario: Creating memory without atoms (backward compatibility)
- **WHEN** user calls `memory_write` without `atoms` parameter
- **THEN** the system SHALL create a flat Entity as before
- **AND** existing code SHALL continue to work without modification

#### Scenario: Invalid atoms structure
- **WHEN** user provides `atoms` with circular parent references
- **THEN** the system SHALL reject the request with error "Circular reference detected"
- **AND** no Entity SHALL be created

### Requirement: entity_update tool for batch Atom operations
The system SHALL provide an `entity_update` tool to perform batch operations on Entity Atoms.

#### Scenario: Adding new Atoms to existing Entity
- **WHEN** user calls `entity_update` with `atoms_batch` containing action "add"
- **THEN** the system SHALL add the specified Atoms to the Entity
- **AND** parent-child relationships SHALL be validated
- **AND** order values SHALL be auto-generated if not provided

#### Scenario: Updating existing Atoms
- **WHEN** user calls `entity_update` with `atoms_batch` containing action "update"
- **THEN** the system SHALL update the specified Atom fields
- **AND** only provided fields SHALL be modified
- **AND** `local_id` SHALL remain immutable

#### Scenario: Removing Atoms with cascade
- **WHEN** user calls `entity_update` with `atoms_batch` containing action "remove" and `cascade: true`
- **THEN** the system SHALL remove the Atom and all its descendants
- **AND** the operation SHALL be atomic (all or nothing)

#### Scenario: Removing Atoms without cascade
- **WHEN** user calls `entity_update` with action "remove" and `cascade: false` on Atom with children
- **THEN** the system SHALL reject with error "Atom has children, use cascade: true"

### Requirement: entity_atoms tool for retrieving Atom tree
The system SHALL provide an `entity_atoms` tool to retrieve the Atom tree structure of an Entity.

#### Scenario: Retrieving full Atom tree
- **WHEN** user calls `entity_atoms` with `entry_id` and `include_content: true`
- **THEN** the system SHALL return the complete Atom tree with all content
- **AND** the tree SHALL be properly nested via `children` arrays
- **AND** Atoms SHALL be sorted by `order` within each level

#### Scenario: Retrieving Atom structure without content
- **WHEN** user calls `entity_atoms` with `include_content: false`
- **THEN** the system SHALL return the Atom tree structure without content fields
- **AND** the response SHALL be smaller and faster

#### Scenario: Entity has no Atoms
- **WHEN** user calls `entity_atoms` on Entity without Atoms
- **THEN** the system SHALL return empty array `[]`
- **AND** the response SHALL indicate success

### Requirement: memory_search supports Atom scope
The `memory_search` tool SHALL support searching at Atom granularity.

#### Scenario: Searching with scope "atom"
- **WHEN** user calls `memory_search` with `scope: "atom"`
- **THEN** the system SHALL return matching Atoms instead of Entities
- **AND** each result SHALL include `entity_id` and `local_id`
- **AND** results SHALL include Atom-specific metadata (type, name, etc.)

#### Scenario: Filtering by atom_types
- **WHEN** user calls `memory_search` with `atom_types: ["function", "class"]`
- **THEN** the system SHALL only return Atoms of specified types
- **AND** other Atom types SHALL be excluded from results

#### Scenario: Atom search with hybrid mode
- **WHEN** user calls `memory_search` with `mode: "hybrid"` and `scope: "atom"`
- **THEN** the system SHALL use vector + keyword search on Atom content
- **AND** results SHALL be ranked by relevance score

### Requirement: syncMemoryToBackend synchronizes atoms
The `syncMemoryToBackend` function SHALL synchronize Atom data to the backend.

#### Scenario: Syncing Entity with Atoms
- **WHEN** `writeAndSyncMemory` is called with `atoms` parameter
- **THEN** the system SHALL include `atoms` in the sync payload
- **AND** the backend SHALL receive complete Atom tree data
- **AND** the local file SHALL maintain the Atom structure

#### Scenario: Syncing Entity without Atoms
- **WHEN** `writeAndSyncMemory` is called without `atoms` parameter
- **THEN** the system SHALL sync only Entity-level data
- **AND** the sync SHALL complete successfully
