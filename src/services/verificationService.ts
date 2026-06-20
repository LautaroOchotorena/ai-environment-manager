import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SettingsService } from './settingsService';
import { Platform, PythonEnvType } from '../types/configuration';

const execAsync = promisify(exec);

export class VerificationService {
	private readonly outputChannel = vscode.window.createOutputChannel(vscode.l10n.t('AI Environment Manager'));

	constructor(private readonly settingsService: SettingsService) {}

	public async verifyEnvironment(): Promise<void> {
		const platform = this.settingsService.getPlatform();
		const condaEnv = this.settingsService.getCondaEnv();
		const envType = this.settingsService.getPythonEnvType() ?? 'conda';
		const venvPath = this.settingsService.getVenvPath();

		if (!platform) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the platform and environment before verifying.'));
			return;
		}

		if (envType === 'venv' && !venvPath) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the venv/virtualenv path before verifying.'));
			return;
		}

		if (envType === 'conda' && !condaEnv) {
			vscode.window.showWarningMessage(vscode.l10n.t('Configure the Conda environment before verifying.'));
			return;
		}

		const envLabel = envType === 'venv' ? (venvPath ?? '') : (condaEnv ?? '');
		this.outputChannel.clear();
		this.outputChannel.appendLine(vscode.l10n.t('Verifying environment for {0} ({1})...', platform, envLabel));
		this.outputChannel.appendLine('');

		const commands = this.getVerificationCommands(platform, envType, venvPath);
		let success = true;

		for (const command of commands) {
			this.outputChannel.appendLine(`> ${command.label}`);
			try {
				const output = await this.runCommand(command.command);
				if (output.trim()) {
					this.outputChannel.appendLine(output.trim());
				}
			} catch (error) {
				success = false;
				const message = error instanceof Error ? error.message : vscode.l10n.t('Command failed.');
				this.outputChannel.appendLine(vscode.l10n.t('Error: {0}', message));
			}
			this.outputChannel.appendLine('');
		}

		this.outputChannel.show(true);
		if (success) {
			vscode.window.showInformationMessage(vscode.l10n.t('Environment verification succeeded.'));
		} else {
			vscode.window.showErrorMessage(vscode.l10n.t('Environment verification failed. Review the output for details.'));
		}
	}

	private getVerificationCommands(
		platform: Platform,
		envType: PythonEnvType,
		venvPath?: string
	): Array<{ label: string; command: string }> {
		if (platform === 'windows') {
			return this.getWindowsVerificationCommands(envType, venvPath);
		}

		return this.getUnixVerificationCommands(platform, envType, venvPath);
	}

	private async runCommand(command: string): Promise<string> {
		try {
			const result = await execAsync(command, { windowsHide: true, maxBuffer: 1024 * 1024 });
			return [result.stdout, result.stderr].filter(Boolean).join('\n');
		} catch (error) {
			if (this.isWslMissing(error)) {
				throw new Error(vscode.l10n.t('WSL is not available. Install WSL and try again.'));
			}
			if (this.isCondaMissing(error)) {
				throw new Error(vscode.l10n.t('Conda was not found. Ensure Conda is installed and on PATH.'));
			}
			throw error instanceof Error ? error : new Error(vscode.l10n.t('Command failed.'));
		}
	}

	private getWindowsVerificationCommands(envType: PythonEnvType, venvPath?: string) {
		if (envType === 'venv') {
			const activate = this.getWindowsVenvActivateCommand(venvPath);
			return [
				{ label: 'python --version', command: `powershell.exe -NoProfile -Command "${activate}; python --version"` },
				{ label: 'where python', command: `powershell.exe -NoProfile -Command "${activate}; where python"` },
			];
		}

		return [
			{ label: 'python --version', command: 'python --version' },
			{ label: 'where python', command: 'where python' },
			{ label: 'conda info', command: 'conda info' },
		];
	}

	private getUnixVerificationCommands(platform: Platform, envType: PythonEnvType, venvPath?: string) {
		const useWsl = process.platform === 'win32' && platform === 'wsl';
		const condaShPath = platform === 'macos'
			? this.settingsService.getCondaShPathMac()
			: this.settingsService.getCondaShPathWslLinux();
		const prefix = envType === 'conda'
			? `source ${condaShPath} && `
			: `${this.getUnixVenvActivateCommand(venvPath)} && `;
		const run = (cmd: string) => this.buildUnixCommand(`${prefix}${cmd}`, useWsl);

		const commands = [
			{ label: 'python --version', command: run('python --version') },
			{ label: 'which python', command: run('which python') },
		];

		if (envType === 'conda') {
			commands.push({ label: 'conda info', command: run('conda info') });
		}

		return commands;
	}

	private buildUnixCommand(command: string, useWsl: boolean): string {
		if (useWsl) {
			return `wsl.exe bash -lc "${command}"`;
		}

		return `bash -lc "${command}"`;
	}

	private isWslMissing(error: unknown): boolean {
		return error instanceof Error && /wsl(\.exe)?/i.test(error.message);
	}

	private isCondaMissing(error: unknown): boolean {
		return error instanceof Error && /conda/i.test(error.message) && /not found|is not recognized/i.test(error.message);
	}

	private getUnixVenvActivateCommand(venvPath?: string): string {
		return `source ${venvPath ?? '.venv'}/bin/activate`;
	}

	private getWindowsVenvActivateCommand(venvPath?: string): string {
		const resolvedPath = venvPath ?? '.venv';
		return `& "${resolvedPath}\\Scripts\\Activate.ps1"`;
	}
}
