# conversation-knowledge-extraction Specification

## Purpose

TBD - created by archiving change build-knowledge-graphs. Update Purpose after archive.

## Requirements

### Requirement: Extract valuable content from OpenCode sessions

The system SHALL automatically identify and extract valuable technical content from OpenCode conversation sessions, including technical decisions, problem solutions, code patterns, and best practices.

#### Scenario: Identify technical decision

- **WHEN** a session contains phrases like "我决定...", "选择 X 因为...", "不用 Z 因为..."
- **THEN** the system SHALL extract the decision description, rationale, alternatives considered, and outcome

#### Scenario: Identify problem solution

- **WHEN** a session contains phrases like "根因是...", "修复方案...", "解决步骤..."
- **THEN** the system SHALL extract the problem description, root cause analysis, solution steps, and verification method

#### Scenario: Identify code pattern

- **WHEN** a session contains phrases like "模式是...", "每次都...", "习惯..."
- **THEN** the system SHALL extract the pattern name, applicable scenarios, implementation code, and pros/cons

### Requirement: Organize extracted content into Entity-Atom structure

The system SHALL organize extracted conversation content into Entity-Atom hierarchical structure with appropriate entity types and atom relationships.

#### Scenario: Create decision entity

- **WHEN** extracting a technical decision
- **THEN** the system SHALL create an Entity of type `decision` with atoms: Chapter (背景), Chapter (方案对比), Chapter (决策与理由), Chapter (实施与结果)

#### Scenario: Create solution entity

- **WHEN** extracting a problem solution
- **THEN** the system SHALL create an Entity of type `solution` with atoms: Chapter (问题描述), Chapter (根因分析), Chapter (解决步骤), Chapter (验证结果)

#### Scenario: Create pattern entity

- **WHEN** extracting a code pattern
- **THEN** the system SHALL create an Entity of type `pattern` with atoms: Chapter (模式概述), Chapter (适用场景), Chapter (实现代码), Chapter (优缺点)

### Requirement: Filter low-value content

The system SHALL filter out low-value content that does not meet the "Google Test" criteria (content that can be found via Google search within 30 seconds).

#### Scenario: Filter general tutorials

- **WHEN** content is a general tutorial (e.g., "如何安装 Node.js")
- **THEN** the system SHALL NOT extract it

#### Scenario: Filter common errors

- **WHEN** content is a common error with standard fix (e.g., "undefined variable" errors)
- **THEN** the system SHALL NOT extract it

#### Scenario: Filter chitchat

- **WHEN** content is casual conversation without technical value
- **THEN** the system SHALL NOT extract it

### Requirement: Establish extraction rules

The system SHALL define and apply extraction rules based on signal words, confidence scoring, and content patterns.

#### Scenario: High confidence extraction

- **WHEN** content contains explicit decision signals ("我决定...") AND is project-specific
- **THEN** the system SHALL mark it as high confidence and extract immediately

#### Scenario: Medium confidence extraction

- **WHEN** content contains implicit patterns ("每次都...") OR behavior changes
- **THEN** the system SHALL mark it as medium confidence and queue for confirmation

#### Scenario: Low confidence rejection

- **WHEN** content is vague, generic, or lacks specific context
- **THEN** the system SHALL reject it
