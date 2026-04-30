## ADDED Requirements

### Requirement: The Observer automatically extracts Atom structures
The `agents/memory-automation.md` (The Observer) SHALL automatically extract hierarchical knowledge from conversations.

#### Scenario: Structured conversation detected
- **WHEN** The Observer analyzes a conversation with clear topic hierarchy
- **THEN** it SHALL identify main topics as chapter-level Atoms
- **AND** it SHALL identify sub-topics as section-level Atoms
- **AND** it SHALL identify specific details as note-level Atoms

#### Scenario: Code discussion extraction
- **WHEN** conversation involves code patterns or architecture decisions
- **THEN** The Observer SHALL create function/class type Atoms
- **AND** it SHALL extract key decisions as note Atoms
- **AND** it SHALL link related concepts with [[atom_id]] references

#### Scenario: User confirmation before saving
- **WHEN** The Observer builds Atom tree candidate
- **THEN** it SHALL present the tree structure to user
- **AND** it SHALL wait for user confirmation before saving
- **AND** it SHALL allow user to edit the structure before saving

#### Scenario: Simple content (no hierarchy)
- **WHEN** conversation content is simple (<500 chars, no clear hierarchy)
- **THEN** The Observer SHALL use flat storage (no atoms)
- **AND** it SHALL not force Atom structure where unnecessary

### Requirement: The Librarian consolidates by Atom granularity
The `agents/memory-consolidate.md` (The Librarian) SHALL consolidate fragmented memories at Atom granularity.

#### Scenario: Weekly consolidation
- **WHEN** The Librarian runs weekly consolidation
- **THEN** it SHALL scan memories from past 7 days
- **AND** it SHALL group related memories by topic
- **AND** it SHALL create consolidated Entity with Atom tree

#### Scenario: Creating knowledge tree
- **WHEN** consolidating related memories
- **THEN** The Librarian SHALL create chapter Atoms for main topics
- **AND** it SHALL create section Atoms for sub-topics
- **AND** it SHALL distribute source memory content to appropriate Atoms

#### Scenario: Establishing relationships
- **WHEN** creating consolidated Entity
- **THEN** The Librarian SHALL create "summarizes" relations
- **AND** source memories SHALL link to consolidated Atoms
- **AND** the relation graph SHALL preserve knowledge provenance

#### Scenario: Marking source memories
- **WHEN** consolidation is complete
- **THEN** The Librarian SHALL update source memories
- **AND** it SHALL add "consolidated" tag or metadata
- **AND** it SHALL prevent duplicate consolidation

### Requirement: Code analysis links to conversation memory
The code analysis service SHALL automatically link analysis results to recent conversation memories.

#### Scenario: File saved and analyzed
- **WHEN** user saves a file and code analysis runs
- **THEN** the system SHALL search for recent related conversations
- **AND** if found, it SHALL create "analyzes" relation
- **AND** the analysis Entity SHALL link to conversation Entity

#### Scenario: No related conversation found
- **WHEN** code analysis completes but no related conversation exists
- **THEN** the system SHALL create standalone analysis Entity
- **AND** it SHALL not create any relations
- **AND** future conversations can link to it

#### Scenario: Multiple related conversations
- **WHEN** multiple recent conversations relate to the analyzed file
- **THEN** the system SHALL link to the most relevant one
- **AND** it SHALL use semantic similarity to determine relevance
- **AND** it SHALL log the linking decision

### Requirement: Atom extraction heuristics
The system SHALL provide clear heuristics for automatic Atom extraction.

#### Scenario: Content length heuristic
- **WHEN** content exceeds 1000 characters
- **THEN** the system SHALL consider Atom structure
- **AND** it SHALL analyze for hierarchical patterns

#### Scenario: Heading detection heuristic
- **WHEN** content contains markdown headings (##, ###)
- **THEN** the system SHALL use headings as Atom boundaries
- **AND** heading level SHALL determine Atom type

#### Scenario: List detection heuristic
- **WHEN** content contains structured lists
- **THEN** the system SHALL consider list items as potential Atoms
- **AND** parent item SHALL be chapter, children SHALL be sections

#### Scenario: Code block heuristic
- **WHEN** content contains code blocks
- **THEN** the system SHALL create separate Atoms for each code block
- **AND** type SHALL be "code" or "function" as appropriate
