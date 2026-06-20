import * as vscode from 'vscode';
import { SettingsService } from './settingsService';
import { Platform } from '../types/configuration';

export class TerminalService {
	constructor(private readonly settingsService: SettingsService) {}

	public async openPreparedTerminal(): Promise<void> {
		const platform = this.settingsService.getPlatform();
		const condaEnv = this.settingsService.getCondaEnv();
		const envType = this.settingsService.getPythonEnvType() ?? 'conda';
		const venvPath = this.settingsService.getVenvPath();

		if (!platform) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the platform and environment first.'));
			return;
		}

		if (envType === 'venv' && !venvPath) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the venv/virtualenv path first.'));
			return;
		}

		if (envType === 'conda' && !condaEnv) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the Conda environment first.'));
			return;
		}

		if (platform === 'wsl') {
			const useWsl = process.platform === 'win32';
			const terminal = vscode.window.createTerminal({
				name: useWsl ? vscode.l10n.t('AI Env (WSL)') : vscode.l10n.t('AI Env (Linux)'),
				shellPath: useWsl ? 'wsl.exe' : undefined,
			});
			if (envType === 'conda') {
				terminal.sendText(`source ${this.settingsService.getCondaShPathWslLinux()}`);
				terminal.sendText(`conda activate ${condaEnv}`);
			} else {
				terminal.sendText(this.getUnixVenvActivateCommand(venvPath));
			}
			terminal.show();
			return;
		}

		if (platform === 'macos') {
			const terminal = vscode.window.createTerminal({ name: vscode.l10n.t('AI Env (macOS)') });
			if (envType === 'conda') {
				terminal.sendText(`source ${this.settingsService.getCondaShPathMac()}`);
				terminal.sendText(`conda activate ${condaEnv}`);
			} else {
				terminal.sendText(this.getUnixVenvActivateCommand(venvPath));
			}
			terminal.show();
			return;
		}

		const terminal = vscode.window.createTerminal({ name: vscode.l10n.t('AI Env (Windows)') });
		if (envType === 'conda') {
			terminal.sendText(`conda activate ${condaEnv}`);
		} else {
			terminal.sendText(this.getWindowsVenvActivateCommand(venvPath));
		}
		terminal.show();
	}

	public async setPreparedTerminalAsDefault(): Promise<void> {
		const platform = this.settingsService.getPlatform();
		const condaEnv = this.settingsService.getCondaEnv();
		const envType = this.settingsService.getPythonEnvType() ?? 'conda';
		const venvPath = this.settingsService.getVenvPath();
		const workspaceUri = this.settingsService.getWorkspaceUri();

		if (!workspaceUri) {
			vscode.window.showWarningMessage(vscode.l10n.t('Open a workspace folder before changing the default terminal.'));
			return;
		}

		if (!platform) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the platform and environment first.'));
			return;
		}

		if (envType === 'venv' && !venvPath) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the venv/virtualenv path first.'));
			return;
		}

		if (envType === 'conda' && !condaEnv) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the Conda environment first.'));
			return;
		}

		const configuration = vscode.workspace.getConfiguration(undefined, workspaceUri);
		const os = process.platform;
		if (os === 'win32') {
			const profileName = platform === 'wsl' ? vscode.l10n.t('AI Env (WSL)') : vscode.l10n.t('AI Env (Windows)');
			const profile = platform === 'wsl'
				? {
					path: 'wsl.exe',
					args: [
						'-e',
						'bash',
						'-lc',
						envType === 'conda'
							? `source ${this.settingsService.getCondaShPathWslLinux()} && conda activate ${condaEnv} && exec bash --noprofile --norc`
							: `${this.getUnixVenvActivateCommand(venvPath)} && exec bash --noprofile --norc`,
					],
				}
				: {
					path: 'powershell.exe',
					args: [
						'-NoExit',
						'-Command',
						envType === 'conda'
							? `conda activate ${condaEnv}`
							: this.getWindowsVenvActivateCommand(venvPath),
					],
				};

			await this.updateTerminalProfile(configuration, 'windows', profileName, profile);
		} else {
			const profileName = platform === 'macos' ? vscode.l10n.t('AI Env (macOS)') : vscode.l10n.t('AI Env (Linux)');
			const profile = {
				path: 'bash',
				args: [
					'-lc',
					envType === 'conda'
						? `source ${this.getUnixCondaShPath(platform)} && conda activate ${condaEnv}; exec bash --noprofile --norc`
						: `${this.getUnixVenvActivateCommand(venvPath)} && exec bash --noprofile --norc`,
				],
			};

			const profileOs = os === 'darwin' ? 'osx' : 'linux';
			await this.updateTerminalProfile(configuration, profileOs, profileName, profile);
		}

		if (this.isRunningInCursor()) {
			await this.generateCursorRule(workspaceUri, platform, envType, condaEnv, venvPath);
			vscode.window.showInformationMessage(vscode.l10n.t('Default terminal configured and Cursor rule generated for this workspace.'));
		} else {
			vscode.window.showInformationMessage(vscode.l10n.t('Default terminal configured for this workspace.'));
		}
	}

	private async generateCursorRule(
		workspaceUri: vscode.Uri,
		platform: Platform,
		envType: string,
		condaEnv: string | undefined,
		venvPath: string | undefined
	): Promise<void> {
		if (!this.isRunningInCursor()) {
			return;
		}

		const ruleBody = this.buildCursorRuleBody(platform, envType, condaEnv, venvPath);
		if (!ruleBody) {
			return;
		}

		const ruleContent = [
			'---',
			`description: ${vscode.l10n.t('Activate the correct Python environment before running terminal commands')}`,
			'alwaysApply: true',
			'---',
			'',
			ruleBody,
			'',
		].join('\n');

		const rulesDir = vscode.Uri.joinPath(workspaceUri, '.cursor', 'rules');
		const ruleFile = vscode.Uri.joinPath(rulesDir, 'ai-environment-manager.mdc');

		try {
			await vscode.workspace.fs.createDirectory(rulesDir);
			await vscode.workspace.fs.writeFile(ruleFile, new TextEncoder().encode(ruleContent));
		} catch {
			// Non-critical: .cursor/rules may not be writable
		}
	}

	private isRunningInCursor(): boolean {
		// Keep compatibility with older vscode engine typings by feature-detecting via "any".
		const env = vscode.env as unknown as {
			appName?: string;
			appHost?: string;
			uriScheme?: string;
		};

		const appName = env.appName?.toLowerCase() ?? '';
		const appHost = env.appHost?.toLowerCase() ?? '';
		const uriScheme = env.uriScheme?.toLowerCase() ?? '';

		return appName.includes('cursor') || appHost.includes('cursor') || uriScheme === 'cursor';
	}

	private buildCursorRuleBody(
		platform: Platform,
		envType: string,
		condaEnv: string | undefined,
		venvPath: string | undefined
	): string | undefined {
		const isWindowsHost = process.platform === 'win32';
		const useWsl = isWindowsHost && platform === 'wsl';

		if (useWsl) {
			return this.buildWslCursorRule(envType, condaEnv, venvPath);
		}

		if (platform === 'windows') {
			return this.buildWindowsCursorRule(envType, condaEnv, venvPath);
		}

		return this.buildUnixCursorRule(platform, envType, condaEnv, venvPath);
	}

	private buildWslCursorRule(envType: string, condaEnv: string | undefined, venvPath: string | undefined): string | undefined {
		let activation: string;
		if (envType === 'conda' && condaEnv) {
			const condaShPath = this.settingsService.getCondaShPathWslLinux();
			activation = `source ${condaShPath} && conda activate ${condaEnv}`;
		} else if (envType === 'venv' && venvPath) {
			activation = this.getUnixVenvActivateCommand(venvPath);
		} else {
			return undefined;
		}

		return [
			'This project uses WSL/Linux. ALL terminal commands MUST be executed inside WSL.',
			'',
			'NEVER run commands directly in PowerShell or cmd. Always use this pattern:',
			'',
			'```',
			`wsl.exe bash -lc "${activation} && <YOUR_COMMAND>"`,
			'```',
			'',
			'For example, to run `python --version`:',
			'',
			'```',
			`wsl.exe bash -lc "${activation} && python --version"`,
			'```',
			'',
			'NEVER skip the activation step. Every command must include it.',
		].join('\n');
	}

	private buildWindowsCursorRule(envType: string, condaEnv: string | undefined, venvPath: string | undefined): string | undefined {
		if (envType === 'conda' && condaEnv) {
			return [
				'This project uses Conda on Windows.',
				'',
				'In Cursor, run EVERY command inside the environment using `conda run` (do not rely on terminal state):',
				'',
				'```',
				`conda run -n ${condaEnv} <YOUR_COMMAND>`,
				'```',
				'',
				'For example, to run `python --version`:',
				'',
				'```',
				`conda run -n ${condaEnv} python --version`,
				'```',
				'',
				'NEVER omit `conda run -n ...` when running commands.',
			].join('\n');
		}

		if (envType === 'venv' && venvPath) {
			const activation = this.getWindowsVenvActivateCommand(venvPath);
			return [
				'Before running ANY command in the terminal, you MUST first activate the Python environment.',
				'',
				'Run this activation command FIRST, as a separate command or prepended with `;`:',
				'',
				'```',
				activation,
				'```',
				'',
				'NEVER skip this step. If you open a new terminal or run a new command, always activate first.',
			].join('\n');
		}

		return undefined;
	}

	private buildUnixCursorRule(platform: Platform, envType: string, condaEnv: string | undefined, venvPath: string | undefined): string | undefined {
		let activation: string;
		if (envType === 'conda' && condaEnv) {
			const condaShPath = this.getUnixCondaShPath(platform);
			activation = `source ${condaShPath} && conda activate ${condaEnv}`;
		} else if (envType === 'venv' && venvPath) {
			activation = this.getUnixVenvActivateCommand(venvPath);
		} else {
			return undefined;
		}

		return [
			'Before running ANY command in the terminal, you MUST first activate the Python environment.',
			'',
			'Run this activation command FIRST, as a separate command or prepended with `&&`:',
			'',
			'```',
			activation,
			'```',
			'',
			'NEVER skip this step. If you open a new terminal or run a new command, always activate first.',
		].join('\n');
	}

	private async updateTerminalProfile(
		configuration: vscode.WorkspaceConfiguration,
		profileOs: 'windows' | 'linux' | 'osx',
		profileName: string,
		profile: Record<string, unknown>
	): Promise<void> {
		const profilesKey = `terminal.integrated.profiles.${profileOs}`;
		const defaultKey = `terminal.integrated.defaultProfile.${profileOs}`;
		const existingProfiles = configuration.get<Record<string, unknown>>(profilesKey) ?? {};
		const nextProfiles = {
			...existingProfiles,
			[profileName]: profile,
		};

		await configuration.update(profilesKey, nextProfiles, vscode.ConfigurationTarget.Workspace);
		await configuration.update(defaultKey, profileName, vscode.ConfigurationTarget.Workspace);
	}

	private getUnixVenvActivateCommand(venvPath?: string): string {
		return `source ${venvPath ?? '.venv'}/bin/activate`;
	}

	private getWindowsVenvActivateCommand(venvPath?: string): string {
		const resolvedPath = venvPath ?? '.venv';
		return `& "${resolvedPath}\\Scripts\\Activate.ps1"`;
	}

	private getUnixCondaShPath(platform: Platform): string {
		return platform === 'macos'
			? this.settingsService.getCondaShPathMac()
			: this.settingsService.getCondaShPathWslLinux();
	}
}
