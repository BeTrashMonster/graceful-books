# Security Checklist for Self-Hosted Sync Relay

Use this checklist to ensure your self-hosted sync relay is properly secured.

**Security by default** - The relay is designed with security in mind, but proper configuration is essential.

## Pre-Deployment Checklist

Complete these before going to production:

### Network Security

- [ ] **Firewall configured**
  - Only port 8787 (or your port) exposed
  - SSH port restricted to known IPs
  - All other ports blocked by default

  ```bash
  # Example (ufw)
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 22/tcp  # SSH (restrict source if possible)
  sudo ufw allow 8787/tcp
  sudo ufw enable
  ```

- [ ] **HTTPS enforced**
  - Valid SSL/TLS certificate installed
  - HTTP redirects to HTTPS
  - No plain HTTP traffic allowed

  ```nginx
  # Nginx example
  server {
      listen 80;
      return 301 https://$server_name$request_uri;
  }
  ```

- [ ] **Strong TLS configuration**
  - TLS 1.2 minimum (1.3 preferred)
  - Strong cipher suites only
  - HSTS enabled

  ```nginx
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
  ssl_prefer_server_ciphers on;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  ```

- [ ] **Reverse proxy hardened**
  - Request size limits enforced
  - Rate limiting enabled
  - Security headers configured

  ```nginx
  client_max_body_size 10M;
  limit_req_zone $binary_remote_addr zone=sync_limit:10m rate=60r/m;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;
  ```

### Access Control

- [ ] **Non-root user**
  - Relay runs as non-privileged user
  - User has minimal permissions

  ```bash
  # Docker: Built into Dockerfile (user gracefulbooks:1001)

  # Systemd:
  [Service]
  User=gracefulbooks
  Group=gracefulbooks
  ```

- [ ] **File permissions**
  - Database file: 640 (owner read/write, group read)
  - Config files: 640
  - Logs: 640
  - Binary: 755

  ```bash
  chmod 640 sync.db
  chmod 640 .env
  chmod 755 graceful-books-sync-linux-x64
  ```

- [ ] **SSH access restricted**
  - Password authentication disabled
  - SSH keys only
  - Root login disabled

  ```
  # /etc/ssh/sshd_config
  PermitRootLogin no
  PasswordAuthentication no
  PubkeyAuthentication yes
  ```

- [ ] **CORS configured**
  - Only known client origins allowed
  - No wildcard (`*`) in production

  ```bash
  # .env
  CORS_ORIGIN=https://app.gracefulbooks.com
  ```

### Environment & Configuration

- [ ] **Environment variables secured**
  - No secrets in code
  - `.env` file not in version control
  - Environment variables not logged

  ```bash
  # .gitignore
  .env
  .env.local
  .env.production
  ```

- [ ] **Strong secret key**
  - 32+ character random string
  - Rotated periodically

  ```bash
  # Generate
  openssl rand -hex 32

  # Set in .env
  SECRET_KEY=your-generated-key-here
  ```

- [ ] **Debug mode disabled**
  - `NODE_ENV=production`
  - `LOG_LEVEL=info` (not `debug`)
  - Error messages sanitized

  ```bash
  NODE_ENV=production
  LOG_LEVEL=info
  ```

- [ ] **Rate limiting enabled**
  - Prevents abuse and DoS
  - Appropriate limits set

  ```bash
  RATE_LIMIT_ENABLED=true
  MAX_REQUESTS_PER_MINUTE=60
  ```

### Database Security

- [ ] **Database encrypted**
  - File permissions restrict access
  - Encryption at rest (OS/disk level)
  - Regular backups encrypted

  ```bash
  # Backup with encryption
  tar -czf - sync.db | openssl enc -aes-256-cbc -salt -out sync-backup.tar.gz.enc
  ```

- [ ] **Database access restricted**
  - No remote access
  - Only relay process can access
  - No default passwords

  ```bash
  # Verify no network bindings
  netstat -an | grep 3306  # Should be empty (no MySQL)
  ```

- [ ] **Prepared statements used**
  - No SQL injection vulnerabilities
  - Input sanitization in place

  *Built into relay code - verify in source*

### Monitoring & Logging

- [ ] **Logging configured**
  - Security events logged
  - Logs rotated regularly
  - Logs protected from tampering

  ```yaml
  # docker-compose.yml
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  ```

