# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2026-04-13

### Added

#### WebSocket Real-Time Sync
- Reliable WebSocket client with heartbeat mechanism (30s interval, 5s timeout)
- Exponential backoff reconnection (1s → 2s → 4s... up to 300s)
- ACK message confirmation system with timeout and retry
- State management (CLOSED, CONNECTING, CONNECTED, RECONNECTING)
- WebSocket performance benchmark tool

#### Memory Tools
- Added `memory_read` tool with level support (0=abstract, 1=overview, 2=full)
- Updated `memory_write` to use v3.2 API format with tenant_id support

#### Structured Logging
- Integrated pino for structured logging
- Support for JSON and pretty print modes
- Configurable log levels (debug, info, warn, error)
- Environment variable `LOG_LEVEL` and `LOG_PRETTY` support

#### Environment Configuration
- Added `lib/config.js` for centralized configuration management
- dotenv support for `.env` file loading
- New environment variables:
  - `API_PORT` - API server port (default: 18008)
  - `LOG_LEVEL` - Logging level
  - `LOG_PRETTY` - Pretty print logs
  - `WS_ENABLED` - WebSocket enabled
  - `WS_HEARTBEAT_INTERVAL` - Heartbeat interval
  - `WS_RECONNECT_MAX_ATTEMPTS` - Max reconnection attempts
  - `AUTO_SYNC` - Auto sync enabled
  - `SYNC_INTERVAL` - Sync interval

#### Testing
- Added 38 new test cases for code analysis module
- Tree-sitter multi-language parser tests (Python, Go, Rust, Java)
- ProjectAnalyzer tests (metrics, risks, grade calculation)
- AnalysisQueue tests
- Edge case tests for JavaScript features

### Changed

#### Port Migration
- Default API port changed from 17999 to 18008
- Backward compatible: use `API_PORT=17999` or `MEMORY_BACKEND_URL` for old port
- Updated all documentation and configuration examples

#### Dependencies
- Added `pino` ^9.5.0 for structured logging
- Added `dotenv` ^16.4.5 for environment configuration
- Added `pino-pretty` ^13.0.0 (dev dependency)
- Added `@types/ws` ^8.5.13 (dev dependency)
- Updated `ws` to ^8.20.0

#### Documentation
- Updated README.md with v3.2.0 features
- Updated CONFIGURATION.md with new environment variables
- Updated TROUBLESHOOTING.md with v3.2 migration FAQ
- Updated README.npm.md with feature list

### Fixed

- Fixed duplicate heading in README.md (MD024 lint error)
- Fixed test compatibility with Tree-sitter WASM initialization

## [2.9.1] - 2026-03-23

### Added

- Initial release with core memory functionality
- 15 memory tools (write, read, search, sync, graph)
- L0/L1/L2 layered storage
- Semantic search with vector + BM25 hybrid
- Code analysis for JavaScript, TypeScript, Python, Go, Rust, Java
- WebSocket real-time sync (basic implementation)
- Conflict resolution
- Graph relations
- Memory browsing (timeline and topics)
- Project isolation with tenant_id and project_id

[3.2.0]: https://github.com/csuwl/opencode-memory-plugin/releases/tag/v3.2.0
[2.9.1]: https://github.com/csuwl/opencode-memory-plugin/releases/tag/v2.9.1
