import * as vscode from 'vscode';
import { Platform, PythonEnvType } from '../types/configuration';

export async function showPlatformQuickPick(): Promise<Platform | undefined> {
	const items: Array<vscode.QuickPickItem & { value: Platform }> = [
		{ label: '🐧 WSL/Linux', description: 'Use Conda or venv inside WSL/Linux', value: 'wsl' },
		{ label: '🪟 Windows', description: 'Use Conda or venv on Windows', value: 'windows' },
		{ label: '🍎 macOS', description: 'Use Conda or venv on macOS', value: 'macos' },
	];

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select Platform',
	});

	return picked?.value;
}

export async function showPythonEnvTypeQuickPick(current?: PythonEnvType): Promise<PythonEnvType | undefined> {
	const items: Array<vscode.QuickPickItem & { value: PythonEnvType }> = [
		{ label: 'Conda', description: current === 'conda' ? 'Current' : undefined, value: 'conda' },
		{ label: 'venv/virtualenv', description: current === 'venv' ? 'Current' : undefined, value: 'venv' },
	];

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select Environment Type',
		matchOnDescription: true,
	});

	return picked?.value;
}

export async function showVenvPathInput(current?: string): Promise<string | undefined> {
	const picked = await vscode.window.showInputBox({
		prompt: 'Enter the venv/virtualenv folder (relative to workspace)',
		placeHolder: '.venv',
		value: current ?? '.venv',
	});

	return picked?.trim() || undefined;
}

export async function showCondaEnvironmentQuickPick(
	environments: string[],
	current?: string
): Promise<string | undefined> {
	const items = environments.map((name) => ({
		label: name,
		description: name === current ? 'Current' : undefined,
		picked: name === current,
	}));

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select Conda Environment',
		matchOnDescription: true,
	});

	return picked?.label;
}


export async function showStatusMenuQuickPick(envType?: PythonEnvType): Promise<string | undefined> {
	const items: Array<vscode.QuickPickItem & { command: string }> = [
		{ label: 'Change Platform', command: 'aiEnvironmentManager.changePlatform' },
		{ label: 'Change Conda Environment', command: 'aiEnvironmentManager.changeCondaEnvironment' },
		{ label: 'Change Environment Type', command: 'aiEnvironmentManager.changePythonEnvironmentType' },
		{ label: 'Verify Environment', command: 'aiEnvironmentManager.verifyEnvironment' },
		{ label: 'Open Prepared Terminal', command: 'aiEnvironmentManager.openPreparedTerminal' },
		{ label: 'Use Prepared Terminal for Commands', command: 'aiEnvironmentManager.setPreparedTerminalAsDefault' },
	];

	items.push({ label: 'Export requirements.txt', command: 'aiEnvironmentManager.exportRequirements' });
	if (envType !== 'venv') {
		items.push({ label: 'Export environment.yml', command: 'aiEnvironmentManager.exportEnvironmentYaml' });
	}

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'AI Environment Manager',
	});

	return picked?.command;
}
