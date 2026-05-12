## ADDED Requirements

### Requirement: Global name extraction

The system SHALL extract all exported symbols (functions, classes, variables) from code files during analysis.

#### Scenario: Extract function exports

- **WHEN** analyzing a file with `export function foo() {}`
- **THEN** the system SHALL record 'foo' as an exported symbol with its entity ID

#### Scenario: Extract class exports

- **WHEN** analyzing a file with `export class MyClass {}`
- **THEN** the system SHALL record 'MyClass' as an exported symbol

#### Scenario: Extract default exports

- **WHEN** analyzing a file with `export default function() {}`
- **THEN** the system SHALL record 'default' as an exported symbol

#### Scenario: Extract named exports

- **WHEN** analyzing a file with `export { foo, bar }`
- **THEN** the system SHALL record both 'foo' and 'bar' as exported symbols

### Requirement: Global name mapping

The system SHALL maintain a mapping from global symbol names to their entity IDs.

#### Scenario: Build global name table

- **WHEN** uploading a batch of code files
- **THEN** the system SHALL build a Map of exported symbol names to their entity IDs

#### Scenario: Handle name collisions

- **WHEN** two files export the same name (e.g., both export 'utils')
- **THEN** the system SHALL use the file path as a namespace (e.g., 'utils', 'lib/utils')

#### Scenario: Lookup symbol by name

- **WHEN** creating a calls relationship
- **THEN** the system SHALL look up the target entity ID using the function name

### Requirement: Cross-file call resolution

The system SHALL resolve function calls to their target entities across file boundaries.

#### Scenario: Resolve direct call

- **WHEN** file A calls `foo()` and file B exports `function foo()`
- **THEN** the system SHALL create a calls relationship from A to B

#### Scenario: Resolve imported call

- **WHEN** file A imports `import { foo } from './utils'` and calls `foo()`
- **THEN** the system SHALL resolve the call to the utils file's foo function

#### Scenario: Handle unresolved calls

- **WHEN** a call target cannot be resolved (e.g., built-in function)
- **THEN** the system SHALL skip the relationship creation

### Requirement: Symbol table cache management

The system SHALL manage the symbol table cache with size limits and LRU eviction.

#### Scenario: Cache size limit

- **WHEN** the symbol table exceeds 10,000 entries
- **THEN** the system SHALL evict least recently used entries

#### Scenario: Cache invalidation

- **WHEN** a file is modified
- **THEN** the system SHALL invalidate the cached symbols for that file
