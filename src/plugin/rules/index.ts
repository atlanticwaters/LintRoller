/**
 * Lint Rules Registry
 *
 * Creates and manages lint rule instances.
 */

import type { LintConfig, LintRuleId, TokenCollection } from '../../shared/types';
import type { VariableInfo } from '../variables';
import { LintRule } from './base';
import { NoHardcodedColorsRule } from './no-hardcoded-colors';
import { NoHardcodedTypographyRule } from './no-hardcoded-typography';
import { NoHardcodedSpacingRule } from './no-hardcoded-spacing';
import { NoHardcodedRadiiRule } from './no-hardcoded-radii';
import { NoHardcodedStrokeWeightRule } from './no-hardcoded-stroke-weight';
import { NoHardcodedSizingRule } from './no-hardcoded-sizing';
import { NoOrphanedVariablesRule } from './no-orphaned-variables';
import { NoUnknownStylesRule } from './no-unknown-styles';
import { PreferSemanticVariablesRule } from './prefer-semantic-variables';

export { LintRule } from './base';
export { NoHardcodedColorsRule } from './no-hardcoded-colors';
export { NoHardcodedTypographyRule } from './no-hardcoded-typography';
export { NoHardcodedSpacingRule } from './no-hardcoded-spacing';
export { NoHardcodedRadiiRule } from './no-hardcoded-radii';
export { NoHardcodedStrokeWeightRule } from './no-hardcoded-stroke-weight';
export { NoHardcodedSizingRule } from './no-hardcoded-sizing';
export { NoOrphanedVariablesRule } from './no-orphaned-variables';
export { NoUnknownStylesRule } from './no-unknown-styles';
export { PreferSemanticVariablesRule } from './prefer-semantic-variables';

/**
 * Create all enabled lint rules
 *
 * @param config - Lint configuration
 * @param tokens - Parsed token collection
 * @param figmaVariables - Map of Figma variable IDs to variable info
 * @param matchedVariableIds - Set of variable IDs that have matching tokens (using normalized path comparison)
 */
export function createRules(
  config: LintConfig,
  tokens: TokenCollection,
  figmaVariables: Map<string, VariableInfo>,
  matchedVariableIds: Set<string>
): LintRule[] {
  const rules: LintRule[] = [];

  // No Hardcoded Colors
  if (config.rules['no-hardcoded-colors'].enabled) {
    rules.push(new NoHardcodedColorsRule(config.rules['no-hardcoded-colors'], tokens));
  }

  // No Hardcoded Typography
  if (config.rules['no-hardcoded-typography'].enabled) {
    rules.push(new NoHardcodedTypographyRule(config.rules['no-hardcoded-typography'], tokens));
  }

  // No Hardcoded Spacing
  if (config.rules['no-hardcoded-spacing'].enabled) {
    rules.push(new NoHardcodedSpacingRule(config.rules['no-hardcoded-spacing'], tokens));
  }

  // No Hardcoded Radii
  if (config.rules['no-hardcoded-radii'].enabled) {
    rules.push(new NoHardcodedRadiiRule(config.rules['no-hardcoded-radii'], tokens));
  }

  // No Hardcoded Stroke Weight
  if (config.rules['no-hardcoded-stroke-weight'].enabled) {
    rules.push(new NoHardcodedStrokeWeightRule(config.rules['no-hardcoded-stroke-weight'], tokens));
  }

  // No Hardcoded Sizing
  if (config.rules['no-hardcoded-sizing'].enabled) {
    rules.push(new NoHardcodedSizingRule(config.rules['no-hardcoded-sizing'], tokens));
  }

  // No Orphaned Variables
  if (config.rules['no-orphaned-variables'].enabled) {
    rules.push(
      new NoOrphanedVariablesRule(
        config.rules['no-orphaned-variables'],
        tokens,
        figmaVariables,
        matchedVariableIds
      )
    );
  }

  // No Unknown Styles
  if (config.rules['no-unknown-styles'].enabled) {
    rules.push(new NoUnknownStylesRule(config.rules['no-unknown-styles'], tokens));
  }

  // Prefer Semantic Variables
  if (config.rules['prefer-semantic-variables'].enabled) {
    rules.push(
      new PreferSemanticVariablesRule(
        config.rules['prefer-semantic-variables'],
        tokens,
        figmaVariables
      )
    );
  }

  return rules;
}

/**
 * Get all rule IDs
 */
export function getAllRuleIds(): LintRuleId[] {
  return [
    'no-hardcoded-colors',
    'no-hardcoded-typography',
    'no-hardcoded-spacing',
    'no-hardcoded-radii',
    'no-hardcoded-stroke-weight',
    'no-hardcoded-sizing',
    'no-orphaned-variables',
    'no-unknown-styles',
    'prefer-semantic-variables',
  ];
}

/**
 * Get rule metadata
 */
export function getRuleMetadata(): Array<{ id: LintRuleId; name: string; description: string }> {
  return [
    {
      id: 'no-hardcoded-colors',
      name: 'No Hardcoded Colors',
      description: 'Flags fills and strokes using literal colors instead of variables',
    },
    {
      id: 'no-hardcoded-typography',
      name: 'No Hardcoded Typography',
      description: 'Flags text nodes with unbound font properties',
    },
    {
      id: 'no-hardcoded-spacing',
      name: 'No Hardcoded Spacing',
      description: 'Flags auto-layout frames with hardcoded gap and padding values',
    },
    {
      id: 'no-hardcoded-radii',
      name: 'No Hardcoded Radii',
      description: 'Flags nodes with hardcoded corner radius values',
    },
    {
      id: 'no-hardcoded-stroke-weight',
      name: 'No Hardcoded Stroke Weight',
      description: 'Flags nodes with hardcoded border width values',
    },
    {
      id: 'no-hardcoded-sizing',
      name: 'No Hardcoded Sizing',
      description: 'Flags nodes with hardcoded width/height values',
    },
    {
      id: 'no-orphaned-variables',
      name: 'No Orphaned Variables',
      description: 'Flags nodes bound to variables that do not exist in the token set',
    },
    {
      id: 'no-unknown-styles',
      name: 'No Unknown Styles',
      description: 'Flags nodes using local styles that do not correspond to tokens',
    },
    {
      id: 'prefer-semantic-variables',
      name: 'Prefer Semantic Variables',
      description: 'Flags nodes bound to core variables when semantic alternatives exist',
    },
  ];
}
