/**
 * Figma Document Scanner
 *
 * Traverses Figma documents and collects nodes for linting.
 */

import type { LintConfig, ScanScope } from '../shared/types';

/**
 * Options for node gathering
 */
interface GatherOptions {
  skipHidden: boolean;
  skipLocked: boolean;
}

/**
 * Scanner class for traversing Figma documents
 */
export class FigmaScanner {
  private config: LintConfig;

  constructor(config: LintConfig) {
    this.config = config;
  }

  /**
   * Gather all nodes to scan based on scope
   */
  async gatherNodes(scope: ScanScope): Promise<SceneNode[]> {
    const options: GatherOptions = {
      skipHidden: this.config.skipHiddenLayers,
      skipLocked: this.config.skipLockedLayers,
    };

    switch (scope.type) {
      case 'selection':
        return this.flattenNodes(figma.currentPage.selection as SceneNode[], options);

      case 'current_page':
        return this.flattenNodes(figma.currentPage.children as SceneNode[], options);

      case 'full_document': {
        const allNodes: SceneNode[] = [];
        for (const page of figma.root.children) {
          const pageNodes = this.flattenNodes(page.children as SceneNode[], options);
          allNodes.push(...pageNodes);
        }
        return allNodes;
      }
    }
  }

  /**
   * Flatten a node tree into an array, respecting skip options
   */
  private flattenNodes(nodes: readonly SceneNode[], options: GatherOptions): SceneNode[] {
    const result: SceneNode[] = [];

    const traverse = (node: SceneNode) => {
      // Skip hidden nodes if configured
      if (options.skipHidden && 'visible' in node && !node.visible) {
        return;
      }

      // Skip locked nodes if configured
      if (options.skipLocked && 'locked' in node && node.locked) {
        return;
      }

      // Add this node
      result.push(node);

      // Recurse into children
      if ('children' in node) {
        // For instances, optionally skip invisible children for performance
        const children = node.children as SceneNode[];
        for (const child of children) {
          traverse(child);
        }
      }
    };

    for (const node of nodes) {
      traverse(node);
    }

    return result;
  }

  /**
   * Get the layer path for a node (e.g., "Frame > Group > Rectangle")
   */
  static getLayerPath(node: SceneNode): string {
    const path: string[] = [node.name];
    let current: BaseNode | null = node.parent;

    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
      path.unshift(current.name);
      current = current.parent;
    }

    return path.join(' > ');
  }

  /**
   * Navigate to a node in Figma
   */
  static async selectNode(nodeId: string): Promise<boolean> {
    const node = figma.getNodeById(nodeId) as SceneNode | null;

    if (!node) {
      return false;
    }

    // Navigate to the page containing the node
    let page = node.parent;
    while (page && page.type !== 'PAGE') {
      page = page.parent;
    }

    if (page && page.type === 'PAGE') {
      await figma.setCurrentPageAsync(page);
    }

    // Select and zoom to the node
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);

    return true;
  }
}

/**
 * Process nodes in chunks to avoid blocking the UI
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => R,
  onProgress?: (processed: number, total: number) => void,
  chunkSize = 100
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    for (const item of chunk) {
      results.push(processor(item));
    }

    // Report progress
    const processed = Math.min(i + chunkSize, total);
    onProgress?.(processed, total);

    // Yield to prevent blocking
    if (i + chunkSize < total) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return results;
}
