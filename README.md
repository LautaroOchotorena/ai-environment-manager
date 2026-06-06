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

- Guided first-run setup for platform and environment configuration.
- Automatic Conda environment discovery (Windows, WSL/Linux, macOS).
- Support for venv / virtualenv via workspace-relative paths (e.g. .venv).
- Status bar indicator showing active platform and environment.
- Prepared terminal launcher with optional default terminal integration.
- Environment verification via VS Code Output Channel.
- Export requirements.txt for Conda and venv environments.
- Export environment.yml for Conda environments.

## Status bar menu

Click the status bar item to open the action menu, which includes setup, environment verification, terminal actions, and export utilities.

When using venv, the Export environment.yml option is automatically hidden.

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

- Copilot and other agents may use their own terminal selection. Use **AI Environment Manager: Use Prepared Terminal for Commands** to set the default terminal profile in the current workspace.

## Release Notes

For the full history, see `CHANGELOG.md`.

### 0.0.1

- Initial release.

### 0.0.5

- Fix environment export on Windows

### 0.0.6 - Compatibility Update

- Improved compatibility with VS Code forks such as Cursor, Windsurf (now Devin), and VSCodium.
- Lowered the minimum required VS Code engine version.