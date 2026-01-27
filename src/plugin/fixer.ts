/**
 * Auto-Fix Module
 *
 * Applies token bindings to fix lint violations.
 */

import type { LintRuleId, ThemeConfig } from '../shared/types';
import type { FixActionDetail } from '../shared/messages';
import { normalizePath, pathEndsWith, pathContains } from '../shared/path-utils';

/**
 * Result of applying a fix
 */
export interface FixResult {
  success: boolean;
  message?: string;
  /** Value before the fix was applied */
  beforeValue?: string;
  /** Value after the fix was applied */
  afterValue?: string;
  /** Type of fix action performed */
  actionType?: 'rebind' | 'unbind' | 'detach' | 'apply-style';
}

/**
 * Find a Figma variable that matches the given token path
 *
 * Note: The figmaVariableReferences in the themes file contain Tokens Studio
 * internal IDs (SHA-1 hashes), not Figma variable IDs (which look like
 * "VariableID:10:337"). So we must search by variable name instead.
 */
async function findVariableForToken(
  tokenPath: string,
  _themeConfigs: ThemeConfig[]
): Promise<Variable | null> {
  console.log('[Fixer] Looking for variable for token:', tokenPath);

  // Fall back to searching by name
  const variables = await figma.variables.getLocalVariablesAsync();
  console.log('[Fixer] Searching ' + variables.length + ' local variables by name');

  if (variables.length === 0) {
    console.log('[Fixer] No local variables found in document');
    return null;
  }

  // Normalize the token path for matching
  const normalizedTokenPath = normalizePath(tokenPath);
  console.log('[Fixer] Normalized token path:', normalizedTokenPath);

  // Extract just the last segment for partial matching
  const tokenPathSegments = normalizedTokenPath.split('/');
  const lastSegment = tokenPathSegments[tokenPathSegments.length - 1];

  for (const variable of variables) {
    const normalizedVarName = normalizePath(variable.name);
    const varNameSegments = normalizedVarName.split('/');
    const varLastSegment = varNameSegments[varNameSegments.length - 1];

    // Exact match on full path
    if (normalizedVarName === normalizedTokenPath) {
      console.log('[Fixer] Found exact name match:', variable.name);
      return variable;
    }

    // Check if token path ends with variable name (for nested tokens)
    if (pathEndsWith(tokenPath, variable.name)) {
      console.log('[Fixer] Found partial match (token ends with var):', variable.name);
      return variable;
    }

    // Check if variable name ends with token path
    if (pathEndsWith(variable.name, tokenPath)) {
      console.log('[Fixer] Found partial match (var ends with token):', variable.name);
      return variable;
    }

    // Check if last segments match (e.g., "brand-300" matches "brand/brand-300")
    if (lastSegment === varLastSegment) {
      console.log('[Fixer] Found last segment match:', variable.name);
      return variable;
    }

    // Check if variable name contains the token path
    if (pathContains(variable.name, tokenPath)) {
      console.log('[Fixer] Found contains match:', variable.name);
      return variable;
    }
  }

  // Log first few variables for debugging
  console.log('[Fixer] Sample variable names:', variables.slice(0, 5).map(v => v.name));
  console.log('[Fixer] No matching variable found for:', tokenPath);
  return null;
}

/**
 * Get a string representation of a color for display
 */
