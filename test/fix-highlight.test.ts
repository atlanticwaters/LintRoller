/**
 * Fix Highlight Tests
 *
 * Verifies that:
 * 1. FigmaScanner.selectNode is called before each fix in bulk operations
 * 2. A selectNode failure (throw) does NOT prevent the fix from executing
 * 3. A selectNode returning false does NOT prevent the fix from executing
 * 4. Progress callbacks still fire correctly with selectNode in the loop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock FigmaScanner BEFORE importing fixer ─────────────────────────────
const mockSelectNode = vi.fn().mockResolvedValue(true);

vi.mock('../src/plugin/scanner', () => ({
  FigmaScanner: {
    selectNode: (...args: unknown[]) => mockSelectNode(...args),
  },
}));

// ─── Mock figma global ────────────────────────────────────────────────────
const mockGetNodeByIdAsync = vi.fn();
const mockGetNodeById = vi.fn();
const mockGetLocalVariablesAsync = vi.fn().mockResolvedValue([]);
const mockGetLocalVariableCollectionsAsync = vi.fn().mockResolvedValue([]);
const mockGetAvailableLibraryVariableCollectionsAsync = vi.fn().mockResolvedValue([]);

(globalThis as Record<string, unknown>).figma = {
  getNodeByIdAsync: mockGetNodeByIdAsync,
  getNodeById: mockGetNodeById,
  variables: {
    getLocalVariablesAsync: mockGetLocalVariablesAsync,
    getLocalVariableCollectionsAsync: mockGetLocalVariableCollectionsAsync,
  },
  teamLibrary: {
    getAvailableLibraryVariableCollectionsAsync: mockGetAvailableLibraryVariableCollectionsAsync,
  },
  currentPage: { selection: [] },
  viewport: { scrollAndZoomIntoView: vi.fn() },
};

// ─── Import fixer AFTER mocks are set up ──────────────────────────────────
import { applyBulkFix, bulkDetachStyles } from '../src/plugin/fixer';

// ─── Test Helpers ─────────────────────────────────────────────────────────

function createMockNode(id: string, name: string) {
  return {
    id,
    name,
    type: 'RECTANGLE',
    fills: [],
    strokes: [],
    parent: { type: 'PAGE', parent: null },
    boundVariables: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('applyBulkFix - node highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getNodeByIdAsync returns a mock node so applyFix runs the full path
    mockGetNodeByIdAsync.mockImplementation((id: string) =>
      Promise.resolve(createMockNode(id, 'MockNode'))
    );
  });

  it('calls selectNode for each fix in the batch', async () => {
    const fixes = [
      { nodeId: '1:1', property: 'fills[0]', tokenPath: 'color/primary', ruleId: 'no-hardcoded-colors' },
      { nodeId: '2:2', property: 'fills[0]', tokenPath: 'color/secondary', ruleId: 'no-hardcoded-colors' },
      { nodeId: '3:3', property: 'paddingTop', tokenPath: 'spacing/md', ruleId: 'no-hardcoded-spacing' },
    ];

    await applyBulkFix(fixes, [], undefined, null);

    expect(mockSelectNode).toHaveBeenCalledTimes(3);
    expect(mockSelectNode).toHaveBeenNthCalledWith(1, '1:1');
    expect(mockSelectNode).toHaveBeenNthCalledWith(2, '2:2');
    expect(mockSelectNode).toHaveBeenNthCalledWith(3, '3:3');
  });

  it('continues fixing when selectNode throws', async () => {
    // selectNode throws for every call
    mockSelectNode.mockRejectedValue(new Error('Node removed'));

    const fixes = [
      { nodeId: '1:1', property: 'fills[0]', tokenPath: 'color/primary', ruleId: 'no-hardcoded-colors' },
      { nodeId: '2:2', property: 'fills[0]', tokenPath: 'color/secondary', ruleId: 'no-hardcoded-colors' },
    ];

    const progressCalls: number[] = [];
    const result = await applyBulkFix(fixes, [], (p) => {
      progressCalls.push(p.current);
    }, null);

    // All fixes should have been attempted (they'll fail because no variable found, but that's OK)
    expect(result.successful + result.failed).toBe(2);
    // Progress should still be reported for each fix
    expect(progressCalls).toEqual([1, 2]);
    // selectNode was called for each fix (even though it threw)
    expect(mockSelectNode).toHaveBeenCalledTimes(2);
  });

  it('continues fixing when selectNode returns false', async () => {
    // selectNode returns false (node not in memory)
    mockSelectNode.mockResolvedValue(false);

    const fixes = [
      { nodeId: '1:1', property: 'fills[0]', tokenPath: 'color/primary', ruleId: 'no-hardcoded-colors' },
    ];

    const result = await applyBulkFix(fixes, [], undefined, null);

    // Fix should still be attempted
    expect(result.successful + result.failed).toBe(1);
    expect(mockSelectNode).toHaveBeenCalledWith('1:1');
  });

  it('calls selectNode BEFORE applyFix for each item', async () => {
    const callOrder: string[] = [];

    mockSelectNode.mockImplementation(async (nodeId: string) => {
      callOrder.push(`select:${nodeId}`);
      return true;
    });

    mockGetNodeByIdAsync.mockImplementation(async (nodeId: string) => {
      callOrder.push(`getNode:${nodeId}`);
      return createMockNode(nodeId, 'Node');
    });

    const fixes = [
      { nodeId: '1:1', property: 'fills[0]', tokenPath: 'color/primary', ruleId: 'no-hardcoded-colors' },
    ];

    await applyBulkFix(fixes, [], undefined, null);

    // selectNode must come before getNodeByIdAsync (which is the first thing applyFix does)
    const selectIdx = callOrder.indexOf('select:1:1');
    const getNodeIdx = callOrder.indexOf('getNode:1:1');
    expect(selectIdx).toBeLessThan(getNodeIdx);
  });

  it('reports actions for all fixes even when selectNode fails', async () => {
    // First call throws, second succeeds
    mockSelectNode
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(true);

    const fixes = [
      { nodeId: '1:1', property: 'fills[0]', tokenPath: 'color/a', ruleId: 'no-hardcoded-colors' },
      { nodeId: '2:2', property: 'fills[0]', tokenPath: 'color/b', ruleId: 'no-hardcoded-colors' },
    ];

    const result = await applyBulkFix(fixes, [], undefined, null);

    // Both fixes should have action records
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].nodeId).toBe('1:1');
    expect(result.actions[1].nodeId).toBe('2:2');
  });
});

describe('bulkDetachStyles - node highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // detachStyle calls getNodeByIdAsync internally
    mockGetNodeByIdAsync.mockImplementation((id: string) =>
      Promise.resolve(createMockNode(id, 'MockNode'))
    );
  });

  it('calls selectNode for each detach in the batch', async () => {
    const detaches = [
      { nodeId: '1:1', property: 'fillStyle' },
      { nodeId: '2:2', property: 'textStyle' },
    ];

    await bulkDetachStyles(detaches);

    expect(mockSelectNode).toHaveBeenCalledTimes(2);
    expect(mockSelectNode).toHaveBeenNthCalledWith(1, '1:1');
    expect(mockSelectNode).toHaveBeenNthCalledWith(2, '2:2');
  });

  it('continues detaching when selectNode throws', async () => {
    mockSelectNode.mockRejectedValue(new Error('Node removed'));

    const detaches = [
      { nodeId: '1:1', property: 'fillStyle' },
      { nodeId: '2:2', property: 'fillStyle' },
      { nodeId: '3:3', property: 'fillStyle' },
    ];

    const result = await bulkDetachStyles(detaches);

    // All detaches should have been attempted
    expect(result.successful + result.failed).toBe(3);
    expect(mockSelectNode).toHaveBeenCalledTimes(3);
  });

  it('continues detaching when selectNode returns false', async () => {
    mockSelectNode.mockResolvedValue(false);

    const detaches = [
      { nodeId: '1:1', property: 'fillStyle' },
    ];

    const result = await bulkDetachStyles(detaches);

    expect(result.successful + result.failed).toBe(1);
  });
});
