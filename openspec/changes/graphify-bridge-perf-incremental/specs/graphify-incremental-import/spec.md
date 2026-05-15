## ADDED Requirements

### Requirement: Graph diff algorithm

The system SHALL compute a diff between the current and previous `graph.json` to identify added, removed, and changed nodes and links.

#### Scenario: Detect new file

- **WHEN** new graph.json contains a node with `id: "src/newfile.js"` that does not exist in cached graph.json
- **THEN** the diff result SHALL include this node in `addedNodes`

#### Scenario: Detect removed function

- **WHEN** cached graph.json contains a node with `id: "src/utils.js:helper"` that does not exist in new graph.json
- **THEN** the diff result SHALL include this node in `removedNodes`

#### Scenario: Detect changed function (source_location moved)

- **WHEN** a node exists in both graphs with same `id` but different `source_location`
- **THEN** the diff result SHALL include this node in `changedNodes`

#### Scenario: Detect unchanged node

- **WHEN** a node exists in both graphs with same `id` and identical `label`, `source_file`, `source_location`, and `file_type`
- **THEN** the diff result SHALL NOT include this node in any change set

#### Scenario: Detect link changes

- **WHEN** a link with same `source + target + relation` exists in both graphs
- **THEN** the diff result SHALL NOT include this link in `addedLinks` or `removedLinks`

### Requirement: Local cache file

The system SHALL save the current graph.json state to `.graphify-cache.json` after a successful import.

#### Scenario: Cache created after full import

- **WHEN** a full import completes successfully
- **THEN** the system SHALL write `.graphify-cache.json` containing all nodes and links with their content hashes

#### Scenario: Cache updated after incremental import

- **WHEN** an incremental import completes successfully
- **THEN** the system SHALL merge the changes into `.graphify-cache.json` (add new nodes, remove deleted nodes, update changed nodes)

#### Scenario: Cache corruption fallback

- **WHEN** `.graphify-cache.json` exists but cannot be parsed as valid JSON
- **THEN** the system SHALL log a warning and fall back to full import

### Requirement: Incremental import flow

The system SHALL import only added and changed nodes/links, and delete removed nodes/links.

#### Scenario: Incremental import with changes

- **WHEN** incremental import runs and diff shows 5 added nodes, 3 changed nodes, 2 removed nodes, and 10 added links
- **THEN** the system SHALL create 5+3 nodes, delete 2 nodes, create 10 links, and skip all unchanged items

#### Scenario: Incremental import with no changes

- **WHEN** incremental import runs and diff shows no changes
- **THEN** the system SHALL skip all import steps and return immediately with zero counts

#### Scenario: Changed node triggers delete+recreate+remap

- **WHEN** a node is marked as "changed" (same graphify ID, different content hash)
- **THEN** the system SHALL delete the old backend atom/entity, create a new one, update the ID mapping (graphify_id → new backend_id), and recreate all links referencing this node

#### Scenario: Links referencing changed nodes are recreated

- **WHEN** 3 nodes are marked as "changed" and get new backend IDs
- **THEN** the system SHALL identify all links whose source or target is a changed node, delete the old references, and create new references using the updated backend IDs

#### Scenario: Incremental deletion cascade

- **WHEN** a removed node is an entity (file-level)
- **THEN** the system SHALL query all atoms belonging to that entity and all references involving those atoms, then delete them in order: References → Atoms → Entity. If the backend supports cascading delete, this step SHALL be simplified to a single entity delete call.

### Requirement: CLI incremental mode

The system SHALL support `--incremental` (default) and `--full` flags on the `graphify` CLI command.

#### Scenario: Default incremental mode

- **WHEN** user runs `opencode-memory graphify` without flags
- **THEN** the system SHALL attempt incremental import if `.graphify-cache.json` exists, otherwise fall back to full import

#### Scenario: Force full import

- **WHEN** user runs `opencode-memory graphify --full`
- **THEN** the system SHALL perform full import (delete all + recreate) regardless of cache existence

#### Scenario: Explicit incremental with no cache

- **WHEN** user runs `opencode-memory graphify --incremental` but no `.graphify-cache.json` exists
- **THEN** the system SHALL fall back to full import and log an informational message
