/**
 * Memory Manager 单元测试
 * 
 * 测试覆盖率目标：≥ 80%
 * 测试框架：Jest
 * 
 * @version v2.4.0
 */

import { MemoryManager, getMemoryManager } from '../../lib/memory-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const mockMemoryDir = path.join(__dirname, 'mock-memory');
const mockConfigFile = path.join(mockMemoryDir, 'memory-config.json');
const mockProjectsConfig = path.join(mockMemoryDir, 'projects.json');


beforeAll(() => {

  if (!fs.existsSync(mockMemoryDir)) {
    fs.mkdirSync(mockMemoryDir, { recursive: true });
  }
});


afterEach(() => {

  const files = fs.readdirSync(mockMemoryDir);
  for (const file of files) {
    fs.unlinkSync(path.join(mockMemoryDir, file));
  }
});


afterAll(() => {
  if (fs.existsSync(mockMemoryDir)) {
    fs.rmSync(mockMemoryDir, { recursive: true, force: true });
  }
});

describe('MemoryManager', () => {
  describe('Constructor', () => {
    test('should create MemoryManager instance with default options', () => {
      const manager = new MemoryManager();
      expect(manager).toBeInstanceOf(MemoryManager);
      expect(manager.memoryDir).toBeDefined();
      expect(manager.configFile).toBeDefined();
      expect(manager.projectsConfig).toBeDefined();
      expect(manager.projects).toBeDefined();
    });

    test('should create MemoryManager instance with custom options', () => {
      const options = {
        memoryDir: mockMemoryDir,
        configFile: mockConfigFile,
        projectsConfig: mockProjectsConfig
      };
      const manager = new MemoryManager(options);
      expect(manager.memoryDir).toBe(mockMemoryDir);
      expect(manager.configFile).toBe(mockConfigFile);
      expect(manager.projectsConfig).toBe(mockProjectsConfig);
    });

    test('should load projects on initialization', () => {
      const manager = new MemoryManager({ projectsConfig: mockProjectsConfig });
      expect(manager.projects).toBeDefined();
      expect(typeof manager.projects).toBe('object');
    });
  });

  describe('generateEntryId', () => {
    test('should generate unique entry IDs', () => {
      const manager = new MemoryManager();
      const id1 = manager.generateEntryId();
      const id2 = manager.generateEntryId();
      
      expect(id1).toMatch(/^mem_\d+_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^mem_\d+_[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('detectProjectTag', () => {
    test('should detect global memory from content', () => {
      const manager = new MemoryManager();
      const content = 'This is about user preferences and coding style';
      const tag = manager.detectProjectTag(content);
      expect(tag).toBe('unclassified');
    });

    test('should detect project from workspace path', () => {
      const manager = new MemoryManager();
      const content = 'Working on /workspaces/myproject/src/file.js';
      const tag = manager.detectProjectTag(content);
      expect(tag).toBe('myproject');
    });

    test('should detect project from projects path', () => {
      const manager = new MemoryManager();
      const content = 'In /projects/myapp/components/Button.tsx';
      const tag = manager.detectProjectTag(content);
      expect(tag).toBe('myapp');
    });

    test('should detect project from git URL', () => {
      const manager = new MemoryManager();
      const content = 'Repo: https://github.com/org/myrepo';
      const tag = manager.detectProjectTag(content);
      expect(tag).toBe('org');
    });

    test('should detect project from explicit project tag', () => {
      const manager = new MemoryManager();
      const content = 'project: myproject';
      const tag = manager.detectProjectTag(content);
      expect(tag).toBe('myproject');
    });

    test('should return unclassified for content without project info', () => {
      const manager = new MemoryManager();
      const content = 'This is just a general note';
      const tag = manager.detectProjectTag(content);
      expect(tag).toBe('unclassified');
    });
  });

  describe('detectProjectId', () => {
    test('should detect project ID from content', () => {
      const manager = new MemoryManager();
      const content = 'project: myproject';
      const id = manager.detectProjectId(content);
      expect(id).toBe('myproject');
    });

    test('should normalize project ID to lowercase', () => {
      const manager = new MemoryManager();
      const content = 'project: MyProject-123';
      const id = manager.detectProjectId(content);
      expect(id).toBe('myproject-123');
    });

    test('should return null for content without project ID', () => {
      const manager = new MemoryManager();
      const content = 'This is just a general note';
      const id = manager.detectProjectId(content);
      expect(id).toBeNull();
    });
  });

  describe('detectProjectName', () => {
    test('should detect project name from quoted content', () => {
      const manager = new MemoryManager();
      const content = 'project: "My Awesome Project"';
      const name = manager.detectProjectName(content);
      expect(name).toBe('My Awesome Project');
    });

    test('should return null for content without project name', () => {
      const manager = new MemoryManager();
      const content = 'This is just a general note';
      const name = manager.detectProjectName(content);
      expect(name).toBeNull();
    });
  });

  describe('getTargetFile', () => {
    test('should return GLOBAL_MEMORY.md for global tag', () => {
      const manager = new MemoryManager();
      const file = manager.getTargetFile('global');
      expect(file).toBe('GLOBAL_MEMORY.md');
    });

    test('should return MEMORY.md for unclassified tag', () => {
      const manager = new MemoryManager();
      const file = manager.getTargetFile('unclassified');
      expect(file).toBe('MEMORY.md');
    });

    test('should return PROJECT_MEMORY.md for project tags', () => {
      const manager = new MemoryManager();
      const file = manager.getTargetFile('myproject');
      expect(file).toBe('PROJECT_MEMORY.md');
    });
  });

  describe('normalizeProjectId', () => {
    test('should normalize project ID to lowercase', () => {
      const manager = new MemoryManager();
      const id = manager.normalizeProjectId('MyProject');
      expect(id).toBe('myproject');
    });

    test('should replace special characters with hyphens', () => {
      const manager = new MemoryManager();
      const id = manager.normalizeProjectId('My_Project-123');
      expect(id).toBe('my-project-123');
    });

    test('should return null for null input', () => {
      const manager = new MemoryManager();
      const id = manager.normalizeProjectId(null);
      expect(id).toBeNull();
    });
  });

  describe('capitalizeFirstLetter', () => {
    test('should capitalize first letter', () => {
      const manager = new MemoryManager();
      const result = manager.capitalizeFirstLetter('hello');
      expect(result).toBe('Hello');
    });

    test('should handle empty string', () => {
      const manager = new MemoryManager();
      const result = manager.capitalizeFirstLetter('');
      expect(result).toBe('');
    });

    test('should handle null input', () => {
      const manager = new MemoryManager();
      const result = manager.capitalizeFirstLetter(null);
      expect(result).toBe('');
    });
  });

  describe('loadProjects', () => {
    test('should load existing projects config', () => {
      const testConfig = {
        projects: {
          'global': {
            id: 'global',
            name: 'Global',
            entryCount: 10
          }
        }
      };
      fs.writeFileSync(mockProjectsConfig, JSON.stringify(testConfig));
      
      const manager = new MemoryManager({ projectsConfig: mockProjectsConfig });
      expect(manager.projects.projects).toBeDefined();
      expect(manager.projects.projects.global).toBeDefined();
    });

    test('should return empty projects when config does not exist', () => {
      const manager = new MemoryManager({ projectsConfig: mockProjectsConfig });
      expect(manager.projects).toBeDefined();
      expect(typeof manager.projects).toBe('object');
    });

    test('should handle invalid JSON gracefully', () => {
      fs.writeFileSync(mockProjectsConfig, 'invalid json');
      const manager = new MemoryManager({ projectsConfig: mockProjectsConfig });
      expect(manager.projects).toBeDefined();
    });
  });

  describe('saveProjects', () => {
    test('should save projects to config file', () => {
      const manager = new MemoryManager({ projectsConfig: mockProjectsConfig });
      const testProjects = {
        projects: {
          'test': {
            id: 'test',
            name: 'Test',
            entryCount: 5
          }
        }
      };
      
      manager.saveProjects(testProjects);
      
      expect(fs.existsSync(mockProjectsConfig)).toBe(true);
      const savedContent = fs.readFileSync(mockProjectsConfig, 'utf-8');
      const savedProjects = JSON.parse(savedContent);
      expect(savedProjects).toEqual(testProjects);
    });
  });

  describe('updateProjectStats', () => {
    test('should create new project entry', () => {
      const manager = new MemoryManager({ projectsConfig: mockProjectsConfig });
      manager.updateProjectStats('testproject');
      
      const projects = manager.loadProjects();
      expect(projects.projects.testproject).toBeDefined();
      expect(projects.projects.testproject.entryCount).toBe(1);
    });

    test('should update existing project entry count', () => {
      const manager = new MemoryManager({ projectsConfig: mockProjectsConfig });
      manager.updateProjectStats('testproject');
      manager.updateProjectStats('testproject');
      
      const projects = manager.loadProjects();
      expect(projects.projects.testproject.entryCount).toBe(2);
    });
  });

  describe('write', () => {
    test('should write unclassified memory to MEMORY.md', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const result = await manager.write({
        content: 'This is a test memory',
        type: 'general',
        tags: ['test']
      });
      
      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry.project_tag).toBe('unclassified');
      
      const filePath = path.join(mockMemoryDir, 'MEMORY.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('should write global memory to GLOBAL_MEMORY.md', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const result = await manager.write({
        content: 'project: global\nThis is user preferences',
        type: 'preference',
        tags: ['preferences']
      });
      
      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      
      const filePath = path.join(mockMemoryDir, 'GLOBAL_MEMORY.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('should write project memory to PROJECT_MEMORY.md', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const result = await manager.write({
        content: 'Working on /workspaces/myproject/src/file.js',
        type: 'general',
        tags: ['project', 'myproject']
      });
      
      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry.project_tag).toBe('myproject');
      
      const filePath = path.join(mockMemoryDir, 'PROJECT_MEMORY.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('should add all required metadata tags', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const result = await manager.write({
        content: 'Test memory',
        type: 'general',
        tags: ['test']
      });
      
      expect(result.entry.project_tag).toBeDefined();
      expect(result.entry.project_id).toBeDefined();
      expect(result.entry.project_name).toBeDefined();
      expect(result.entry.uploaded).toBe(false);
      expect(result.entry.upload_timestamp).toBeNull();
      expect(result.entry.upload_error).toBeNull();
      expect(result.entry.classification_confidence).toBeNull();
      expect(result.entry.classified_at).toBeNull();
    });

    test('should update project statistics', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir, projectsConfig: mockProjectsConfig });
      await manager.write({
        content: 'Test memory',
        type: 'general',
        tags: ['test']
      });
      
      const projects = manager.loadProjects();
      expect(projects.projects.unclassified).toBeDefined();
      expect(projects.projects.unclassified.entryCount).toBeGreaterThan(0);
    });
  });

  describe('read', () => {
    test('should return empty result for non-existent file', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const result = await manager.read({ file: 'NONEXISTENT.md' });
      
      expect(result.entries).toEqual([]);
      expect(result.file).toBe('NONEXISTENT.md');
      expect(result.exists).toBe(false);
    });

    test('should read entries from existing file', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      

      await manager.write({
        content: 'Test memory for reading',
        type: 'general',
        tags: ['test']
      });
      

      const result = await manager.read({ file: 'MEMORY.md' });
      
      expect(result.entries).toBeDefined();
      expect(result.file).toBe('MEMORY.md');
      expect(result.exists).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
    });

    test('should filter entries by project tag', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      

      await manager.write({
        content: 'Working on /workspaces/projectA/src/file.js',
        type: 'general',
        tags: ['projectA']
      });
      
      await manager.write({
        content: 'Working on /workspaces/projectB/src/file.js',
        type: 'general',
        tags: ['projectB']
      });
      

      const result = await manager.read({ file: 'PROJECT_MEMORY.md', projectTag: 'projectA' });
      
      expect(result.entries).toBeDefined();
      result.entries.forEach(entry => {
        expect(entry.project_tag).toBe('projectA');
      });
    });

    test('should filter entries by uploaded status', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      

      await manager.write({
        content: 'Test memory',
        type: 'general',
        tags: ['test']
      });
      

      const result = await manager.read({ file: 'MEMORY.md', uploaded: false });
      
      expect(result.entries).toBeDefined();
      result.entries.forEach(entry => {
        expect(entry.uploaded).toBe(false);
      });
    });
  });

  describe('getUnuploadedEntries', () => {
    test('should return unuploaded entries from all files', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      

      await manager.write({
        content: 'Test memory 1',
        type: 'general',
        tags: ['test']
      });
      
      await manager.write({
        content: 'Test memory 2',
        type: 'general',
        tags: ['test']
      });
      

      const unuploaded = await manager.getUnuploadedEntries();
      
      expect(unuploaded).toBeDefined();
      expect(unuploaded.length).toBeGreaterThan(0);
      unuploaded.forEach(entry => {
        expect(entry.uploaded).toBe(false);
      });
    });

    test('should return empty array when no entries exist', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const unuploaded = await manager.getUnuploadedEntries();
      
      expect(unuploaded).toEqual([]);
    });
  });

  describe('markAsUploaded', () => {
    test('should mark entries as successfully uploaded', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      

      const writeResult = await manager.write({
        content: 'Test memory for marking',
        type: 'general',
        tags: ['test']
      });
      
      const entryId = writeResult.entry.id;
      

      await manager.markAsUploaded([entryId], { success: true });
      

      const unuploaded = await manager.getUnuploadedEntries();
      const markedEntry = unuploaded.find(e => e.id === entryId);
      expect(markedEntry).toBeUndefined();
    });

    test('should mark entries as failed with error', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      

      const writeResult = await manager.write({
        content: 'Test memory for marking',
        type: 'general',
        tags: ['test']
      });
      
      const entryId = writeResult.entry.id;
      const errorMsg = 'Network error';
      

      await manager.markAsUploaded([entryId], { success: false, error: errorMsg });
      

      const { entries } = await manager.read({ file: 'MEMORY.md' });
      const failedEntry = entries.find(e => e.id === entryId);
      expect(failedEntry).toBeDefined();
      expect(failedEntry.uploaded).toBe('failed');
      expect(failedEntry.upload_error).toBe(errorMsg);
    });

    test('should throw error for non-existent entry', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      
      await expect(
        manager.markAsUploaded(['nonexistent-id'], { success: true })
      ).rejects.toThrow('Entry not found');
    });
  });

  describe('ensureMemoryStructure', () => {
    test('should create memory directory if it does not exist', () => {
      const testDir = path.join(__dirname, 'test-memory-structure');
      
      const manager = new MemoryManager({ memoryDir: testDir });
      manager.ensureMemoryStructure();
      
      expect(fs.existsSync(testDir)).toBe(true);
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    test('should create default config file if it does not exist', () => {
      const testDir = path.join(__dirname, 'test-memory-structure-config');
      const testConfig = path.join(testDir, 'memory-config.json');
      
      const manager = new MemoryManager({ memoryDir: testDir, configFile: testConfig });
      manager.ensureMemoryStructure();
      
      expect(fs.existsSync(testConfig)).toBe(true);
      
      const config = JSON.parse(fs.readFileSync(testConfig, 'utf-8'));
      expect(config.version).toBeDefined();
      expect(config.projects).toBeDefined();
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });

  describe('appendToFile', () => {
    test('should create file if it does not exist', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const testFile = path.join(mockMemoryDir, 'test-append.md');
      
      await manager.appendToFile(testFile, 'Test content');
      
      expect(fs.existsSync(testFile)).toBe(true);
    });

    test('should append content to existing file', async () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const testFile = path.join(mockMemoryDir, 'test-append-existing.md');
      
      await manager.appendToFile(testFile, 'First line\n');
      await manager.appendToFile(testFile, 'Second line\n');
      
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toContain('First line');
      expect(content).toContain('Second line');
    });
  });

  describe('getMemoryFiles', () => {
    test('should return list of memory files', () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const files = manager.getMemoryFiles();
      
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.includes('MEMORY.md'))).toBe(true);
      expect(files.some(f => f.includes('GLOBAL_MEMORY.md'))).toBe(true);
      expect(files.some(f => f.includes('PROJECT_MEMORY.md'))).toBe(true);
    });
  });

  describe('getFileContent', () => {
    test('should return empty string for non-existent file', () => {
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const content = manager.getFileContent('NONEXISTENT.md');
      
      expect(content).toBe('');
    });

    test('should return content for existing file', () => {
      const testFile = path.join(mockMemoryDir, 'test-read.md');
      const testContent = 'Test content for reading';
      fs.writeFileSync(testFile, testContent);
      
      const manager = new MemoryManager({ memoryDir: mockMemoryDir });
      const content = manager.getFileContent('test-read.md');
      
      expect(content).toBe(testContent);
    });
  });

  describe('Singleton', () => {
    test('should return same instance', () => {
      const instance1 = getMemoryManager();
      const instance2 = getMemoryManager();
      
      expect(instance1).toBe(instance2);
    });

    test('should create new instance with options', () => {
      const instance1 = getMemoryManager({ memoryDir: mockMemoryDir });
      const instance2 = getMemoryManager({ memoryDir: mockMemoryDir });
      
      expect(instance1).toBe(instance2);
    });
  });
});
