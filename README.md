# AI Environment Manager

Keep AI tools and terminals aligned with the exact Python environment used by your project. Select your platform (Windows, WSL/Linux, or macOS), choose Conda or venv/virtualenv, and let the extension handle the rest.

## Why this extension

AI assistants and terminals often run in the wrong Python environment, leading to missing dependencies, incorrect interpreters, and inconsistent results.

This extension makes the active environment explicit, reproducible, and easy to switch across platforms.

## Quick start

1. Open a workspace folder.
2. Run **AI Environment Manager: Configure Environment**.
3. Select platform and environment type.
4. Pick a Conda env or enter a venv path.

You will see the active environment in the status bar and can open prepared terminals from there.

## Features

- Guided first-run setup for platform and environment configuration (optional; can be disabled per workspace).
- Automatic Conda environment discovery (Windows, WSL/Linux, macOS).
- Support for venv / virtualenv via workspace-relative paths (e.g. .venv).
- Status bar indicator showing active platform and environment.
- Prepared terminal launcher with optional default terminal integration.
- Automatic Cursor rule generation (`.cursor/rules/ai-environment-manager.mdc`) **when running in Cursor**, so Cursor's AI agent activates the correct environment before running commands.
- Automatic Codex integration **when the Codex extension is installed**: running **Use Prepared Terminal for Commands** generates or updates `AGENTS.md` and `.codex/config.toml`, and sets the WSL workspace setting when needed.
- Environment verification via VS Code Output Channel.
- Export requirements.txt for Conda and venv environments.
- Export environment.yml for Conda environments.

## Status bar menu

Click the status bar item to open the action menu, which includes setup, environment verification, terminal actions, and export utilities.

When using venv, the Export environment.yml option is automatically hidden.

## Automatic setup prompt

When a workspace has no platform or Python environment configured, the extension opens the setup panel on startup. To disable this for a project, either:

- Choose **Don't Show Again** when you dismiss the automatic prompt, or
- Set `aiEnvironmentManager.promptOnMissingEnvironment` to `false` in workspace settings.

You can still configure the environment anytime from the status bar (**⚠ Configure Environment**) or via **AI Environment Manager: Configure Environment**.

## Export your environment

The extension can generate environment files in the workspace root:

- **requirements.txt**: available for Conda and venv/virtualenv. Runs `python -m pip freeze` in the configured environment.
- **environment.yml**: available only for Conda. Runs `conda env export --no-builds`.

If the file already exists, you will be asked to confirm overwriting it.

## Commands

- AI Environment Manager: Configure Environment
- AI Environment Manager: Change Platform
- AI Environment Manager: Change Environment Type
- AI Environment Manager: Change Conda Environment
- AI Environment Manager: Verify Environment
- AI Environment Manager: Open Prepared Terminal
- AI Environment Manager: Refresh Environments
- AI Environment Manager: Use Prepared Terminal for Commands
- AI Environment Manager: Export requirements.txt
- AI Environment Manager: Export environment.yml

## Settings

This extension contributes the following settings:

- `aiEnvironmentManager.platform`: `windows` | `wsl` | `macos`
- `aiEnvironmentManager.pythonEnvType`: `conda` | `venv`
- `aiEnvironmentManager.condaEnv`: Conda environment name
- `aiEnvironmentManager.venvPath`: Workspace-relative venv folder (for example `.venv`)
- `aiEnvironmentManager.condaShPathWslLinux`: Path to `conda.sh` in WSL/Linux
- `aiEnvironmentManager.condaShPathMac`: Path to `conda.sh` in macOS
- `aiEnvironmentManager.promptOnMissingEnvironment`: Open the configuration panel automatically when no environment is selected (default: `true`)
- `aiEnvironmentManager.generateCodexArtifacts`: Generate or update Codex `AGENTS.md` and `.codex/config.toml` when running **Use Prepared Terminal for Commands** (default: `true`)
Example:

```json
{
  "aiEnvironmentManager.platform": "wsl",
  "aiEnvironmentManager.pythonEnvType": "conda",
  "aiEnvironmentManager.condaEnv": "speech-recognition"
}
```

## Requirements

- Conda installed on the target platform when using `conda` environments.
- A venv/virtualenv folder inside the workspace when using `venv`.
- WSL installed when using the WSL/Linux option on Windows.

## Known Issues

- Cursor's AI agent runs commands in a fresh shell that ignores VS Code terminal profiles. If you are using **Cursor**, run **Use Prepared Terminal for Commands** to generate a Cursor rule that forces the agent to activate your environment, and set the default terminal profile (for VS Code/Copilot).
- Codex's agent also ignores terminal profiles. If you use the **Codex** extension (`openai.chatgpt`), run **Use Prepared Terminal for Commands** to generate `AGENTS.md` and `.codex/config.toml` with environment activation instructions.

## Release Notes

For the full history, see `CHANGELOG.md`.

### 0.2.0 - Codex Integration

- **Use Prepared Terminal for Commands** now generates or updates Codex artifacts (`AGENTS.md`, `.codex/config.toml`) when the Codex extension is installed.
- On Windows, sets `chatgpt.runCodexInWindowsSubsystemForLinux` based on the selected platform (WSL vs native Windows).
- Added `generateCodexArtifacts` workspace setting to disable Codex file generation.

### 0.1.0 - English and Spanish Localization

- UI, commands, settings descriptions, and notifications are available in English and Spanish based on the editor display language.
- Fixed menus showing internal localization keys instead of readable text.

### 0.0.8 - Optional Setup Prompt

- Added `promptOnMissingEnvironment` setting to disable the automatic configuration panel on project open.
- Dismissing the setup prompt offers a "Don't Show Again" option for the current workspace.

### 0.0.7 - Cursor Agent Fix

- "Use Prepared Terminal for Commands" now generates a Cursor rule so the AI agent activates the correct environment.
- WSL-aware rules: wraps all commands with `wsl.exe` when running from Windows.
- Fixed the command aborting early in Cursor due to a configuration write error.

### 0.0.6 - Compatibility Update

- Improved compatibility with VS Code forks such as Cursor, Windsurf (now Devin), and VSCodium.
- Lowered the minimum required VS Code engine version.
- 
### 0.0.5

- Fix environment export on Windows