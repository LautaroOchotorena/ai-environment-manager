# Changelog
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.0.7] - 2026-06-07
### Added
- "Use Prepared Terminal for Commands" now generates a Cursor rule (`.cursor/rules/ai-environment-manager.mdc`) that instructs the AI agent to activate the correct environment before running any terminal command. This fixes compatibility with Cursor, whose agent runs commands in a fresh shell ignoring terminal profiles.
- WSL-aware Cursor rule: when the platform is WSL and the host is Windows, the generated rule instructs the agent to wrap all commands with `wsl.exe bash -lc "..."`.
- Only generate the Cursor rule when the extension is running in Cursor (detected via `vscode.env.appName`, `vscode.env.appHost`, and `vscode.env.uriScheme`).
### Fixed
- Fixed "Use Prepared Terminal for Commands" aborting early in Cursor due to a configuration write error, which prevented terminal profiles from being set.
### Removed
- Removed `autoActivateTerminals` setting and `onDidOpenTerminal` listener, which caused race conditions with shell initialization.

## [0.0.6] - 2026-06-05
### Changed
- Improved compatibility with VS Code-compatible editors such as Cursor, Windsurf, and VSCodium.
- Lowered the minimum required VS Code engine version to `^1.55.0`.
- Aligned `@types/vscode` to `^1.55.0` to match the minimum engine.
- No functional changes to extension behavior.

## [0.0.5] - 2026-06-01
### Fixed
- Fixed environment export on Windows.

## [0.0.1] - 2026-05-31
### Added
- Initial release.