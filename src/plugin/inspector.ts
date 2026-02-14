/**
 * Property Inspector
 *
 * Inspects Figma node properties and detects variable bindings.
 */

import type { PropertyInspection } from '../shared/types';

/**
 * RGB color from Figma
 */
interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * RGBA color from Figma
 */
interface RGBA extends RGB {
  a: number;
}

/**
 * Convert Figma RGB(A) color to hex string
 */
export function rgbToHex(color: RGB | RGBA): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, '0');

  if ('a' in color && color.a < 1) {
    const a = Math.round(color.a * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}${a}`.toLowerCase();
  }

  return `#${r}${g}${b}`.toLowerCase();
}

/**
 * Property Inspector class
 */
export class PropertyInspector {
  /**
   * Inspect fills and strokes for color bindings.
   *
   * Paint-level variable bindings are stored on each paint object's
   * boundVariables.color property (set by setBoundVariableForPaint),
   * NOT on node.boundVariables.fills.
   */
  inspectPaints(node: SceneNode): PropertyInspection[] {
    const results: PropertyInspection[] = [];

    // Check fills - read binding from each paint object directly
    if ('fills' in node && Array.isArray(node.fills)) {
      for (let i = 0; i < node.fills.length; i++) {
        const fill = node.fills[i] as Paint;
        if (fill.type === 'SOLID' && fill.visible !== false) {
          const solidFill = fill as SolidPaint;
          const paintBoundVars = (solidFill as unknown as {
            boundVariables?: { color?: { id: string } };
          }).boundVariables;
          const bindingId = paintBoundVars?.color?.id;
          // Include paint opacity so alpha colors are matched correctly
          const fillOpacity = solidFill.opacity;
          const fillRawValue = (fillOpacity !== undefined && fillOpacity < 1)
            ? { r: solidFill.color.r, g: solidFill.color.g, b: solidFill.color.b, a: fillOpacity }
            : solidFill.color;
          results.push({
            property: `fills[${i}]`,
            isBound: !!bindingId,
            boundVariableId: bindingId,
            rawValue: fillRawValue,
          });
        }
      }
    }

    // Check strokes - read binding from each paint object directly
    if ('strokes' in node && Array.isArray(node.strokes)) {
      for (let i = 0; i < node.strokes.length; i++) {
        const stroke = node.strokes[i] as Paint;
        if (stroke.type === 'SOLID' && stroke.visible !== false) {
          const solidStroke = stroke as SolidPaint;
          const paintBoundVars = (solidStroke as unknown as {
            boundVariables?: { color?: { id: string } };
          }).boundVariables;
          const bindingId = paintBoundVars?.color?.id;
          // Include paint opacity so alpha colors are matched correctly
          const strokeOpacity = solidStroke.opacity;
          const strokeRawValue = (strokeOpacity !== undefined && strokeOpacity < 1)
            ? { r: solidStroke.color.r, g: solidStroke.color.g, b: solidStroke.color.b, a: strokeOpacity }
            : solidStroke.color;
          results.push({
            property: `strokes[${i}]`,
            isBound: !!bindingId,
            boundVariableId: bindingId,
            rawValue: strokeRawValue,
          });
        }
      }
    }

    return results;
  }

  /**
   * Inspect typography properties on text nodes
   */
  inspectTypography(node: TextNode): PropertyInspection[] {
    const results: PropertyInspection[] = [];
    const boundVars = (node.boundVariables as Record<string, { id: string } | undefined>) || {};

    // If a text style is applied, skip typography checks
    // Text styles control fontSize, lineHeight, and letterSpacing
    const textStyleId = node.textStyleId;
    const hasTextStyle = textStyleId && textStyleId !== '' && typeof textStyleId !== 'symbol';

    if (hasTextStyle) {
      // Text style is applied, so typography is properly managed
      // Only check paragraphSpacing which is independent of text styles
      if (typeof node.paragraphSpacing === 'number' && node.paragraphSpacing > 0) {
        results.push({
          property: 'paragraphSpacing',
          isBound: !!boundVars.paragraphSpacing?.id,
          boundVariableId: boundVars.paragraphSpacing?.id,
          rawValue: node.paragraphSpacing,
        });
      }
      return results;
    }

    // Font size
    if (node.fontSize !== figma.mixed) {
      results.push({
        property: 'fontSize',
        isBound: !!boundVars.fontSize?.id,
        boundVariableId: boundVars.fontSize?.id,
        rawValue: node.fontSize,
      });
    }

    // Line height
    if (node.lineHeight !== figma.mixed) {
      const lineHeight = node.lineHeight as LineHeight;
      if (lineHeight.unit !== 'AUTO') {
        results.push({
          property: 'lineHeight',
          isBound: !!boundVars.lineHeight?.id,
          boundVariableId: boundVars.lineHeight?.id,
          rawValue: lineHeight.value,
        });
      }
    }

    // Letter spacing
    if (node.letterSpacing !== figma.mixed) {
      const letterSpacing = node.letterSpacing as LetterSpacing;
      if (letterSpacing.value !== 0) {
        results.push({
          property: 'letterSpacing',
          isBound: !!boundVars.letterSpacing?.id,
          boundVariableId: boundVars.letterSpacing?.id,
          rawValue: letterSpacing.value,
        });
      }
    }

    // Paragraph spacing
    if (typeof node.paragraphSpacing === 'number' && node.paragraphSpacing > 0) {
      results.push({
        property: 'paragraphSpacing',
        isBound: !!boundVars.paragraphSpacing?.id,
        boundVariableId: boundVars.paragraphSpacing?.id,
        rawValue: node.paragraphSpacing,
      });
    }

    return results;
  }

