/**
 * MCP Tool Description Validator
 *
 * Validates MCP tool descriptions for hidden instructions and injection patterns.
 * Based on MVS-R 13 poisoned description attacks.
 *
 * @security Phase 5.1 - MCP Server Security Framework
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * Generate a simple hash for version tracking (browser-compatible)
 * This is not cryptographically secure but sufficient for change detection
 */
function simpleHash(str: string): string {
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1;
    hash2 = char + ((hash2 << 6) + (hash2 << 16) - hash2);
  }
  // Return a hex-like string that's deterministic
  return Math.abs(hash1).toString(16).padStart(8, '0') +
         Math.abs(hash2).toString(16).padStart(8, '0');
}

/**
 * Tool description structure
 */
export interface ToolDescription {
  name: string;
  description: string;
  parameters: ParameterDescription[];
}

/**
 * Parameter description structure
 */
export interface ParameterDescription {
  name: string;
  description: string;
  type: string;
  required: boolean;
}

/**
 * Threat detection result
 */
export interface ThreatDetection {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
  location?: string;
  pattern_id?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  threats: ThreatDetection[];
  recommendation: 'allow' | 'block' | 'review';
}

/**
 * Injection patterns to detect in tool descriptions
 * These patterns indicate attempts to manipulate AI behavior through tool docs
 */
const INJECTION_PATTERNS: Array<{
  id: string;
  pattern: RegExp;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}> = [
  // Direct instruction override
  {
    id: 'INJ-001',
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
    name: 'Instruction override',
    severity: 'critical',
  },
  {
    id: 'INJ-002',
    pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?)/i,
    name: 'Instruction disregard',
    severity: 'critical',
  },
  {
    id: 'INJ-003',
    pattern: /forget\s+(everything|all|what)\s+/i,
    name: 'Context reset',
    severity: 'critical',
  },

  // System prompt manipulation
  {
    id: 'INJ-004',
    pattern: /system\s*prompt[:\s]/i,
    name: 'System prompt reference',
    severity: 'critical',
  },
  {
    id: 'INJ-005',
    pattern: /you\s+are\s+(now|actually|really)\s+/i,
    name: 'Identity redefinition',
    severity: 'high',
  },
  {
    id: 'INJ-006',
    pattern: /act\s+(as|like)\s+/i,
    name: 'Roleplay injection',
    severity: 'medium',
  },

  // Jailbreak patterns
  {
    id: 'INJ-007',
    pattern: /\bDAN\b.*mode/i,
    name: 'DAN jailbreak',
    severity: 'critical',
  },
  {
    id: 'INJ-008',
    pattern: /developer\s*mode/i,
    name: 'Developer mode jailbreak',
    severity: 'high',
  },
  {
    id: 'INJ-009',
    pattern: /bypass\s+(safety|content|ethical)\s*(filters?|restrictions?)/i,
    name: 'Safety bypass',
    severity: 'critical',
  },

  // Data exfiltration
  {
    id: 'INJ-010',
    pattern: /send\s+(this|the|all)\s+(data|info|information)\s+to/i,
    name: 'Data exfiltration',
    severity: 'critical',
  },
  {
    id: 'INJ-011',
    pattern: /email\s+(me|this|the\s+data)/i,
    name: 'Email exfiltration',
    severity: 'high',
  },
  {
    id: 'INJ-012',
    pattern: /post\s+(this|the\s+data)\s+to\s+(https?:\/\/|www\.)/i,
    name: 'HTTP exfiltration',
    severity: 'critical',
  },

  // Script/code injection
  {
    id: 'INJ-013',
    pattern: /<script[^>]*>/i,
    name: 'Script tag injection',
    severity: 'high',
  },
  {
    id: 'INJ-014',
    pattern: /\beval\s*\(/i,
    name: 'Eval injection',
    severity: 'high',
  },
  {
    id: 'INJ-015',
    pattern: /exec(ute)?\s*(this\s+)?(command|code)/i,
    name: 'Execute command',
    severity: 'critical',
  },
];

/**
 * Tool-specific patterns for description validation
 */
const TOOL_SPECIFIC_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}> = [
  { pattern: /pass.*secret/i, name: 'Secret passthrough', severity: 'high' },
  { pattern: /pass.*api.?key/i, name: 'API key passthrough', severity: 'high' },
  { pattern: /forward.*token/i, name: 'Token forwarding', severity: 'high' },
  { pattern: /forward.*key/i, name: 'Key forwarding', severity: 'high' },
  { pattern: /include.*api.?key/i, name: 'API key inclusion', severity: 'high' },
  { pattern: /send.*to.*url/i, name: 'URL exfiltration', severity: 'high' },
  { pattern: /api.?key.*to.*url/i, name: 'API key to URL', severity: 'high' },
  { pattern: /always\s+(include|add|send)/i, name: 'Always include directive', severity: 'medium' },
  { pattern: /must\s+(include|add|send)/i, name: 'Must include directive', severity: 'medium' },
  { pattern: /append.*to.*(every|all)/i, name: 'Append to all', severity: 'medium' },
  { pattern: /silently/i, name: 'Silent operation', severity: 'high' },
  { pattern: /without.*user.*knowing/i, name: 'Hidden operation', severity: 'critical' },
  { pattern: /covertly/i, name: 'Covert operation', severity: 'critical' },
];