function colorToString(paint: SolidPaint): string {
  const r = Math.round(paint.color.r * 255);
  const g = Math.round(paint.color.g * 255);
  const b = Math.round(paint.color.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Apply a color variable to a fill or stroke
 */
async function applyColorFix(
  node: SceneNode,
  property: string,
  variable: Variable
): Promise<FixResult> {
  // Parse property to get fill/stroke index
  const fillMatch = property.match(/^fills\[(\d+)\]$/);
  const strokeMatch = property.match(/^strokes\[(\d+)\]$/);

  if (fillMatch && 'fills' in node) {
    const index = parseInt(fillMatch[1], 10);
    const fills = (node as GeometryMixin).fills;

    if (Array.isArray(fills) && fills[index]) {
      try {
        // Capture before value
        const paint = fills[index] as SolidPaint;
        const beforeValue = paint.boundVariables?.color
          ? `var(${paint.boundVariables.color.id})`
          : (paint.type === 'SOLID' ? colorToString(paint) : 'gradient/image');

        // Create a copy of the fills array
        const newFills = [...fills] as SolidPaint[];

        // Create bound variable reference
        const paintWithVariable = figma.variables.setBoundVariableForPaint(
          newFills[index] as SolidPaint,
          'color',
          variable
        );

        newFills[index] = paintWithVariable;
        (node as GeometryMixin).fills = newFills;

        return {
          success: true,
          beforeValue,
          afterValue: variable.name,
          actionType: 'rebind',
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to apply fill variable: ' + (error instanceof Error ? error.message : 'Unknown error'),
        };
      }
    }
  }

  if (strokeMatch && 'strokes' in node) {
    const index = parseInt(strokeMatch[1], 10);
    const strokes = (node as GeometryMixin).strokes;

    if (Array.isArray(strokes) && strokes[index]) {
      try {
        // Capture before value
        const paint = strokes[index] as SolidPaint;
        const beforeValue = paint.boundVariables?.color
          ? `var(${paint.boundVariables.color.id})`
          : (paint.type === 'SOLID' ? colorToString(paint) : 'gradient/image');

        const newStrokes = [...strokes] as SolidPaint[];

        const paintWithVariable = figma.variables.setBoundVariableForPaint(
          newStrokes[index] as SolidPaint,
          'color',
          variable
        );

        newStrokes[index] = paintWithVariable;
        (node as GeometryMixin).strokes = newStrokes;

        return {
          success: true,
          beforeValue,
          afterValue: variable.name,
          actionType: 'rebind',
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to apply stroke variable: ' + (error instanceof Error ? error.message : 'Unknown error'),
        };
      }
    }
  }

  return { success: false, message: 'Could not find property to fix: ' + property };
}

/**
 * Get the current value of a number property for before/after tracking
 */
function getNumberPropertyValue(node: SceneNode, property: string): string {
  const nodeWithProps = node as unknown as Record<string, unknown>;
  const boundVars = (node as unknown as { boundVariables?: Record<string, { id: string }> }).boundVariables;

  // Check if property has a bound variable
  if (boundVars && boundVars[property]) {
    return `var(${boundVars[property].id})`;
  }

  // Get the raw value
  const value = nodeWithProps[property];
  if (typeof value === 'number') {
    return String(value);
  }

  return 'unknown';
}

/**
 * Apply a number variable to a spacing/radius property
 */
async function applyNumberFix(
  node: SceneNode,
  property: string,
  variable: Variable
): Promise<FixResult> {
  try {
    // Check if the property can be bound
    if (!('boundVariables' in node)) {
      return { success: false, message: 'Node does not support variable bindings' };
    }

    // Map property names to their bindable field names
    const propertyMap: Record<string, VariableBindableNodeField> = {
      // Spacing
      itemSpacing: 'itemSpacing',
      counterAxisSpacing: 'counterAxisSpacing',
      paddingTop: 'paddingTop',
      paddingRight: 'paddingRight',
      paddingBottom: 'paddingBottom',
      paddingLeft: 'paddingLeft',
      // Radius
      cornerRadius: 'topLeftRadius', // Figma uses individual corners
      topLeftRadius: 'topLeftRadius',
      topRightRadius: 'topRightRadius',
      bottomLeftRadius: 'bottomLeftRadius',
      bottomRightRadius: 'bottomRightRadius',
    };

    const bindableField = propertyMap[property];
    if (!bindableField) {
      return { success: false, message: 'Property is not bindable: ' + property };
    }

    // Capture before value
    const beforeValue = getNumberPropertyValue(node, property);

    // Special handling for corner radius - if uniform, bind all corners
    if (property === 'cornerRadius' && 'cornerRadius' in node) {
      const cornerNode = node as RectangleNode | FrameNode | ComponentNode | InstanceNode;
      if (typeof cornerNode.cornerRadius === 'number') {
        // Uniform radius - bind all corners
        cornerNode.setBoundVariable('topLeftRadius', variable);
        cornerNode.setBoundVariable('topRightRadius', variable);
        cornerNode.setBoundVariable('bottomLeftRadius', variable);
        cornerNode.setBoundVariable('bottomRightRadius', variable);
        return {
          success: true,
          beforeValue,
          afterValue: variable.name,
          actionType: 'rebind',
        };
      }
    }

    // Bind the variable
    (node as SceneNode & { setBoundVariable: (field: VariableBindableNodeField, variable: Variable) => void })
      .setBoundVariable(bindableField, variable);

    return {
      success: true,
      beforeValue,
      afterValue: variable.name,
      actionType: 'rebind',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to apply variable: ' + (error instanceof Error ? error.message : 'Unknown error'),
    };
  }
}

/**
 * Apply a number variable to a typography property on a text node
 *
 * Note: Only paragraphSpacing can be bound to variables on text nodes.
 * fontSize, lineHeight, and letterSpacing are per-character range properties
 * and cannot be bound to variables through the standard API.
 * For these properties, use "Apply Style" to apply an existing text style instead.
 */
async function applyTypographyFix(
  node: SceneNode,
  property: string,
  variable: Variable
): Promise<FixResult> {
  if (node.type !== 'TEXT') {
    return { success: false, message: 'Node is not a text node' };
  }

  const textNode = node as TextNode;

  try {
    switch (property) {
      case 'paragraphSpacing': {
        // Capture before value
        const beforeValue = getNumberPropertyValue(textNode, 'paragraphSpacing');

        // Paragraph spacing can be bound to a variable at the node level
        textNode.setBoundVariable('paragraphSpacing', variable);
        return {
          success: true,
          beforeValue,
          afterValue: variable.name,
          actionType: 'rebind',
        };
      }

      case 'fontSize':
      case 'lineHeight':
      case 'letterSpacing':
        // These properties cannot be bound to variables - must use text styles
        return {
          success: false,
          message: property + ' cannot be bound to variables. Use "Apply Style" with an existing text style instead.',
        };

      default:
        return { success: false, message: 'Unknown typography property: ' + property };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Failed to apply typography fix: ' + errorMsg,
    };
  }
}

/**
 * Apply a fix to a single violation
 */
export async function applyFix(
  nodeId: string,
  property: string,
  tokenPath: string,
  ruleId: LintRuleId,
  themeConfigs: ThemeConfig[]
): Promise<FixResult> {
  console.log('[Fixer] applyFix called:', { nodeId, property, tokenPath, ruleId });

  try {
    // Find the node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
      console.log('[Fixer] Node not found:', nodeId);
      return { success: false, message: 'Node not found: ' + nodeId };
    }
    console.log('[Fixer] Found node:', node.name, node.type);

    // Find the variable for this token
    const variable = await findVariableForToken(tokenPath, themeConfigs);
    if (!variable) {
      const msg = 'No Figma variable found for token: ' + tokenPath + '. You may need to sync variables from Tokens Studio first.';
      console.log('[Fixer]', msg);
      return { success: false, message: msg };
    }
    console.log('[Fixer] Found variable:', variable.name, 'type:', variable.resolvedType);

    // Apply the fix based on rule type
    let result: FixResult;
    switch (ruleId) {
      case 'no-hardcoded-colors':
        result = await applyColorFix(node as SceneNode, property, variable);
        break;

      case 'no-hardcoded-spacing':
      case 'no-hardcoded-radii':
        result = await applyNumberFix(node as SceneNode, property, variable);
        break;

      case 'no-hardcoded-typography':
        result = await applyTypographyFix(node as SceneNode, property, variable);
        break;

      case 'no-orphaned-variables':
        // Rebind orphaned variable to a new token
        // Determine the fix type based on the variable type
        if (variable.resolvedType === 'COLOR') {
          result = await applyColorFix(node as SceneNode, property, variable);
        } else if (variable.resolvedType === 'FLOAT') {
          // Determine if it's spacing or radius based on property name
          if (property.includes('Radius') || property === 'cornerRadius') {
            result = await applyNumberFix(node as SceneNode, property, variable);
          } else if (property.includes('padding') || property.includes('Spacing') || property === 'itemSpacing' || property === 'counterAxisSpacing') {
            result = await applyNumberFix(node as SceneNode, property, variable);
          } else if (property === 'fontSize' || property === 'lineHeight' || property === 'letterSpacing' || property === 'paragraphSpacing') {
            result = await applyTypographyFix(node as SceneNode, property, variable);
          } else {
            result = await applyNumberFix(node as SceneNode, property, variable);
          }
        } else {
          result = { success: false, message: 'Cannot rebind variable of type: ' + variable.resolvedType };
        }
        break;

      default:
        result = { success: false, message: 'Auto-fix not supported for rule: ' + ruleId };
    }

    console.log('[Fixer] Fix result:', result);
    return result;
  } catch (error) {
    const msg = 'Fix error: ' + (error instanceof Error ? error.message : 'Unknown error');
    console.error('[Fixer]', msg, error);
    return { success: false, message: msg };
  }
}

/**
 * Callback for progress updates during bulk fix
 */
export type BulkFixProgressCallback = (progress: {
  current: number;
  total: number;
  currentAction: FixActionDetail;
}) => void;

/**
 * Apply fixes to multiple violations
 */
export async function applyBulkFix(
  fixes: Array<{
    nodeId: string;
    property: string;
    tokenPath: string;
    ruleId: string;
  }>,
  themeConfigs: ThemeConfig[],
  onProgress?: BulkFixProgressCallback
): Promise<{ successful: number; failed: number; errors: string[]; actions: FixActionDetail[] }> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];
  const actions: FixActionDetail[] = [];
  const total = fixes.length;

  for (let i = 0; i < fixes.length; i++) {
    const fix = fixes[i];

    // Get node name for display
    let nodeName = 'Unknown';
    try {
      const node = await figma.getNodeByIdAsync(fix.nodeId);
      if (node && 'name' in node) {
        nodeName = node.name;
      }
    } catch {
      // Ignore error, use default name
    }

    const result = await applyFix(
      fix.nodeId,
      fix.property,
      fix.tokenPath,
      fix.ruleId as LintRuleId,
      themeConfigs
    );

    const action: FixActionDetail = {
      nodeId: fix.nodeId,
      nodeName,
      property: fix.property,
      actionType: result.actionType || 'rebind',
      beforeValue: result.beforeValue || 'unknown',
      afterValue: result.afterValue || fix.tokenPath,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.message,
      timestamp: Date.now(),
    };

    actions.push(action);

    if (result.success) {
      successful++;
    } else {
      failed++;
      if (result.message) {
        errors.push(fix.nodeId + ': ' + result.message);
      }
    }

    // Send progress update
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        currentAction: action,
      });
    }

    // Yield to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return { successful, failed, errors, actions };
}