  /**
   * Inspect spacing/layout properties on auto-layout frames
   */
  inspectSpacing(node: FrameNode | ComponentNode | InstanceNode): PropertyInspection[] {
    const results: PropertyInspection[] = [];
    const boundVars = (node.boundVariables as Record<string, { id: string } | undefined>) || {};

    // Only inspect auto-layout frames
    if (node.layoutMode === 'NONE') {
      return results;
    }

    // Item spacing (gap)
    if (node.itemSpacing > 0) {
      results.push({
        property: 'itemSpacing',
        isBound: !!boundVars.itemSpacing?.id,
        boundVariableId: boundVars.itemSpacing?.id,
        rawValue: node.itemSpacing,
      });
    }

    // Counter axis spacing (for wrap)
    if ('counterAxisSpacing' in node && node.counterAxisSpacing !== null && node.counterAxisSpacing > 0) {
      results.push({
        property: 'counterAxisSpacing',
        isBound: !!boundVars.counterAxisSpacing?.id,
        boundVariableId: boundVars.counterAxisSpacing?.id,
        rawValue: node.counterAxisSpacing,
      });
    }

    // Padding
    const paddingProps = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;
    for (const prop of paddingProps) {
      const value = node[prop];
      if (value > 0) {
        results.push({
          property: prop,
          isBound: !!boundVars[prop]?.id,
          boundVariableId: boundVars[prop]?.id,
          rawValue: value,
        });
      }
    }

    return results;
  }

  /**
   * Inspect corner radius properties
   */
  inspectRadius(node: SceneNode): PropertyInspection[] {
    const results: PropertyInspection[] = [];

    if (!('cornerRadius' in node)) {
      return results;
    }

    const boundVars = (node.boundVariables as Record<string, { id: string } | undefined>) || {};

    // Check if using uniform corner radius
    if (typeof node.cornerRadius === 'number') {
      if (node.cornerRadius > 0) {
        // Check for any corner binding (uniform uses topLeftRadius internally)
        results.push({
          property: 'cornerRadius',
          isBound: !!boundVars.topLeftRadius?.id,
          boundVariableId: boundVars.topLeftRadius?.id,
          rawValue: node.cornerRadius,
        });
      }
    } else {
      // Individual corners
      const corners = [
        { prop: 'topLeftRadius', value: (node as RectangleNode).topLeftRadius },
        { prop: 'topRightRadius', value: (node as RectangleNode).topRightRadius },
        { prop: 'bottomLeftRadius', value: (node as RectangleNode).bottomLeftRadius },
        { prop: 'bottomRightRadius', value: (node as RectangleNode).bottomRightRadius },
      ];

      for (const corner of corners) {
        if (corner.value > 0) {
          results.push({
            property: corner.prop,
            isBound: !!boundVars[corner.prop]?.id,
            boundVariableId: boundVars[corner.prop]?.id,
            rawValue: corner.value,
          });
        }
      }
    }

    return results;
  }

