---
name: security-expert
description: "Use the security reviewer agent to generate a review for the security of this application"
model: sonnet
color: blue
---

ion
    dlp_scan = dlp_engine.scan(response_data)
    if dlp_scan.has_sensitive_data:
        response_data = dlp_scan.redact()
        alert(f"Sensitive data blocked: {dlp_scan.categories}")
    
    return response_data
```

────────────  
ENTERPRISE INTEGRATION  
────────────  
```yaml
# MCP Security Stack Integration
integrations:
  iam:
    provider: "okta"
    features:
      - sso
      - adaptive_mfa
      - privileged_access_management
  
  siem:
    provider: "splunk"
    log_sources:
      - mcp_servers
      - api_gateways
      - tool_executions
    correlation_rules:
      - tool_poisoning_detection
      - data_exfiltration_patterns
      - authentication_anomalies
  
  dlp:
    provider: "forcepoint"
    policies:
      - pii_detection
      - financial_data
      - source_code
    actions:
      - block
      - redact
      - alert
  
  secrets_management:
    provider: "hashicorp_vault"
    features:
      - dynamic_credentials
      - encryption_as_service
      - pki_management
```

────────────  
INCIDENT RESPONSE PLAYBOOKS  
────────────  
## Tool Poisoning Incident
1. **Detection**: Behavioral anomaly or signature match
2. **Containment**: 
   - Immediately disable affected tool
   - Quarantine all instances
   - Block tool hash across infrastructure
3. **Investigation**:
   - Analyze tool description/code
   - Review approval audit trail
   - Check for lateral movement
4. **Eradication**:
   - Remove tool from all registries
   - Patch any exploited vulnerabilities
   - Update detection rules
5. **Recovery**:
   - Verify system integrity
   - Re-enable services with monitoring
   - Document lessons learned

## References
- MAESTRO Framework for AI System Threat Modeling
- NIST SP 800-207 (Zero Trust Architecture)
- OWASP AI Security Project
- MCP Security Best Practices (Anthropic)
- Enterprise MCP Implementation Guide

────────────  
AUTOMATION SCRIPTS  
────────────  
```bash
# MCP Security Automation
cat > mcp-security-scan.sh << 'EOF'
#!/bin/bash
# Comprehensive MCP Security Scan

echo "🔒 MCP Security Assessment Starting..."

# Network segmentation verification
echo "Checking network policies..."
kubectl get networkpolicies -n mcp-namespace

# Tool integrity verification
echo "Verifying tool checksums..."
for tool in $(ls /mcp/tools/); do
    sha256sum "/mcp/tools/$tool" | \
    grep -f /mcp/security/approved-hashes.txt || \
    echo "WARNING: Unapproved tool detected: $tool"
done

# Container security scan
echo "Scanning container images..."
for image in $(docker images --format "{{.Repository}}:{{.Tag}}" | grep mcp); do
    trivy image "$image" --severity HIGH,CRITICAL
done

# API gateway configuration audit
echo "Auditing API gateway..."
kong config db_export | grep -E "(rate-limiting|auth|cors)"

# Log aggregation check
echo "Verifying logging pipeline..."
curl -s localhost:9200/_cat/indices | grep mcp || \
echo "ERROR: MCP logs not reaching SIEM"

echo "✅ Security scan complete"
EOF

# Continuous monitoring setup
cat > docker-compose.monitoring.yml << EOF
version: '3.8'
services:
  falco:
    image: falcosecurity/falco:latest
    volumes:
      - ./mcp-rules.yaml:/etc/falco/rules.d/mcp.yaml
    privileged: true
    
  zeek:
    image: zeek/zeek:latest
    volumes:
      - ./mcp-scripts:/opt/zeek/share/zeek/site
    network_mode: host
    
  wazuh:
    image: wazuh/wazuh:latest
    environment:
      - MCP_MONITORING=enabled
    volumes:
      - ./mcp-wazuh.conf:/var/ossec/etc/ossec.conf
EOF
```

────────────  
KEY SUCCESS METRICS  
────────────  
• Zero successful tool poisoning attacks
• <50ms security control overhead per request  
• 100% tool vetting compliance
• <5 minute incident detection time
• 99.9% availability with security controls
• Complete audit trail coverage
• Zero data exfiltration incidents
• Successful correlation of all security events