/**
 * Get the bound variable name from a paint if it has one
 */
function getBoundVariableFromPaint(paint: SolidPaint): string | null {
  if (paint.boundVariables?.color) {
    return paint.boundVariables.color.id;
  }
  return null;
}

/**
 * Unbind a variable from a property (for orphaned variables)
 * This removes the variable binding but keeps the current value
 */
export async function unbindVariable(
  nodeId: string,
  property: string
): Promise<FixResult> {
  console.log('[Fixer] unbindVariable called:', { nodeId, property });

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
      return { success: false, message: 'Node not found: ' + nodeId };
    }

    const sceneNode = node as SceneNode;

    // Handle fills and strokes
    const fillMatch = property.match(/^fills\[(\d+)\]$/);
    const strokeMatch = property.match(/^strokes\[(\d+)\]$/);

    if (fillMatch && 'fills' in sceneNode) {
      const index = parseInt(fillMatch[1], 10);
      const fills = (sceneNode as GeometryMixin).fills;

      if (Array.isArray(fills) && fills[index]) {
        const newFills = [...fills];
        const paint = newFills[index] as SolidPaint;

        // Capture before value
        const boundVarId = getBoundVariableFromPaint(paint);
        const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);

        // Create a new paint without the bound variable
        if (paint.type === 'SOLID') {
          newFills[index] = {
            type: 'SOLID',
            color: paint.color,
            opacity: paint.opacity,
            visible: paint.visible,
            blendMode: paint.blendMode,
          };
          (sceneNode as GeometryMixin).fills = newFills;
          return {
            success: true,
            beforeValue,
            afterValue: colorToString(paint),
            actionType: 'unbind',
          };
        }
      }
    }

    if (strokeMatch && 'strokes' in sceneNode) {
      const index = parseInt(strokeMatch[1], 10);
      const strokes = (sceneNode as GeometryMixin).strokes;

      if (Array.isArray(strokes) && strokes[index]) {
        const newStrokes = [...strokes];
        const paint = newStrokes[index] as SolidPaint;

        // Capture before value
        const boundVarId = getBoundVariableFromPaint(paint);
        const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);

        if (paint.type === 'SOLID') {
          newStrokes[index] = {
            type: 'SOLID',
            color: paint.color,
            opacity: paint.opacity,
            visible: paint.visible,
            blendMode: paint.blendMode,
          };
          (sceneNode as GeometryMixin).strokes = newStrokes;
          return {
            success: true,
            beforeValue,
            afterValue: colorToString(paint),
            actionType: 'unbind',
          };
        }
      }
    }

    // Handle text node properties
    if (sceneNode.type === 'TEXT' && property === 'paragraphSpacing') {
      const textNode = sceneNode as TextNode;
      const beforeValue = getNumberPropertyValue(textNode, 'paragraphSpacing');
      const currentValue = String(textNode.paragraphSpacing);
      textNode.setBoundVariable('paragraphSpacing', null);
      return {
        success: true,
        beforeValue,
        afterValue: currentValue,
        actionType: 'unbind',
      };
    }

    // Handle other bindable properties by setting them to null
    if ('setBoundVariable' in sceneNode) {
      const bindableNode = sceneNode as SceneNode & {
        setBoundVariable: (field: VariableBindableNodeField, variable: Variable | null) => void;
      };

      // Map of property names to bindable fields
      const propertyToField: Record<string, VariableBindableNodeField> = {
        itemSpacing: 'itemSpacing',
        counterAxisSpacing: 'counterAxisSpacing',
        paddingTop: 'paddingTop',
        paddingRight: 'paddingRight',
        paddingBottom: 'paddingBottom',
        paddingLeft: 'paddingLeft',
        topLeftRadius: 'topLeftRadius',
        topRightRadius: 'topRightRadius',
        bottomLeftRadius: 'bottomLeftRadius',
        bottomRightRadius: 'bottomRightRadius',
        cornerRadius: 'topLeftRadius',
      };

      const field = propertyToField[property];
      if (field) {
        // Capture before value
        const beforeValue = getNumberPropertyValue(sceneNode, property);
        const nodeWithProps = sceneNode as unknown as Record<string, unknown>;
        const currentValue = String(nodeWithProps[property] ?? 'unknown');

        // For corner radius, unbind all corners
        if (property === 'cornerRadius') {
          bindableNode.setBoundVariable('topLeftRadius', null);
          bindableNode.setBoundVariable('topRightRadius', null);
          bindableNode.setBoundVariable('bottomLeftRadius', null);
          bindableNode.setBoundVariable('bottomRightRadius', null);
        } else {
          bindableNode.setBoundVariable(field, null);
        }
        return {
          success: true,
          beforeValue,
          afterValue: currentValue,
          actionType: 'unbind',
        };
      }
    }

    return { success: false, message: 'Cannot unbind property: ' + property };
  } catch (error) {
    const msg = 'Unbind error: ' + (error instanceof Error ? error.message : 'Unknown error');
    console.error('[Fixer]', msg, error);
    return { success: false, message: msg };
  }
}