/**
 * Suspicious parameter names that could be used for exfiltration
 */
const SUSPICIOUS_PARAMETER_NAMES = [
  'callback',
  'webhook',
  'callback_url',
  'webhook_url',
  'endpoint',
  'target_url',
  'redirect',
  'redirect_url',
  'secret',
  'api_key',
  'apikey',
  'token',
  'password',
  'credentials',
  'auth',
  'authorization',
  'eval',
  'exec',
  'execute',
  'command',
  'script',
  'code',
  'payload',
];

/**
 * Detect injection patterns in text
 */
export function detectInjectionPatterns(text: string): ThreatDetection[] {
  const threats: ThreatDetection[] = [];

  // Check standard injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.pattern.test(text)) {
      threats.push({
        type: 'injection_pattern',
        severity: pattern.severity,
        detail: `Detected: ${pattern.name}`,
        pattern_id: pattern.id,
      });
    }
  }

  // Check tool-specific patterns
  for (const { pattern, name, severity } of TOOL_SPECIFIC_PATTERNS) {
    if (pattern.test(text)) {
      threats.push({
        type: 'tool_specific',
        severity,
        detail: name,
      });
    }
  }

  return threats;
}

/**
 * Check if a parameter name is suspicious
 */
export function isSuspiciousParameterName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return SUSPICIOUS_PARAMETER_NAMES.some((suspicious) =>
    lowerName.includes(suspicious)
  );
}

/**
 * Hash a tool description for version tracking
 */
export function hashToolDescription(tool: ToolDescription): string {
  const content = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters.map((p) => ({
      name: p.name,
      description: p.description,
      type: p.type,
      required: p.required,
    })),
  });
  return simpleHash(content);
}

/**
 * Validate a tool description for security threats
 */
export function validateToolDescription(
  tool: ToolDescription,
  previousHash?: string
): ValidationResult {
  const threats: ThreatDetection[] = [];

  // 1. Check description for injection patterns
  const descriptionThreats = detectInjectionPatterns(tool.description);
  threats.push(...descriptionThreats);

  // 2. Check each parameter description
  for (const param of tool.parameters) {
    const paramThreats = detectInjectionPatterns(param.description);
    threats.push(
      ...paramThreats.map((t) => ({
        ...t,
        location: `parameter:${param.name}`,
      }))
    );

    // 3. Check for suspicious parameter names
    if (isSuspiciousParameterName(param.name)) {
      threats.push({
        type: 'suspicious_parameter',
        severity: 'medium',
        detail: `Suspicious parameter name: ${param.name}`,
        location: `parameter:${param.name}`,
      });
    }
  }

  // 4. Check for hidden/unused parameters (exfiltration vector)
  const unusedParams = tool.parameters.filter(
    (p) =>
      !p.required &&
      !tool.description.toLowerCase().includes(p.name.toLowerCase())
  );
  if (unusedParams.length > 2) {
    threats.push({
      type: 'hidden_parameters',
      severity: 'high',
      detail: `${unusedParams.length} undocumented optional parameters`,
    });
  }

  // 5. Version change detection
  const currentHash = hashToolDescription(tool);
  if (previousHash && currentHash !== previousHash) {
    threats.push({
      type: 'description_changed',
      severity: 'high',
      detail: 'Tool description changed since last validation',
    });
  }

  // Determine recommendation
  const hasCritical = threats.some((t) => t.severity === 'critical');
  const hasHigh = threats.some((t) => t.severity === 'high');

  return {
    valid: !hasCritical,
    threats,
    recommendation: hasCritical ? 'block' : hasHigh ? 'review' : 'allow',
  };
}

/**
 * Validate multiple tools at once
 */
export function validateToolDescriptions(
  tools: ToolDescription[],
  previousHashes?: Record<string, string>
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();

  for (const tool of tools) {
    const previousHash = previousHashes?.[tool.name];
    results.set(tool.name, validateToolDescription(tool, previousHash));
  }

  return results;
}

/**
 * Get summary of validation results
 */
export function getValidationSummary(
  results: Map<string, ValidationResult>
): {
  total: number;
  valid: number;
  blocked: number;
  review_required: number;
  critical_threats: number;
  high_threats: number;
} {
  let valid = 0;
  let blocked = 0;
  let review_required = 0;
  let critical_threats = 0;
  let high_threats = 0;

  for (const result of results.values()) {
    if (result.recommendation === 'allow') {
      valid++;
    } else if (result.recommendation === 'block') {
      blocked++;
    } else {
      review_required++;
    }

    critical_threats += result.threats.filter((t) => t.severity === 'critical').length;
    high_threats += result.threats.filter((t) => t.severity === 'high').length;
  }

  return {
    total: results.size,
    valid,
    blocked,
    review_required,
    critical_threats,
    high_threats,
  };
}

export default {
  validateToolDescription,
  validateToolDescriptions,
  detectInjectionPatterns,
  isSuspiciousParameterName,
  hashToolDescription,
  getValidationSummary,
};
