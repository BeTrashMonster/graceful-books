/**
 * Load Testing Infrastructure Verification
 *
 * Verifies that the load testing infrastructure is properly configured.
 * This test runs in the regular test suite (not k6).
 *
 * Requirements:
 * - I7: Load Testing Infrastructure
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Load Testing Infrastructure', () => {
  describe('Directory Structure', () => {
    it('should have tests/load directory', () => {
      const loadDir = join(process.cwd(), 'tests', 'load');
      expect(existsSync(loadDir)).toBe(true);
    });

    it('should have scenarios directory', () => {
      const scenariosDir = join(process.cwd(), 'tests', 'load', 'scenarios');
      expect(existsSync(scenariosDir)).toBe(true);
    });

    it('should have config directory', () => {
      const configDir = join(process.cwd(), 'tests', 'load', 'config');
      expect(existsSync(configDir)).toBe(true);
    });

    it('should have utils directory', () => {
      const utilsDir = join(process.cwd(), 'tests', 'load', 'utils');
      expect(existsSync(utilsDir)).toBe(true);
    });

    it('should have baselines directory', () => {
      const baselinesDir = join(process.cwd(), 'tests', 'load', 'baselines');
      expect(existsSync(baselinesDir)).toBe(true);
    });

    it('should have results directory', () => {
      const resultsDir = join(process.cwd(), 'tests', 'load', 'results');
      expect(existsSync(resultsDir)).toBe(true);
    });
  });

  describe('Test Scenarios', () => {
    it('should have sync-relay scenario', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'sync-relay.js'
      );
      expect(existsSync(scenarioPath)).toBe(true);

      const content = readFileSync(scenarioPath, 'utf-8');
      expect(content).toContain('export const options');
      expect(content).toContain('export default function');
      expect(content).toContain('push_success_rate');
      expect(content).toContain('pull_success_rate');
    });

    it('should have crdt-conflicts scenario', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'crdt-conflicts.js'
      );
      expect(existsSync(scenarioPath)).toBe(true);

      const content = readFileSync(scenarioPath, 'utf-8');
      expect(content).toContain('export const options');
      expect(content).toContain('conflict_detection_rate');
      expect(content).toContain('conflict_resolution_time');
      expect(content).toContain('merge_success_rate');
    });

    it('should have mixed-workload scenario', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'mixed-workload.js'
      );
      expect(existsSync(scenarioPath)).toBe(true);

      const content = readFileSync(scenarioPath, 'utf-8');
      expect(content).toContain('export const options');
      expect(content).toContain('user_journey_success');
      expect(content).toContain('light_users');
      expect(content).toContain('active_users');
      expect(content).toContain('power_users');
    });
  });

  describe('Test Configurations', () => {
    it('should have light config', () => {
      const configPath = join(process.cwd(), 'tests', 'load', 'config', 'light.json');
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('env');
      expect(config.env).toHaveProperty('VUS_PEAK');
      expect(config.env.VUS_PEAK).toBe('100');
    });

    it('should have medium config', () => {
      const configPath = join(process.cwd(), 'tests', 'load', 'config', 'medium.json');
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('env');
      expect(config.env).toHaveProperty('VUS_PEAK');
      expect(config.env.VUS_PEAK).toBe('500');
    });

    it('should have heavy config', () => {
      const configPath = join(process.cwd(), 'tests', 'load', 'config', 'heavy.json');
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('env');
      expect(config.env).toHaveProperty('VUS_PEAK');
      expect(config.env.VUS_PEAK).toBe('1000');
    });
  });

  describe('Utilities', () => {
    it('should have helper utilities', () => {
      const helpersPath = join(
        process.cwd(),
        'tests',
        'load',
        'utils',
        'helpers.js'
      );
      expect(existsSync(helpersPath)).toBe(true);

      const content = readFileSync(helpersPath, 'utf-8');
      expect(content).toContain('generateDeviceId');
      expect(content).toContain('createSyncChange');
      expect(content).toContain('createPushRequest');
      expect(content).toContain('createPullRequest');
      expect(content).toContain('generateTransactionData');
    });
  });

  describe('Baseline Documentation', () => {
    it('should have baseline metrics file', () => {
      const baselinePath = join(
        process.cwd(),
        'tests',
        'load',
        'baselines',
        'BASELINE.md'
      );
      expect(existsSync(baselinePath)).toBe(true);

      const content = readFileSync(baselinePath, 'utf-8');
      expect(content).toContain('Baseline Performance Metrics');
      expect(content).toContain('Sync Relay Performance');
      expect(content).toContain('CRDT Conflict Resolution');
      expect(content).toContain('Alert Thresholds');
    });
  });

  describe('Scripts', () => {
    it('should have run-load-tests script', () => {
      const scriptPath = join(process.cwd(), 'scripts', 'run-load-tests.sh');
      expect(existsSync(scriptPath)).toBe(true);

      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('check_k6_installed');
      expect(content).toContain('run_profile');
      expect(content).toContain('light|medium|heavy|all');
    });
  });

  describe('CI/CD Integration', () => {
    it('should have load-tests workflow', () => {
      const workflowPath = join(
        process.cwd(),
        '.github',
        'workflows',
        'load-tests.yml'
      );
      expect(existsSync(workflowPath)).toBe(true);

      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('name: Load Tests');
      expect(content).toContain('light-load-test');
      expect(content).toContain('medium-load-test');
      expect(content).toContain('heavy-load-test');
      expect(content).toContain('Install k6');
    });
  });

  describe('Documentation', () => {
    it('should have load testing guide', () => {
      const guidePath = join(process.cwd(), 'docs', 'load-testing-guide.md');
      expect(existsSync(guidePath)).toBe(true);

      const content = readFileSync(guidePath, 'utf-8');
      expect(content).toContain('Load Testing Guide');
      expect(content).toContain('Quick Start');
      expect(content).toContain('Test Profiles');
      expect(content).toContain('Understanding Results');
      expect(content).toContain('Performance Baselines');
    });

    it('should have load tests README', () => {
      const readmePath = join(process.cwd(), 'tests', 'load', 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Load Testing Infrastructure');
      expect(content).toContain('Quick Start');
      expect(content).toContain('Test Scenarios');
      expect(content).toContain('Test Profiles');
    });
  });

  describe('Package.json Scripts', () => {
    it('should have load test npm scripts', () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('load:test:light');
      expect(packageJson.scripts).toHaveProperty('load:test:medium');
      expect(packageJson.scripts).toHaveProperty('load:test:heavy');
      expect(packageJson.scripts).toHaveProperty('load:test:all');

      expect(packageJson.scripts['load:test:light']).toContain('run-load-tests.sh light');
      expect(packageJson.scripts['load:test:medium']).toContain('run-load-tests.sh medium');
      expect(packageJson.scripts['load:test:heavy']).toContain('run-load-tests.sh heavy');
      expect(packageJson.scripts['load:test:all']).toContain('run-load-tests.sh all');
    });
  });

  describe('Scenario Content Validation', () => {
    it('sync-relay should have proper k6 imports', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'sync-relay.js'
      );
      const content = readFileSync(scenarioPath, 'utf-8');

      expect(content).toContain("import http from 'k6/http'");
      expect(content).toContain("import { check, sleep } from 'k6'");
      expect(content).toContain("import { Rate, Trend, Counter } from 'k6/metrics'");
    });

    it('crdt-conflicts should test concurrent modifications', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'crdt-conflicts.js'
      );
      const content = readFileSync(scenarioPath, 'utf-8');

      expect(content).toContain('testConcurrentModification');
      expect(content).toContain('testConflictingUpdates');
      expect(content).toContain('createConflictScenario');
    });

    it('mixed-workload should have user journey functions', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'mixed-workload.js'
      );
      const content = readFileSync(scenarioPath, 'utf-8');

      expect(content).toContain('lightUserJourney');
      expect(content).toContain('activeUserJourney');
      expect(content).toContain('powerUserJourney');
    });
  });

  describe('Thresholds', () => {
    it('sync-relay should have performance thresholds', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'sync-relay.js'
      );
      const content = readFileSync(scenarioPath, 'utf-8');

      expect(content).toContain('thresholds:');
      expect(content).toContain('http_req_duration');
      expect(content).toContain('http_req_failed');
      expect(content).toContain('push_success_rate');
      expect(content).toContain('pull_success_rate');
    });

    it('crdt-conflicts should have conflict-specific thresholds', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'crdt-conflicts.js'
      );
      const content = readFileSync(scenarioPath, 'utf-8');

      expect(content).toContain('thresholds:');
      expect(content).toContain('conflict_detection_rate');
      expect(content).toContain('merge_success_rate');
      expect(content).toContain('conflict_resolution_time');
    });

    it('mixed-workload should have journey success threshold', () => {
      const scenarioPath = join(
        process.cwd(),
        'tests',
        'load',
        'scenarios',
        'mixed-workload.js'
      );
      const content = readFileSync(scenarioPath, 'utf-8');

      expect(content).toContain('thresholds:');
      expect(content).toContain('user_journey_success');
    });
  });
});
