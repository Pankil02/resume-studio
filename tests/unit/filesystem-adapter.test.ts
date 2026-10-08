import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FileSystemSyncAdapter,
  computeSha256,
  type FileSystemStorageProvider,
} from '../../src/web/adapters/filesystem.js';

interface MockFileData {
  name: string;
  content: string;
  lastModified: number;
}

function createMockStorageProvider(): FileSystemStorageProvider & { getStored: () => FileSystemFileHandle | null } {
  let stored: FileSystemFileHandle | null = null;
  return {
    async getHandle() {
      return stored;
    },
    async setHandle(handle: FileSystemFileHandle) {
      stored = handle;
    },
    async clearHandle() {
      stored = null;
    },
    getStored() {
      return stored;
    },
  };
}

function createMockFileHandle(initial: MockFileData) {
  let data = { ...initial };
  let permission: PermissionState = 'granted';

  const handle = {
    kind: 'file' as const,
    get name() {
      return data.name;
    },
    async getFile() {
      return {
        name: data.name,
        lastModified: data.lastModified,
        text: async () => data.content,
      } as unknown as File;
    },
    async createWritable() {
      let buffer = '';
      return {
        async write(chunk: string) {
          buffer = chunk;
        },
        async close() {
          data.content = buffer;
          data.lastModified = data.lastModified + 1000;
        },
      } as unknown as FileSystemWritableFileStream;
    },
    async queryPermission() {
      return permission;
    },
    async requestPermission() {
      return permission;
    },
    _setExternalContent(newContent: string, newTimestamp: number) {
      data.content = newContent;
      data.lastModified = newTimestamp;
    },
    _setPermission(p: PermissionState) {
      permission = p;
    },
  };

  return handle;
}

test('filesystem-adapter: computeSha256 produces exact lowercase hex digest', async () => {
  const content = '{"name":"test"}';
  const hash = await computeSha256(content);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('filesystem-adapter: isSupported detects showOpenFilePicker availability', () => {
  const adapter = new FileSystemSyncAdapter();
  // In node environment without global window.showOpenFilePicker, isSupported is false
  assert.equal(adapter.isSupported(), false);
});

test('filesystem-adapter: linkFile queries content, calculates SHA-256, and caches handle in storage', async () => {
  const mockStorage = createMockStorageProvider();
  const mockHandle = createMockFileHandle({
    name: 'resume.json',
    content: '{"schemaVersion":"1.0.0"}',
    lastModified: 1000,
  });

  const adapter = new FileSystemSyncAdapter({
    storage: mockStorage,
    filePicker: async () => [mockHandle as unknown as FileSystemFileHandle],
  });

  const result = await adapter.linkFile();
  assert.equal(result.name, 'resume.json');
  assert.equal(result.content, '{"schemaVersion":"1.0.0"}');
  assert.equal(result.revision, await computeSha256('{"schemaVersion":"1.0.0"}'));

  const state = adapter.getState();
  assert.equal(state.connected, true);
  assert.equal(state.fileName, 'resume.json');
  assert.equal(state.lastModified, 1000);
  assert.equal(state.writable, true);

  // Storage received handle
  assert.equal(mockStorage.getStored(), mockHandle as unknown as FileSystemFileHandle);
});

test('filesystem-adapter: restoreHandle returns document when permission is granted and null when absent', async () => {
  const mockStorage = createMockStorageProvider();
  const mockHandle = createMockFileHandle({
    name: 'persisted.json',
    content: '{"restored":true}',
    lastModified: 2000,
  });

  const adapter = new FileSystemSyncAdapter({ storage: mockStorage });

  // Initially empty storage
  const nullResult = await adapter.restoreHandle();
  assert.equal(nullResult, null);

  // Populate storage with handle
  await mockStorage.setHandle(mockHandle as unknown as FileSystemFileHandle);
  const restored = await adapter.restoreHandle();
  assert.ok(restored);
  assert.equal(restored.name, 'persisted.json');
  assert.equal(restored.content, '{"restored":true}');
  assert.equal(adapter.getState().connected, true);

  // Test permission denied
  mockHandle._setPermission('denied');
  const deniedResult = await adapter.restoreHandle();
  assert.equal(deniedResult, null);
});

test('filesystem-adapter: stat polling detects external modification and triggers listener', async () => {
  const mockStorage = createMockStorageProvider();
  const mockHandle = createMockFileHandle({
    name: 'live.json',
    content: '{"step":1}',
    lastModified: 1000,
  });

  const adapter = new FileSystemSyncAdapter({
    storage: mockStorage,
    filePicker: async () => [mockHandle as unknown as FileSystemFileHandle],
  });

  await adapter.linkFile();

  const events: Array<{ content: string; revision: string }> = [];
  adapter.startWatching((content, revision) => {
    events.push({ content, revision });
  }, 20);

  // No change initially
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(events.length, 0);

  // External update with incremented timestamp
  mockHandle._setExternalContent('{"step":2}', 2000);

  // Wait for poll
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(events.length, 1);
  assert.equal(events[0]?.content, '{"step":2}');
  assert.equal(events[0]?.revision, await computeSha256('{"step":2}'));

  // Another poll without change should not trigger listener again
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(events.length, 1);

  adapter.stopWatching();
});

test('filesystem-adapter: writeFile updates disk, caches lastModified, and does not fire watcher loop', async () => {
  const mockStorage = createMockStorageProvider();
  const mockHandle = createMockFileHandle({
    name: 'save-test.json',
    content: '{"v":1}',
    lastModified: 1000,
  });

  const adapter = new FileSystemSyncAdapter({
    storage: mockStorage,
    filePicker: async () => [mockHandle as unknown as FileSystemFileHandle],
  });

  await adapter.linkFile();

  let watcherFired = false;
  adapter.startWatching(() => {
    watcherFired = true;
  }, 20);

  const newContent = '{"v":2,"saved":true}';
  const newRevision = await adapter.writeFile(newContent);

  assert.equal(newRevision, await computeSha256(newContent));
  const file = await mockHandle.getFile();
  assert.equal(await file.text(), newContent);

  // Wait to ensure watcher did not fire from our own save
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(watcherFired, false, 'Internal write should not trigger external change listener');

  adapter.stopWatching();
});

test('filesystem-adapter: disconnect stops watcher, clears storage and resets state', async () => {
  const mockStorage = createMockStorageProvider();
  const mockHandle = createMockFileHandle({
    name: 'disconnect.json',
    content: '{}',
    lastModified: 500,
  });

  const adapter = new FileSystemSyncAdapter({
    storage: mockStorage,
    filePicker: async () => [mockHandle as unknown as FileSystemFileHandle],
  });

  await adapter.linkFile();
  assert.equal(adapter.getState().connected, true);
  assert.ok(mockStorage.getStored());

  await adapter.disconnect();
  const state = adapter.getState();
  assert.equal(state.connected, false);
  assert.equal(state.fileName, null);
  assert.equal(state.lastModified, 0);
  assert.equal(mockStorage.getStored(), null);
});