- [ ] **Sensitive data not logged**
  - No encryption keys in logs
  - No user data in logs
  - IP addresses anonymized (optional)

  *Verify by reviewing logs*

- [ ] **Monitoring alerts set up**
  - Failed login attempts
  - High error rates
  - Unusual traffic patterns

  ```bash
  # Example: Alert on high error rate
  ERRORS=$(curl -s http://localhost:8787/metrics/sla | jq -r '.failed_requests')
  if [ $ERRORS -gt 100 ]; then
    echo "High error rate!" | mail -s "Alert" admin@example.com
  fi
  ```

### Updates & Patching

- [ ] **Update process defined**
  - Regular update schedule
  - Testing before production
  - Rollback plan ready

  ```bash
  # Weekly check for updates
  0 2 * * 1 docker pull gracefulbooks/sync-relay:latest && docker-compose up -d
  ```

- [ ] **Dependency scanning**
  - npm audit run regularly
  - Known vulnerabilities tracked
  - Updates applied promptly

  ```bash
  npm audit
  npm audit fix
  ```

- [ ] **OS security updates**
  - Automatic security updates enabled
  - Kernel up to date
  - Unnecessary services disabled

  ```bash
  # Ubuntu/Debian
  sudo apt-get update && sudo apt-get upgrade -y

  # Enable automatic security updates
  sudo dpkg-reconfigure -plow unattended-upgrades
  ```

## Post-Deployment Checklist

After deployment, verify:

### SSL/TLS Verification

- [ ] **SSL Labs A+ rating**
  - Test at: https://www.ssllabs.com/ssltest/
  - Should score A or A+
  - No major vulnerabilities

- [ ] **Certificate validity**
  - Not expired
  - Matches domain
  - Full chain included

  ```bash
  openssl s_client -connect your-relay.example.com:443 -servername your-relay.example.com
  # Verify "Verify return code: 0 (ok)"
  ```

- [ ] **Auto-renewal working**
  - Certbot renewal configured
  - Test renewal:

  ```bash
  certbot renew --dry-run
  ```

### Security Headers

