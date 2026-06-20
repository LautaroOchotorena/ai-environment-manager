import * as vscode from 'vscode';
import { Platform, PythonEnvType } from '../types/configuration';

export async function showPlatformQuickPick(): Promise<Platform | undefined> {
	const items: Array<vscode.QuickPickItem & { value: Platform }> = [
		{ label: vscode.l10n.t('🐧 WSL/Linux'), description: vscode.l10n.t('Use Conda or venv inside WSL/Linux'), value: 'wsl' },
		{ label: vscode.l10n.t('🪟 Windows'), description: vscode.l10n.t('Use Conda or venv on Windows'), value: 'windows' },
		{ label: vscode.l10n.t('🍎 macOS'), description: vscode.l10n.t('Use Conda or venv on macOS'), value: 'macos' },
	];

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: vscode.l10n.t('Select Platform'),
	});

	return picked?.value;
}

export async function showPythonEnvTypeQuickPick(current?: PythonEnvType): Promise<PythonEnvType | undefined> {
	const items: Array<vscode.QuickPickItem & { value: PythonEnvType }> = [
		{ label: vscode.l10n.t('Conda'), description: current === 'conda' ? vscode.l10n.t('Current') : undefined, value: 'conda' },
		{ label: vscode.l10n.t('venv/virtualenv'), description: current === 'venv' ? vscode.l10n.t('Current') : undefined, value: 'venv' },
	];

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: vscode.l10n.t('Select Environment Type'),
		matchOnDescription: true,
	});

	return picked?.value;
}

export async function showVenvPathInput(current?: string): Promise<string | undefined> {
	const picked = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('Enter the venv/virtualenv folder (relative to workspace)'),
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
		description: name === current ? vscode.l10n.t('Current') : undefined,
		picked: name === current,
	}));

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: vscode.l10n.t('Select Conda Environment'),
		matchOnDescription: true,
	});

	return picked?.label;
}


export async function showStatusMenuQuickPick(envType?: PythonEnvType): Promise<string | undefined> {
	const items: Array<vscode.QuickPickItem & { command: string }> = [
		{ label: vscode.l10n.t('Change Platform'), command: 'aiEnvironmentManager.changePlatform' },
		{ label: vscode.l10n.t('Change Conda Environment'), command: 'aiEnvironmentManager.changeCondaEnvironment' },
		{ label: vscode.l10n.t('Change Environment Type'), command: 'aiEnvironmentManager.changePythonEnvironmentType' },
		{ label: vscode.l10n.t('Verify Environment'), command: 'aiEnvironmentManager.verifyEnvironment' },
		{ label: vscode.l10n.t('Open Prepared Terminal'), command: 'aiEnvironmentManager.openPreparedTerminal' },
		{ label: vscode.l10n.t('Use Prepared Terminal for Commands'), command: 'aiEnvironmentManager.setPreparedTerminalAsDefault' },
	];

	items.push({ label: vscode.l10n.t('Export requirements.txt'), command: 'aiEnvironmentManager.exportRequirements' });
	if (envType !== 'venv') {
		items.push({ label: vscode.l10n.t('Export environment.yml'), command: 'aiEnvironmentManager.exportEnvironmentYaml' });
	}

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: vscode.l10n.t('AI Environment Manager'),
	});

	return picked?.command;
}