/**
 * Detach a style from a node (for unknown styles)
 * This removes the style binding but keeps the current visual appearance
 */
export async function detachStyle(
  nodeId: string,
  property: string
): Promise<FixResult> {
  console.log('[Fixer] detachStyle called:', { nodeId, property });

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
      return { success: false, message: 'Node not found: ' + nodeId };
    }

    const sceneNode = node as SceneNode;

    switch (property) {
      case 'fillStyle':
        if ('fillStyleId' in sceneNode) {
          const nodeWithStyle = sceneNode as GeometryMixin & { fillStyleId: string };
          const beforeValue = nodeWithStyle.fillStyleId || 'none';
          // Setting fillStyleId to empty string detaches the style
          nodeWithStyle.fillStyleId = '';
          return {
            success: true,
            message: 'Fill style detached',
            beforeValue,
            afterValue: 'detached',
            actionType: 'detach',
          };
        }
        break;

      case 'strokeStyle':
        if ('strokeStyleId' in sceneNode) {
          const nodeWithStyle = sceneNode as GeometryMixin & { strokeStyleId: string };
          const beforeValue = nodeWithStyle.strokeStyleId || 'none';
          nodeWithStyle.strokeStyleId = '';
          return {
            success: true,
            message: 'Stroke style detached',
            beforeValue,
            afterValue: 'detached',
            actionType: 'detach',
          };
        }
        break;

      case 'textStyle':
        if (sceneNode.type === 'TEXT') {
          const textNode = sceneNode as TextNode;
          const rawStyleId = textNode.textStyleId;
          const beforeValue = typeof rawStyleId === 'symbol' ? 'mixed' : (rawStyleId || 'none');
          // Setting textStyleId to empty string detaches the style (use async method)
          await textNode.setTextStyleIdAsync('');
          return {
            success: true,
            message: 'Text style detached',
            beforeValue,
            afterValue: 'detached',
            actionType: 'detach',
          };
        }
        break;

      case 'effectStyle':
        if ('effectStyleId' in sceneNode) {
          const nodeWithStyle = sceneNode as BlendMixin & { effectStyleId: string };
          const beforeValue = nodeWithStyle.effectStyleId || 'none';
          nodeWithStyle.effectStyleId = '';
          return {
            success: true,
            message: 'Effect style detached',
            beforeValue,
            afterValue: 'detached',
            actionType: 'detach',
          };
        }
        break;

      default:
        return { success: false, message: 'Unknown style property: ' + property };
    }

    return { success: false, message: 'Node does not support style: ' + property };
  } catch (error) {
    const msg = 'Detach style error: ' + (error instanceof Error ? error.message : 'Unknown error');
    console.error('[Fixer]', msg, error);
    return { success: false, message: msg };
  }
}