- [ ] **Headers present**
  - Test at: https://securityheaders.com/
  - Should score A or better

  Expected headers:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Content-Security-Policy: default-src 'self'
  ```

### Vulnerability Scanning

- [ ] **Port scan clean**
  - No unexpected open ports

  ```bash
  nmap -sS -O your-relay.example.com
  # Should only show 22 (SSH), 80/443 (HTTPS)
  ```

- [ ] **No default credentials**
  - All default passwords changed
  - Strong passwords enforced

- [ ] **Dependency vulnerabilities addressed**
  ```bash
  npm audit
  # Should show 0 vulnerabilities
  ```

### Backup & Recovery

- [ ] **Backups working**
  - Automatic backups scheduled
  - Backups encrypted
  - Backups tested (restore)

  ```bash
  # Test restore
  cp sync.db sync.db.backup
  # Restore from backup
  cp /path/to/backup/sync-20240115.db sync.db
  # Verify relay starts
  docker-compose up -d
  # Check health
  curl http://localhost:8787/health
  # Restore original
  mv sync.db.backup sync.db
  ```

- [ ] **Backup retention policy**
  - Daily backups retained for 7 days
  - Weekly backups retained for 30 days
  - Monthly backups retained for 1 year

  ```bash
  # Cleanup old backups (keep 30 days)
  find /backups -name "sync-*.db" -mtime +30 -delete
  ```

- [ ] **Off-site backups**
  - Backups stored remotely
  - Encrypted in transit and at rest

  ```bash
  # Example: rsync to remote server
  rsync -avz -e "ssh -i /path/to/key" /backups/ user@backup-server:/backups/graceful-books/
  ```

### Monitoring

- [ ] **Health checks active**
  - External monitoring service configured
  - Alerts working (test)

  ```bash
  # Test alert by stopping relay
  docker-compose stop
  # Wait for alert
  # Restart
  docker-compose up -d
  ```

- [ ] **SLA tracking**
  - Metrics collection enabled
  - SLA targets defined
  - Reports generated

  ```bash
  curl http://localhost:8787/metrics/sla
  ```

- [ ] **Log monitoring**
  - Logs aggregated (ELK, Splunk, etc.)
  - Error alerts configured
  - Audit trail preserved

## Ongoing Security Tasks

### Daily

- [ ] Monitor health endpoint
- [ ] Check for unusual log entries
- [ ] Verify backups completed

### Weekly

- [ ] Review error logs
- [ ] Check SLA metrics
- [ ] Verify SSL certificate valid

### Monthly

- [ ] Run `npm audit`
- [ ] Review access logs
- [ ] Update dependencies
- [ ] Test backup restore
- [ ] Review firewall rules

### Quarterly

- [ ] Security audit
- [ ] Penetration testing (optional)
- [ ] Review and update security policies
- [ ] Rotate credentials/keys
- [ ] Review user access

## Security Incident Response

If security incident occurs:

1. **Isolate**
   - Stop relay: `docker-compose stop`
   - Block external access (firewall)

2. **Assess**
   - Review logs
   - Identify scope of breach
   - Check data integrity

3. **Contain**
   - Patch vulnerability
   - Change all credentials
   - Update firewall rules

4. **Recover**
   - Restore from clean backup if needed
   - Verify integrity
   - Restart relay

5. **Document**
   - Write incident report
   - Update security procedures
   - Notify affected parties (if applicable)

## Security Tools

### Recommended Tools

**Vulnerability Scanning:**
- `nmap` - Port scanning
- `nikto` - Web server scanning
- `npm audit` - Dependency scanning

**SSL/TLS Testing:**
- SSL Labs (https://www.ssllabs.com/ssltest/)
- `testssl.sh` - Command-line SSL testing

**Security Headers:**
- SecurityHeaders.com (https://securityheaders.com/)

**Log Analysis:**
- `fail2ban` - Automatic IP banning
- `logwatch` - Log summarization
- ELK Stack - Log aggregation

**Backup:**
- `rsync` - Incremental backups
- `restic` - Encrypted backups
- `duplicity` - Encrypted incremental backups

### Installation Examples

```bash
# fail2ban (auto-ban abusive IPs)
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# testssl.sh
git clone https://github.com/drwetter/testssl.sh.git
cd testssl.sh
./testssl.sh https://your-relay.example.com
```

## Zero-Knowledge Architecture

**Remember:** The sync relay's zero-knowledge architecture means:

✅ **Server never has:**
- Encryption keys
- Plaintext data
- Ability to decrypt payloads

✅ **All stored data is:**
- Encrypted client-side before transmission
- Unreadable by server
- Secure even if server compromised

✅ **Security focus:**
- Protect availability (uptime)
- Prevent DoS attacks
- Secure transmission (HTTPS)
- Prevent unauthorized access to encrypted data

Even if relay is compromised, user data remains encrypted and unreadable.

## Compliance Considerations

Depending on your jurisdiction and use case:

**GDPR (EU):**
- [ ] Data processing agreement
- [ ] Privacy policy
- [ ] Right to deletion (data export/delete)
- [ ] Data breach notification plan

**HIPAA (US Healthcare):**
- [ ] Business Associate Agreement
- [ ] Encryption at rest and in transit
- [ ] Access logs
- [ ] Audit trail

**PCI DSS (Payment cards):**
- [ ] Network segmentation
- [ ] Penetration testing
- [ ] Quarterly scans
- [ ] Incident response plan

**SOC 2:**
- [ ] Security controls documented
- [ ] Access controls
- [ ] Change management
- [ ] Monitoring and logging

Consult with legal counsel for specific compliance requirements.

## Security Best Practices Summary

1. **Defense in depth** - Multiple layers of security
2. **Least privilege** - Minimal permissions for each component
3. **Fail secure** - Errors should not expose data
4. **Regular updates** - Patch vulnerabilities promptly
5. **Monitor continuously** - Detect issues early
6. **Plan for incidents** - Have response plan ready
7. **Test regularly** - Verify security controls work
8. **Document everything** - Policies, procedures, incidents

## Support

Security questions or concerns:

- Security email: security@gracefulbooks.com
- GitHub Security: https://github.com/gracefulbooks/graceful-books/security
- Documentation: https://docs.gracefulbooks.com/self-hosted/security

**To report security vulnerability:**
Use GitHub Security Advisories (private disclosure)
