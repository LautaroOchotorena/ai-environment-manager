import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { SettingsService } from './settingsService';
import { Platform, PythonEnvType } from '../types/configuration';

const execAsync = promisify(exec);

export class ExportService {
	constructor(private readonly settingsService: SettingsService) {}

	public async exportRequirements(): Promise<void> {
		const workspaceUri = this.settingsService.getWorkspaceUri();
		if (!workspaceUri) {
			vscode.window.showWarningMessage('Open a workspace folder before exporting requirements.txt.');
			return;
		}

		const platform = this.settingsService.getPlatform();
		const envType = this.settingsService.getPythonEnvType() ?? 'conda';
		const condaEnv = this.settingsService.getCondaEnv();
		const venvPath = this.settingsService.getVenvPath();

		if (!platform) {
			vscode.window.showWarningMessage('Configure the platform and environment before exporting.');
			return;
		}

		if (envType === 'conda' && !condaEnv) {
			vscode.window.showWarningMessage('Configure the Conda environment before exporting.');
			return;
		}

		if (envType === 'venv' && !venvPath) {
			vscode.window.showWarningMessage('Configure the venv/virtualenv path before exporting.');
			return;
		}

		const fileUri = vscode.Uri.joinPath(workspaceUri, 'requirements.txt');
		if (!(await this.confirmOverwrite(fileUri, 'requirements.txt'))) {
			return;
		}

		try {
			const command = await this.buildRequirementsCommand(platform, envType, condaEnv, venvPath, workspaceUri);
			if (!command) {
				return;
			}

			const output = await this.runCommand(command);
			await this.writeFile(fileUri, output);
			vscode.window.showInformationMessage('✓ requirements.txt exported successfully');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to export requirements.txt.';
			vscode.window.showErrorMessage(message);
		}
	}

	public async exportEnvironmentYaml(): Promise<void> {
		const workspaceUri = this.settingsService.getWorkspaceUri();
		if (!workspaceUri) {
			vscode.window.showWarningMessage('Open a workspace folder before exporting environment.yml.');
			return;
		}

		const platform = this.settingsService.getPlatform();
		const envType = this.settingsService.getPythonEnvType() ?? 'conda';
		const condaEnv = this.settingsService.getCondaEnv();

		if (!platform) {
			vscode.window.showWarningMessage('Configure the platform and environment before exporting.');
			return;
		}

		if (envType === 'venv') {
			vscode.window.showInformationMessage('This feature is only available for Conda environments.');
			return;
		}

		if (!condaEnv) {
			vscode.window.showWarningMessage('Configure the Conda environment before exporting.');
			return;
		}

		const fileUri = vscode.Uri.joinPath(workspaceUri, 'environment.yml');
		if (!(await this.confirmOverwrite(fileUri, 'environment.yml'))) {
			return;
		}

		try {
			const command = platform === 'windows'
				? `conda env export --no-builds -n ${condaEnv}`
				: this.buildCondaCommand(platform, condaEnv, 'conda env export --no-builds');
			const output = await this.runCommand(command);
			await this.writeFile(fileUri, output);
			vscode.window.showInformationMessage('✓ environment.yml exported successfully');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to export environment.yml.';
			vscode.window.showErrorMessage(message);
		}
	}

	private async buildRequirementsCommand(
		platform: Platform,
		envType: PythonEnvType,
		condaEnv: string | undefined,
		venvPath: string | undefined,
		workspaceUri: vscode.Uri
	): Promise<string | undefined> {
		if (envType === 'conda' && condaEnv) {
			if (platform === 'windows') {
				return `powershell.exe -NoProfile -Command "conda run -n ${condaEnv} python -m pip freeze"`;
			}
			return this.buildCondaCommand(platform, condaEnv, 'python -m pip freeze');
		}

		if (envType === 'venv' && venvPath) {
			return await this.buildVenvCommand(platform, venvPath, workspaceUri, 'python -m pip freeze');
		}

		return undefined;
	}

	private buildCondaCommand(platform: Platform, condaEnv: string, command: string): string {
		if (platform === 'windows') {
			return `powershell.exe -NoProfile -Command "conda activate ${condaEnv}; ${command}"`;
		}

		const useWsl = process.platform === 'win32' && platform === 'wsl';
		const condaShPath = platform === 'macos'
			? this.settingsService.getCondaShPathMac()
			: this.settingsService.getCondaShPathWslLinux();
		const fullCommand = `source ${condaShPath} && conda activate ${condaEnv} && ${command}`;
		return this.buildUnixCommand(fullCommand, useWsl);
	}

	private async buildVenvCommand(
		platform: Platform,
		venvPath: string,
		workspaceUri: vscode.Uri,
		command: string
	): Promise<string | undefined> {
		const useWsl = process.platform === 'win32' && platform === 'wsl';
		if (platform === 'wsl') {
			const fullCommand = `source ${venvPath}/bin/activate && ${command}`;
			return this.buildUnixCommand(fullCommand, useWsl);
		}

		const pythonPath = await this.resolveVenvPythonPath(platform, venvPath, workspaceUri);
		if (!pythonPath) {
			return undefined;
		}

		return `"${pythonPath}" -m pip freeze`;
	}

	private async resolveVenvPythonPath(
		platform: Platform,
		venvPath: string,
		workspaceUri: vscode.Uri
	): Promise<string | undefined> {
		const rootPath = workspaceUri.fsPath;
		const basePath = path.isAbsolute(venvPath) ? venvPath : path.join(rootPath, venvPath);
		const pythonPath = platform === 'windows'
			? path.join(basePath, 'Scripts', 'python.exe')
			: path.join(basePath, 'bin', 'python');

		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(pythonPath));
			return pythonPath;
		} catch {
			vscode.window.showErrorMessage('Python interpreter for the venv/virtualenv was not found.');
			return undefined;
		}
	}

	private async confirmOverwrite(fileUri: vscode.Uri, fileName: string): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(fileUri);
			const choice = await vscode.window.showWarningMessage(
				`"${fileName}" already exists. Overwrite?`,
				{ modal: true },
				'Overwrite'
			);
			return choice === 'Overwrite';
		} catch {
			return true;
		}
	}

	private async writeFile(fileUri: vscode.Uri, content: string): Promise<void> {
		const normalized = content.endsWith('\n') ? content : `${content}\n`;
		const encoder = new TextEncoder();
		await vscode.workspace.fs.writeFile(fileUri, encoder.encode(normalized));
	}

	private buildUnixCommand(command: string, useWsl: boolean): string {
		if (useWsl) {
			return `wsl.exe bash -lc "${command}"`;
		}

		return `bash -lc "${command}"`;
	}

	private async runCommand(command: string): Promise<string> {
		try {
			const result = await execAsync(command, { windowsHide: true, maxBuffer: 1024 * 1024 });
			return [result.stdout, result.stderr].filter(Boolean).join('\n');
		} catch (error) {
			if (this.isWslMissing(error)) {
				throw new Error('WSL is not available. Install WSL and try again.');
			}
			if (this.isCondaMissing(error)) {
				throw new Error('Conda was not found. Ensure Conda is installed and on PATH.');
			}
			throw error instanceof Error ? error : new Error('Export command failed.');
		}
	}

	private isWslMissing(error: unknown): boolean {
		return error instanceof Error && /wsl(\.exe)?/i.test(error.message);
	}

	private isCondaMissing(error: unknown): boolean {
		return error instanceof Error && /conda/i.test(error.message) && /not found|is not recognized/i.test(error.message);
	}
}
