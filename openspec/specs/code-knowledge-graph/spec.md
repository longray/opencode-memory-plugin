# code-knowledge-graph Specification

## Purpose

TBD - created by archiving change build-knowledge-graphs. Update Purpose after archive.

## Requirements

### Requirement: Analyze project code structure

The system SHALL analyze the project codebase to extract functions, classes, modules, and their relationships using code analysis tools.

#### Scenario: Analyze JavaScript/TypeScript files

- **WHEN** the system encounters `.js`, `.ts`, `.mjs`, `.cjs` files
- **THEN** it SHALL parse AST to extract functions, classes, imports, exports, and call relationships

#### Scenario: Analyze Python files

- **WHEN** the system encounters `.py` files
- **THEN** it SHALL parse AST to extract functions, classes, imports, and function calls

#### Scenario: Analyze Go files

- **WHEN** the system encounters `.go` files
- **THEN** it SHALL parse AST to extract functions, structs, interfaces, imports, and function calls

### Requirement: Extract code entities

The system SHALL extract code entities including functions, classes, modules, and their metadata (name, parameters, return types, documentation).

#### Scenario: Extract function information

- **WHEN** analyzing a function definition
- **THEN** the system SHALL extract: function name, parameters with types, return type, docstring/comments, and function body summary

#### Scenario: Extract class information

- **WHEN** analyzing a class definition
- **THEN** the system SHALL extract: class name, parent classes, methods (with signatures), attributes, and class docstring

#### Scenario: Extract module information

- **WHEN** analyzing a file/module
- **THEN** the system SHALL extract: module name, file path, imports, exports, and top-level functions/classes

### Requirement: Build code relationship graph

The system SHALL build relationships between code entities including call relationships, inheritance, imports, and dependencies.

#### Scenario: Map function calls

- **WHEN** a function calls another function
- **THEN** the system SHALL create a "calls" relationship between caller and callee

#### Scenario: Map class inheritance

- **WHEN** a class extends/implements another class
- **THEN** the system SHALL create an "inherits" relationship between child and parent

#### Scenario: Map module dependencies

- **WHEN** a module imports from another module
- **THEN** the system SHALL create an "imports" relationship between importer and imported

### Requirement: Organize code knowledge into Entity-Atom structure

The system SHALL organize code analysis results into Entity-Atom hierarchical structure with appropriate entity types.

#### Scenario: Create module entity

- **WHEN** analyzing a code module
- **THEN** the system SHALL create an Entity of type `code_module` with atoms: Chapter (模块概述), Chapter (导出列表), Chapter (依赖关系)

#### Scenario: Create function entity

- **WHEN** analyzing a function
- **THEN** the system SHALL create an Entity of type `code_function` with atoms: Chapter (函数签名), Chapter (参数说明), Chapter (返回值), Chapter (实现逻辑), Chapter (调用关系)

#### Scenario: Create class entity

- **WHEN** analyzing a class
- **THEN** the system SHALL create an Entity of type `code_class` with atoms: Chapter (类定义), Chapter (继承关系), Chapter (方法列表), Chapter (属性列表), Chapter (使用示例)

### Requirement: Support incremental code analysis

The system SHALL support incremental analysis to update the code knowledge graph when files change.

#### Scenario: Detect file changes

- **WHEN** a file is modified, added, or deleted
- **THEN** the system SHALL detect the change and trigger re-analysis of affected entities

#### Scenario: Update knowledge graph

- **WHEN** re-analyzing a changed file
- **THEN** the system SHALL update existing entities or create new ones, and update related relationships