  /**
   * Inspect width and height sizing
   */
  inspectSize(node: SceneNode): PropertyInspection[] {
    const results: PropertyInspection[] = [];

    if (!('width' in node) || !('height' in node)) {
      return results;
    }

    const boundVars = (node.boundVariables as Record<string, { id: string } | undefined>) || {};

    // Width
    if (node.width > 0) {
      results.push({
        property: 'width',
        isBound: !!boundVars.width?.id,
        boundVariableId: boundVars.width?.id,
        rawValue: node.width,
      });
    }

    // Height
    if (node.height > 0) {
      results.push({
        property: 'height',
        isBound: !!boundVars.height?.id,
        boundVariableId: boundVars.height?.id,
        rawValue: node.height,
      });
    }

    // Min width/height
    if ('minWidth' in node && node.minWidth !== null && node.minWidth > 0) {
      results.push({
        property: 'minWidth',
        isBound: !!boundVars.minWidth?.id,
        boundVariableId: boundVars.minWidth?.id,
        rawValue: node.minWidth,
      });
    }

    if ('minHeight' in node && node.minHeight !== null && node.minHeight > 0) {
      results.push({
        property: 'minHeight',
        isBound: !!boundVars.minHeight?.id,
        boundVariableId: boundVars.minHeight?.id,
        rawValue: node.minHeight,
      });
    }

    // Max width/height
    if ('maxWidth' in node && node.maxWidth !== null && node.maxWidth > 0) {
      results.push({
        property: 'maxWidth',
        isBound: !!boundVars.maxWidth?.id,
        boundVariableId: boundVars.maxWidth?.id,
        rawValue: node.maxWidth,
      });
    }

    if ('maxHeight' in node && node.maxHeight !== null && node.maxHeight > 0) {
      results.push({
        property: 'maxHeight',
        isBound: !!boundVars.maxHeight?.id,
        boundVariableId: boundVars.maxHeight?.id,
        rawValue: node.maxHeight,
      });
    }

    return results;
  }

  /**
   * Inspect effects (shadows, blurs)
   */
  inspectEffects(node: SceneNode): PropertyInspection[] {
    const results: PropertyInspection[] = [];

    if (!('effects' in node) || !Array.isArray(node.effects)) {
      return results;
    }

    for (let i = 0; i < node.effects.length; i++) {
      const effect = node.effects[i];
      if (effect.visible === false) continue;

      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        // Shadow color
        results.push({
          property: `effects[${i}].color`,
          isBound: false, // Effects don't support variable bindings currently
          rawValue: effect.color,
        });

        // Shadow offset, radius, spread could also be checked
        results.push({
          property: `effects[${i}].radius`,
          isBound: false,
          rawValue: effect.radius,
        });
      }
    }

    return results;
  }

  /**
   * Inspect stroke weight (border width) properties
   */
  inspectStrokeWeight(node: SceneNode): PropertyInspection[] {
    const results: PropertyInspection[] = [];

    // Skip COMPONENT_SET — its dashed border is Figma-managed
    if (node.type === 'COMPONENT_SET') {
      return results;
    }

    if (!('strokes' in node) || !Array.isArray(node.strokes)) {
      return results;
    }

    // Only inspect if at least one stroke is visible
    const hasVisibleStroke = node.strokes.some((s: Paint) => s.visible !== false);
    if (!hasVisibleStroke) {
      return results;
    }

    const boundVars = (node.boundVariables as Record<string, { id: string } | undefined>) || {};

    // Uniform stroke weight
    if ('strokeWeight' in node && typeof node.strokeWeight === 'number' && node.strokeWeight > 0) {
      results.push({
        property: 'strokeWeight',
        isBound: !!boundVars.strokeWeight?.id,
        boundVariableId: boundVars.strokeWeight?.id,
        rawValue: node.strokeWeight,
      });
    }

    // Per-side stroke weights
    const perSideProps = ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'] as const;
    for (const prop of perSideProps) {
      if (prop in node) {
        const value = (node as unknown as Record<string, unknown>)[prop];
        if (typeof value === 'number' && value > 0) {
          results.push({
            property: prop,
            isBound: !!boundVars[prop]?.id,
            boundVariableId: boundVars[prop]?.id,
            rawValue: value,
          });
        }
      }
    }

    return results;
  }

  /**
   * Get all inspections for a node based on its type
   */
  inspectNode(node: SceneNode): PropertyInspection[] {
    const inspections: PropertyInspection[] = [];

    // Always inspect paints (fills/strokes), radius, and stroke weight
    inspections.push(...this.inspectPaints(node));
    inspections.push(...this.inspectRadius(node));
    inspections.push(...this.inspectStrokeWeight(node));

    // Typography for text nodes
    if (node.type === 'TEXT') {
      inspections.push(...this.inspectTypography(node));
    }

    // Spacing for auto-layout frames
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
      inspections.push(...this.inspectSpacing(node));
    }

    // Sizing (width, height, min/max)
    inspections.push(...this.inspectSize(node));

    // Effects
    inspections.push(...this.inspectEffects(node));

    return inspections;
  }
}