/**
 * Bulk detach styles from multiple nodes
 */
export async function bulkDetachStyles(
  detaches: Array<{
    nodeId: string;
    property: string;
  }>
): Promise<{ successful: number; failed: number; errors: string[] }> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const detach of detaches) {
    const result = await detachStyle(detach.nodeId, detach.property);

    if (result.success) {
      successful++;
    } else {
      failed++;
      if (result.message) {
        errors.push(detach.nodeId + ': ' + result.message);
      }
    }

    // Yield to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return { successful, failed, errors };
}

/**
 * Apply a text style to a text node
 */
export async function applyTextStyle(
  nodeId: string,
  textStyleId: string
): Promise<FixResult> {
  console.log('[Fixer] applyTextStyle called:', { nodeId, textStyleId });

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type !== 'TEXT') {
      return { success: false, message: 'Node not found or not a text node: ' + nodeId };
    }

    const textNode = node as TextNode;

    // Get the text style
    const style = await figma.getStyleByIdAsync(textStyleId);
    if (!style || style.type !== 'TEXT') {
      return { success: false, message: 'Text style not found: ' + textStyleId };
    }

    // Capture before value
    const rawStyleId = textNode.textStyleId;
    const beforeValue = typeof rawStyleId === 'symbol' ? 'mixed styles' : (rawStyleId || 'no style');

    // Apply the text style using async method (required for dynamic-page access)
    await textNode.setTextStyleIdAsync(textStyleId);

    return {
      success: true,
      beforeValue,
      afterValue: style.name,
      actionType: 'apply-style',
    };
  } catch (error) {
    const msg = 'Apply text style error: ' + (error instanceof Error ? error.message : 'Unknown error');
    console.error('[Fixer]', msg, error);
    return { success: false, message: msg };
  }
}
