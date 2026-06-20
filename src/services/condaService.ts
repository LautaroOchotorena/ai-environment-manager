import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CondaService {
	public async getWindowsCondaEnvs(): Promise<string[]> {
		try {
			const output = await this.runCommand('conda env list');
			return this.parseCondaEnvList(output);
		} catch (error) {
			throw this.formatError(error, vscode.l10n.t('Conda was not found on Windows. Ensure Conda is installed and on PATH.'));
		}
	}

	public async getWslLinuxCondaEnvs(condaShPath: string, useWsl: boolean): Promise<string[]> {
		try {
			const output = await this.runCommand(this.buildUnixCommand(condaShPath, 'conda env list', useWsl));
			return this.parseCondaEnvList(output);
		} catch (error) {
			const message = useWsl && this.isWslMissing(error)
				? vscode.l10n.t('WSL is not available. Install WSL and try again.')
				: vscode.l10n.t('Conda was not found in WSL/Linux. Ensure Conda is installed and on PATH.');
			throw this.formatError(error, message);
		}
	}

	public async getMacCondaEnvs(condaShPath: string): Promise<string[]> {
		try {
			const output = await this.runCommand(this.buildUnixCommand(condaShPath, 'conda env list', false));
			return this.parseCondaEnvList(output);
		} catch (error) {
			throw this.formatError(error, vscode.l10n.t('Conda was not found on macOS. Ensure Conda is installed and on PATH.'));
		}
	}

	public parseCondaEnvList(output: string): string[] {
		const envs = new Set<string>();
		for (const line of output.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}

			const tokens = trimmed.split(/\s+/);
			if (tokens.length === 0) {
				continue;
			}

			let name = tokens[0];
			if (name === '*' && tokens.length > 1) {
				name = tokens[1];
			}

			if (name && name !== '*') {
				envs.add(name);
			}
		}

		return Array.from(envs);
	}

	private async runCommand(command: string): Promise<string> {
		const result = await execAsync(command, { windowsHide: true, maxBuffer: 1024 * 1024 });
		return [result.stdout, result.stderr].filter(Boolean).join('\n');
	}

	private buildUnixCommand(condaShPath: string, command: string, useWsl: boolean): string {
		const fullCommand = `source ${condaShPath} && ${command}`;
		if (useWsl) {
			return `wsl.exe bash -lc "${fullCommand}"`;
		}

		return `bash -lc "${fullCommand}"`;
	}

	private formatError(error: unknown, fallbackMessage: string): Error {
		if (error instanceof Error) {
			return new Error(`${fallbackMessage} (${error.message})`);
		}

		return new Error(fallbackMessage);
	}

	private isWslMissing(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false;
		}

		return /wsl(\.exe)?/i.test(error.message) || /Windows Subsystem for Linux/i.test(error.message);
	}
}
