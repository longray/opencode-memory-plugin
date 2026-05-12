## ADDED Requirements

### Requirement: Scan historical sessions for additional knowledge

The system SHALL scan historical OpenCode sessions to extract additional technical decisions, solutions, and patterns.

#### Scenario: Scan sessions from last 3 months

- **WHEN** scanning for knowledge
- **THEN** the system SHALL scan sessions from the last 90 days

#### Scenario: Filter already extracted sessions

- **WHEN** scanning sessions
- **THEN** the system SHALL skip sessions already processed (check by session_id)

#### Scenario: Prioritize high-value sessions

- **WHEN** selecting sessions
- **THEN** the system SHALL prioritize sessions with >10 messages and technical content

### Requirement: Extract additional technical decisions

The system SHALL extract additional technical decisions from historical sessions.

#### Scenario: Identify architectural decisions

- **WHEN** scanning session content
- **THEN** the system SHALL identify architectural decisions ("我们决定采用...", "架构选择...")

#### Scenario: Identify technology choices

- **WHEN** scanning session content
- **THEN** the system SHALL identify technology choices ("选择 X 而不是 Y", "技术栈...")

#### Scenario: Identify design patterns

- **WHEN** scanning session content
- **THEN** the system SHALL identify design pattern decisions ("采用单例模式", "使用工厂模式...")

#### Scenario: Create decision entities

- **WHEN** a decision is identified
- **THEN** the system SHALL create decision entity with Chapter atoms

### Requirement: Extract additional problem solutions

The system SHALL extract additional problem solutions from historical sessions.

#### Scenario: Identify bug fixes

- **WHEN** scanning session content
- **THEN** the system SHALL identify bug fix solutions ("修复了...", "解决了...问题")

#### Scenario: Identify performance optimizations

- **WHEN** scanning session content
- **THEN** the system SHALL identify performance solutions ("优化了...", "提升了性能...")

#### Scenario: Identify compatibility solutions

- **WHEN** scanning session content
- **THEN** the system SHALL identify compatibility solutions ("向后兼容...", "适配...")

#### Scenario: Create solution entities

- **WHEN** a solution is identified
- **THEN** the system SHALL create solution entity with Chapter atoms

### Requirement: Extract additional code patterns

The system SHALL extract additional code patterns from historical sessions.

#### Scenario: Identify error handling patterns

- **WHEN** scanning session content
- **THEN** the system SHALL identify error handling patterns ("错误处理模式...", "异常捕获...")

#### Scenario: Identify async patterns

- **WHEN** scanning session content
- **THEN** the system SHALL identify async patterns ("异步处理...", "Promise模式...")

#### Scenario: Identify testing patterns

- **WHEN** scanning session content
- **THEN** the system SHALL identify testing patterns ("测试模式...", "Mock策略...")

#### Scenario: Create pattern entities

- **WHEN** a pattern is identified
- **THEN** the system SHALL create pattern entity with Chapter atoms

### Requirement: Deduplicate extracted knowledge

The system SHALL deduplicate extracted knowledge to avoid creating duplicate entities.

#### Scenario: Check for existing decisions

- **WHEN** extracting a decision
- **THEN** the system SHALL check if similar decision already exists (by title/content similarity)

#### Scenario: Check for existing solutions

- **WHEN** extracting a solution
- **THEN** the system SHALL check if similar solution already exists

#### Scenario: Check for existing patterns

- **WHEN** extracting a pattern
- **THEN** the system SHALL check if similar pattern already exists

#### Scenario: Merge similar entities

- **WHEN** duplicates are found
- **THEN** the system SHALL merge or skip based on similarity threshold (>0.9)

### Requirement: Validate extracted knowledge quality

The system SHALL validate the quality of extracted knowledge before creating entities.

#### Scenario: Validate decision completeness

- **WHEN** extracting a decision
- **THEN** the system SHALL verify it has: context, options, rationale, outcome

#### Scenario: Validate solution completeness

- **WHEN** extracting a solution
- **THEN** the system SHALL verify it has: problem, root cause, steps, verification

#### Scenario: Validate pattern completeness

- **WHEN** extracting a pattern
- **THEN** the system SHALL verify it has: name, scenario, implementation, pros/cons

#### Scenario: Reject incomplete knowledge

- **WHEN** knowledge is incomplete
- **THEN** the system SHALL reject it and log reason
