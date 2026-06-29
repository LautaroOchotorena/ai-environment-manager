import * as assert from 'assert';
import {
	AGENTS_MD_END_MARKER,
	AGENTS_MD_START_MARKER,
	CONFIG_TOML_END_MARKER,
	CONFIG_TOML_START_MARKER,
	buildAgentInstructions,
	buildAgentsMdManagedBlock,
	buildConfigTomlManagedBlock,
	detectCodexExtension,
	ExtensionLike,
	hasCodexContributions,
	isConfigurationComplete,
	updateMarkedBlock,
} from '../services/codexService';
import { AiEnvironmentConfiguration } from '../types/configuration';

suite('CodexService', () => {
	suite('detectCodexExtension', () => {
		test('detects Codex by package id', () => {
			const extensions: ExtensionLike[] = [
				{ id: 'openai.chatgpt', packageJSON: {} },
			];

			assert.strictEqual(detectCodexExtension(extensions), true);
		});

		test('detects Codex by chatgpt.* command contribution fallback', () => {
			const extensions: ExtensionLike[] = [
				{
					id: 'other.publisher',
					packageJSON: {
						contributes: {
							commands: [{ command: 'chatgpt.openPanel' }],
						},
					},
				},
			];

			assert.strictEqual(detectCodexExtension(extensions), true);
		});

		test('detects Codex by chatgpt.* settings contribution fallback', () => {
			const extensions: ExtensionLike[] = [
				{
					id: 'other.publisher',
					packageJSON: {
						contributes: {
							configuration: {
								properties: {
									'chatgpt.runCodexInWindowsSubsystemForLinux': { type: 'boolean' },
								},
							},
						},
					},
				},
			];

			assert.strictEqual(detectCodexExtension(extensions), true);
		});

		test('returns false when Codex is not present', () => {
			const extensions: ExtensionLike[] = [
				{
					id: 'ms-python.python',
					packageJSON: {
						contributes: {
							commands: [{ command: 'python.createEnvironment' }],
						},
					},
				},
			];

			assert.strictEqual(detectCodexExtension(extensions), false);
		});
	});

	suite('hasCodexContributions', () => {
		test('ignores unrelated command prefixes', () => {
			const extension: ExtensionLike = {
				id: 'example.ext',
				packageJSON: {
					contributes: {
						commands: [{ command: 'example.doThing' }],
					},
				},
			};

			assert.strictEqual(hasCodexContributions(extension), false);
		});
	});

	suite('isConfigurationComplete', () => {
		test('requires platform and pythonEnvType', () => {
			assert.strictEqual(isConfigurationComplete({}), false);
			assert.strictEqual(isConfigurationComplete({ platform: 'windows' }), false);
		});

		test('requires condaEnv for conda environments', () => {
			assert.strictEqual(
				isConfigurationComplete({ platform: 'windows', pythonEnvType: 'conda' }),
				false
			);
			assert.strictEqual(
				isConfigurationComplete({ platform: 'windows', pythonEnvType: 'conda', condaEnv: 'ml' }),
				true
			);
		});

		test('requires venvPath for venv environments', () => {
			assert.strictEqual(
				isConfigurationComplete({ platform: 'windows', pythonEnvType: 'venv' }),
				false
			);
			assert.strictEqual(
				isConfigurationComplete({ platform: 'windows', pythonEnvType: 'venv', venvPath: '.venv' }),
				true
			);
		});
	});

	suite('buildAgentInstructions', () => {
		const condaConfig: AiEnvironmentConfiguration = {
			platform: 'windows',
			pythonEnvType: 'conda',
			condaEnv: 'myenv',
		};

		const venvConfig: AiEnvironmentConfiguration = {
			platform: 'windows',
			pythonEnvType: 'venv',
			venvPath: '.venv',
		};

		test('generates conda run instructions for Windows+Conda', () => {
			const instructions = buildAgentInstructions(condaConfig);
			assert.ok(instructions.includes('conda run -n myenv <YOUR_COMMAND>'));
			assert.ok(instructions.includes('conda run -n myenv python --version'));
		});

		test('generates PowerShell activation for Windows+venv', () => {
			const instructions = buildAgentInstructions(venvConfig);
			assert.ok(instructions.includes('& ".venv\\Scripts\\Activate.ps1"'));
		});

		test('generates wsl.exe wrapper for Windows host with WSL platform', () => {
			if (process.platform !== 'win32') {
				return;
			}

			const instructions = buildAgentInstructions({
				platform: 'wsl',
				pythonEnvType: 'conda',
				condaEnv: 'ml',
				condaShPathWslLinux: '~/miniconda3/etc/profile.d/conda.sh',
			});

			assert.ok(instructions.includes('wsl.exe bash -lc'));
			assert.ok(instructions.includes('source ~/miniconda3/etc/profile.d/conda.sh && conda activate ml'));
		});

		test('generates source/conda activate for macOS/Linux hosts', () => {
			if (process.platform === 'win32') {
				return;
			}

			const instructions = buildAgentInstructions({
				platform: 'macos',
				pythonEnvType: 'conda',
				condaEnv: 'ml',
				condaShPathMac: '~/miniconda3/etc/profile.d/conda.sh',
			});

			assert.ok(instructions.includes('source ~/miniconda3/etc/profile.d/conda.sh && conda activate ml'));
		});

		test('generates venv activation for macOS/Linux hosts', () => {
			if (process.platform === 'win32') {
				return;
			}

			const instructions = buildAgentInstructions({
				platform: 'wsl',
				pythonEnvType: 'venv',
				venvPath: '.venv',
			});

			assert.ok(instructions.includes('source .venv/bin/activate'));
		});
	});

	suite('updateMarkedBlock', () => {
		const managedBlock = [
			AGENTS_MD_START_MARKER,
			'managed content',
			AGENTS_MD_END_MARKER,
		].join('\n');

		test('appends managed block to empty content', () => {
			const result = updateMarkedBlock('', AGENTS_MD_START_MARKER, AGENTS_MD_END_MARKER, managedBlock);
			assert.strictEqual(result, `${managedBlock}\n`);
		});

		test('appends managed block after manual content when markers are absent', () => {
			const manual = '# Project notes\n\nKeep this section.';
			const result = updateMarkedBlock(manual, AGENTS_MD_START_MARKER, AGENTS_MD_END_MARKER, managedBlock);

			assert.ok(result.startsWith(manual));
			assert.ok(result.includes(managedBlock));
		});

		test('replaces only the managed block and preserves manual content', () => {
			const manualBefore = '# Manual intro\n';
			const manualAfter = '\n# Manual footer\n';
			const oldManaged = [
				AGENTS_MD_START_MARKER,
				'old managed content',
				AGENTS_MD_END_MARKER,
			].join('\n');
			const existing = `${manualBefore}${oldManaged}${manualAfter}`;
			const updatedManaged = [
				AGENTS_MD_START_MARKER,
				'new managed content',
				AGENTS_MD_END_MARKER,
			].join('\n');

			const result = updateMarkedBlock(
				existing,
				AGENTS_MD_START_MARKER,
				AGENTS_MD_END_MARKER,
				updatedManaged
			);

			assert.ok(result.includes(manualBefore.trim()));
			assert.ok(result.includes('new managed content'));
			assert.ok(!result.includes('old managed content'));
			assert.ok(result.includes('# Manual footer'));
		});

		test('updates config.toml managed block idempotently', () => {
			const manual = 'model = "gpt-5"\n';
			const oldBlock = [
				CONFIG_TOML_START_MARKER,
				'# platform = "windows"',
				CONFIG_TOML_END_MARKER,
			].join('\n');
			const newBlock = buildConfigTomlManagedBlock({
				platform: 'wsl',
				pythonEnvType: 'conda',
				condaEnv: 'ml',
			});

			const firstPass = updateMarkedBlock(
				`${manual}${oldBlock}\n`,
				CONFIG_TOML_START_MARKER,
				CONFIG_TOML_END_MARKER,
				newBlock
			);
			const secondPass = updateMarkedBlock(
				firstPass,
				CONFIG_TOML_START_MARKER,
				CONFIG_TOML_END_MARKER,
				newBlock
			);

			assert.ok(firstPass.includes('model = "gpt-5"'));
			assert.ok(firstPass.includes('# platform = "wsl"'));
			assert.strictEqual(firstPass, secondPass);
		});
	});

	suite('managed artifact builders', () => {
		test('buildAgentsMdManagedBlock includes markers and active environment', () => {
			const block = buildAgentsMdManagedBlock({
				platform: 'windows',
				pythonEnvType: 'conda',
				condaEnv: 'myenv',
			});

			assert.ok(block.includes(AGENTS_MD_START_MARKER));
			assert.ok(block.includes(AGENTS_MD_END_MARKER));
			assert.ok(block.includes('**Active environment:** myenv'));
		});

		test('buildConfigTomlManagedBlock stays commented', () => {
			const block = buildConfigTomlManagedBlock({
				platform: 'windows',
				pythonEnvType: 'venv',
				venvPath: '.venv',
			});

			assert.ok(block.includes(CONFIG_TOML_START_MARKER));
			assert.ok(block.includes('# venv_path = ".venv"'));
			assert.ok(!block.includes('venv_path = ".venv"'));
		});
	});
});
