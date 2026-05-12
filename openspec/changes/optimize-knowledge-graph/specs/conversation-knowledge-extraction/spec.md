## ADDED Requirements

### Requirement: Extract technical decisions from sessions

The system SHALL extract technical decisions from historical OpenCode sessions using signal word patterns.

#### Scenario: Identify decision signals

- **WHEN** session content contains phrases like "我决定...", "选择 X 因为...", "不用 Z 因为..."
- **THEN** the system SHALL flag it as a potential technical decision

#### Scenario: Extract decision content

- **WHEN** a decision is identified
- **THEN** the system SHALL extract: decision description, rationale, alternatives considered, and outcome

#### Scenario: Create decision entity

- **WHEN** a technical decision is extracted
- **THEN** the system SHALL create a decision entity with Chapter atoms (背景, 方案对比, 决策与理由, 实施与结果)

### Requirement: Extract problem solutions from sessions

The system SHALL extract problem solutions from historical sessions.

#### Scenario: Identify solution signals

- **WHEN** session content contains phrases like "根因是...", "修复方案...", "解决步骤..."
- **THEN** the system SHALL flag it as a potential problem solution

#### Scenario: Extract solution content

- **WHEN** a solution is identified
- **THEN** the system SHALL extract: problem description, root cause analysis, solution steps, and verification method

#### Scenario: Create solution entity

- **WHEN** a problem solution is extracted
- **THEN** the system SHALL create a solution entity with Chapter atoms (问题描述, 根因分析, 解决步骤, 验证结果)

### Requirement: Extract code patterns from sessions

The system SHALL extract code patterns and best practices from historical sessions.

#### Scenario: Identify pattern signals

- **WHEN** session content contains phrases like "模式是...", "每次都...", "习惯..."
- **THEN** the system SHALL flag it as a potential code pattern

#### Scenario: Extract pattern content

- **WHEN** a pattern is identified
- **THEN** the system SHALL extract: pattern name, applicable scenarios, implementation code, and pros/cons

#### Scenario: Create pattern entity

- **WHEN** a code pattern is extracted
- **THEN** the system SHALL create a pattern entity with Chapter atoms (模式概述, 适用场景, 实现代码, 优缺点)

### Requirement: Filter low-value content

The system SHALL filter out low-value content that does not meet quality criteria.

#### Scenario: Filter general tutorials

- **WHEN** content is a general tutorial (e.g., "如何安装 Node.js")
- **THEN** the system SHALL NOT extract it

#### Scenario: Filter common errors

- **WHEN** content is a common error with standard fix
- **THEN** the system SHALL NOT extract it

#### Scenario: Filter chitchat

- **WHEN** content is casual conversation without technical value
- **THEN** the system SHALL NOT extract it

### Requirement: Establish extraction rules

The system SHALL define and apply extraction rules based on signal words, confidence scoring, and content patterns.

#### Scenario: High confidence extraction

- **WHEN** content contains explicit decision signals AND is project-specific
- **THEN** the system SHALL mark it as high confidence and extract immediately

#### Scenario: Medium confidence extraction

- **WHEN** content contains implicit patterns OR behavior changes
- **THEN** the system SHALL mark it as medium confidence and queue for confirmation

#### Scenario: Low confidence rejection

- **WHEN** content is vague, generic, or lacks specific context
- **THEN** the system SHALL reject it
