/**
 * CLI Code Analyzer Tests
 * Coverage: code-analyzer.cjs command line interface
 */

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI_PATH = join(__dirname, '../../cli/code-analyzer.cjs');

describe('CLI Code Analyzer', () => {
  let testDir;
  let testFile;

  beforeAll(() => {
    testDir = join(tmpdir(), 'cli-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, 'test.js');
    writeFileSync(testFile, 'function add(a, b) { return a + b; }');
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('Argument Parsing', () => {
    it('should show help with --help', async () => {
      const result = await runCli(['--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Code Analyzer CLI');
      expect(result.stdout).toContain('--upload');
      expect(result.stdout).toContain('--project');
    });

    it('should analyze single file', async () => {
      const result = await runCli([testFile, '--format', 'json']);
      expect(result.code).toBe(0);
      // Filter out log lines and extract JSON
      const lines = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('['));
      const jsonLine = lines.find(line => line.startsWith('{'));
      expect(jsonLine).toBeDefined();
      const output = JSON.parse(jsonLine);
      expect(output.result.language).toBe('javascript');
      expect(output.result.functions).toHaveLength(1);
      expect(output.result.functions[0].name).toBe('add');
    });

    it('should output table format', async () => {
      const result = await runCli([testFile, '--format', 'table']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('add');
      expect(result.stdout).toContain('Function');
    });

    it('should output tree format', async () => {
      const result = await runCli([testFile, '--format', 'tree']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('add');
    });

    it('should save to file with --output', async () => {
      const outputFile = join(testDir, 'output.json');
      const result = await runCli([testFile, '--output', outputFile]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Results saved to');
    });

    it('should exit with error for non-existent file', async () => {
      const result = await runCli([join(testDir, 'nonexistent.js')]);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('File not found');
    });

    it('should handle unsupported file type with fallback', async () => {
      const txtFile = join(testDir, 'test.txt');
      writeFileSync(txtFile, 'hello');
      const result = await runCli([txtFile, '--format', 'json']);
      // CLI now uses fallback analyzer instead of rejecting
      expect(result.code).toBe(0);
      const lines = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('['));
      const jsonLine = lines.find(line => line.startsWith('{'));
      const output = JSON.parse(jsonLine);
      expect(output.success).toBe(true);
      expect(output.result.language).toBe('unknown');
    });
  });

  describe('--project flag', () => {
    it('should analyze all files in project', async () => {
      const result = await runCli(['--project', '--format', 'json']);
      expect(result.code).toBe(0);
      const lines = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('['));
      const jsonLine = lines.find(line => line.startsWith('{'));
      expect(jsonLine).toBeDefined();
      const output = JSON.parse(jsonLine);
      expect(output).toHaveProperty('results');
      expect(output).toHaveProperty('metrics');
      expect(Array.isArray(output.results)).toBe(true);
      expect(output.metrics).toHaveProperty('totalFiles');
    }, 30000);
  });

  describe('--upload flag', () => {
    it('should upload project with --upload', async () => {
      const result = await runCli(['--upload', testDir]);
      expect(result.stdout).toContain('Upload complete');
      expect(result.stdout).toContain('Files:');
      expect(result.stdout).toContain('Atoms:');
    }, 60000);
  });

  describe('--language flag', () => {
    it('should analyze with specified language', async () => {
      const pyFile = join(testDir, 'script.py');
      writeFileSync(pyFile, 'def hello(): pass');
      const result = await runCli(['--language', 'python', pyFile, '--format', 'json']);
      expect(result.code).toBe(0);
      const lines = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('['));
      const jsonLine = lines.find(line => line.startsWith('{'));
      expect(jsonLine).toBeDefined();
      const output = JSON.parse(jsonLine);
      expect(output.result.language).toBe('python');
    });
  });
});

async function runCli(args, cwd) {
  return new Promise(resolve => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', err => {
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}
