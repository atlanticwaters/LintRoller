/**
 * Base Lint Rule
 *
 * Abstract base class for all lint rules.
 */

import type {
  LintRuleId,
  LintViolation,
  PropertyInspection,
  RuleConfig,
  TokenCollection,
} from '../../shared/types';
import { FigmaScanner } from '../scanner';

/**
 * Abstract base class for lint rules
 */
export abstract class LintRule {
  /** Unique identifier for this rule */
  abstract readonly id: LintRuleId;

  /** Human-readable name */
  abstract readonly name: string;

  /** Description of what this rule checks */
  abstract readonly description: string;

  /** Rule configuration */
  protected config: RuleConfig;

  /** Token collection for lookups */
  protected tokens: TokenCollection;

  constructor(config: RuleConfig, tokens: TokenCollection) {
    this.config = config;
    this.tokens = tokens;
  }

  /**
   * Check a node for violations of this rule
   * Returns violations or a Promise of violations (for async rules)
   */
  abstract check(node: SceneNode, inspections: PropertyInspection[]): LintViolation[] | Promise<LintViolation[]>;

  /**
   * Create a violation object
   */
  protected createViolation(
    node: SceneNode,
    property: string,
    currentValue: string | number,
    message: string,
    suggestedToken?: string
  ): LintViolation {
    return {
      id: `${this.id}-${node.id}-${property}`,
      ruleId: this.id,
      severity: this.config.severity,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      layerPath: FigmaScanner.getLayerPath(node),
      property,
      currentValue,
      message,
      suggestedToken,
    };
  }

  /**
   * Check if this rule is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
