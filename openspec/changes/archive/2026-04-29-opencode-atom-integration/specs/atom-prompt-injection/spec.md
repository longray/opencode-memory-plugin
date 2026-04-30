## ADDED Requirements

### Requirement: SOUL.md includes Atom Architecture awareness
The `memory/SOUL.md` file SHALL include comprehensive documentation about Atom Architecture for AI agents.

#### Scenario: Agent reads SOUL.md on startup
- **WHEN** OpenCode loads the memory plugin and injects SOUL.md into system prompt
- **THEN** the AI SHALL understand what Atom Architecture is
- **AND** the AI SHALL know when to use Atom structures vs flat content
- **AND** the AI SHALL understand the hierarchy (Entity → Chapter → Section → Detail)

#### Scenario: Agent decides storage format
- **WHEN** AI needs to save structured knowledge (>1000 chars or has clear hierarchy)
- **THEN** the AI SHALL choose to create Atom tree structure
- **AND** the AI SHALL use appropriate Atom types (chapter, section, function, note)
- **AND** the AI SHALL set proper parent-child relationships

#### Scenario: Agent creates Atom tree
- **WHEN** AI creates memory with Atom structure
- **THEN** the AI SHALL generate unique local_id for each Atom
- **AND** the AI SHALL set order values for sibling ordering
- **AND** the AI SHALL limit depth to maximum 4 levels

### Requirement: AGENTS.md defines Atom operation guidelines
The `memory/AGENTS.md` file SHALL include specific guidelines for Atom operations.

#### Scenario: The Observer extracts conversation to Atoms
- **WHEN** The Observer analyzes a conversation for memory-worthy content
- **THEN** it SHALL identify if content has hierarchical structure
- **AND** if structured, it SHALL build Atom tree candidate
- **AND** it SHALL present the tree structure to user for confirmation

#### Scenario: The Librarian consolidates memories
- **WHEN** The Librarian consolidates fragmented memories
- **THEN** it SHALL create consolidated Entity with Atom tree
- **AND** it SHALL relate source memories to consolidated nodes
- **AND** it SHALL use "summarizes" relation type

#### Scenario: Agent uses [[atom_id]] links
- **WHEN** AI references previously saved knowledge
- **THEN** it SHALL use [[local_id]] format for precise referencing
- **AND** it SHALL prefer linking to specific Atoms over entire Entities
- **AND** it SHALL verify the linked Atom exists before referencing

### Requirement: TOOLS.md documents Atom tool usage
The `memory/TOOLS.md` file SHALL include detailed examples of Atom tool usage.

#### Scenario: Developer reads tool documentation
- **WHEN** developer or AI agent reads TOOLS.md
- **THEN** they SHALL find clear examples of memory_write with atoms
- **AND** they SHALL find examples of entity_update batch operations
- **AND** they SHALL find examples of entity_atoms retrieval
- **AND** they SHALL find examples of atom-scoped search

#### Scenario: AI learns Atom best practices
- **WHEN** AI reads TOOLS.md Atom section
- **THEN** it SHALL learn recommended Atom size (200-500 chars)
- **AND** it SHALL learn maximum depth (4 levels)
- **AND** it SHALL learn when to use different Atom types
- **AND** it SHALL learn how to create [[atom_id]] links

### Requirement: Prompt injection is versioned
The Atom Architecture documentation in prompt files SHALL include version information.

#### Scenario: Checking documentation version
- **WHEN** reading SOUL.md, AGENTS.md, or TOOLS.md
- **THEN** the AI SHALL see version number (e.g., "Atom Architecture v3.3")
- **AND** the AI SHALL see last updated date
- **AND** the AI SHALL see what's new in this version

#### Scenario: Backward compatibility notice
- **WHEN** reading Atom documentation
- **THEN** the AI SHALL see that atoms parameter is optional
- **AND** the AI SHALL understand flat storage is still supported
- **AND** the AI SHALL understand when to prefer each approach
