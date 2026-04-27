## ADDED Requirements

### Requirement: Atomic text file write

The system SHALL provide a function to atomically write text files with EXDEV fallback support.

#### Scenario: Successful atomic write

- **WHEN** `atomicWriteText(filePath, content)` is called
- **THEN** content is written to a temporary file
- **AND** the temporary file is renamed to the target path
- **AND** the operation returns successfully

#### Scenario: EXDEV fallback on cross-device move

- **WHEN** `atomicWriteText(filePath, content)` is called
- **AND** the rename operation fails with EXDEV error
- **THEN** the system SHALL copy the temporary file to the target path
- **AND** delete the temporary file
- **AND** the operation returns successfully

#### Scenario: Write failure handling

- **WHEN** `atomicWriteText(filePath, content)` is called
- **AND** a non-EXDEV error occurs
- **THEN** the system SHALL throw an error with descriptive message
- **AND** clean up any temporary files

### Requirement: Atomic JSON file write

The system SHALL provide a function to atomically write JSON files with automatic serialization.

#### Scenario: Successful JSON write

- **WHEN** `atomicWriteJson(filePath, data)` is called with a JavaScript object
- **THEN** the data is serialized to JSON with formatting
- **AND** the JSON is atomically written to the file
- **AND** the operation returns successfully

#### Scenario: JSON serialization error

- **WHEN** `atomicWriteJson(filePath, data)` is called with circular references
- **THEN** the system SHALL throw a serialization error
- **AND** no file is created or modified

### Requirement: Sensitive data redaction in logs

The system SHALL redact sensitive information from log entries.

#### Scenario: API key redaction

- **WHEN** `writeLog()` is called with data containing `api_key: "secret123"`
- **THEN** the log entry SHALL contain `[REDACTED]` instead of the actual key
- **AND** other non-sensitive data is preserved

#### Scenario: Token redaction

- **WHEN** `writeLog()` is called with data containing `token: "abc123"`
- **THEN** the log entry SHALL contain `[REDACTED]` instead of the actual token
- **AND** other non-sensitive data is preserved

#### Scenario: Password redaction

- **WHEN** `writeLog()` is called with data containing `password: "mypass"`
- **THEN** the log entry SHALL contain `[REDACTED]` instead of the actual password
- **AND** other non-sensitive data is preserved
