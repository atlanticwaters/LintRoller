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
import { NoOrphanedVariablesRule } from './no-orphaned-variables';
import { NoUnknownStylesRule } from './no-unknown-styles';

export { LintRule } from './base';
export { NoHardcodedColorsRule } from './no-hardcoded-colors';
export { NoHardcodedTypographyRule } from './no-hardcoded-typography';
export { NoHardcodedSpacingRule } from './no-hardcoded-spacing';
export { NoHardcodedRadiiRule } from './no-hardcoded-radii';
export { NoOrphanedVariablesRule } from './no-orphaned-variables';
export { NoUnknownStylesRule } from './no-unknown-styles';

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
    'no-orphaned-variables',
    'no-unknown-styles',
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
      id: 'no-orphaned-variables',
      name: 'No Orphaned Variables',
      description: 'Flags nodes bound to variables that do not exist in the token set',
    },
    {
      id: 'no-unknown-styles',
      name: 'No Unknown Styles',
      description: 'Flags nodes using local styles that do not correspond to tokens',
    },
  ];
}
