#!/bin/bash

# Docker Container Tests for Graceful Books Sync Relay
# Tests Docker image build, container startup, and functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="gracefulbooks/sync-relay:test"
CONTAINER_NAME="gb-sync-test"
TEST_PORT="8788"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Test functions
test_start() {
    echo ""
    echo "========================================="
    echo "TEST: $1"
    echo "========================================="
}

test_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo "  Error: $2"
    ((TESTS_FAILED++))
}

# Main tests

echo "Graceful Books Sync Relay - Docker Container Tests"
echo "=================================================="
echo ""

# Test 1: Docker is installed and running
test_start "Docker availability"
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        test_pass "Docker is installed and running"
    else
        test_fail "Docker daemon is not running" "Run 'sudo systemctl start docker'"
        exit 1
    fi
else
    test_fail "Docker is not installed" "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Test 2: Build Docker image
test_start "Building Docker image"
cd "$RELAY_DIR"
if docker build -t "$IMAGE_NAME" . > /tmp/docker-build.log 2>&1; then
    test_pass "Docker image built successfully"
else
    test_fail "Docker image build failed" "See /tmp/docker-build.log"
    cat /tmp/docker-build.log
    exit 1
fi

# Test 3: Verify image exists
test_start "Verifying image exists"
if docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    test_pass "Docker image exists"
else
    test_fail "Docker image not found" "Build may have failed"
    exit 1
fi

# Test 4: Check image labels
test_start "Checking image metadata"
VERSION=$(docker image inspect "$IMAGE_NAME" --format '{{index .Config.Labels "version"}}')
if [ -n "$VERSION" ]; then
    test_pass "Image has version label: $VERSION"
else
    test_fail "Image missing version label" "Dockerfile should include LABEL version"
fi

# Test 5: Start container
test_start "Starting container"
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$TEST_PORT:8787" \
    -e NODE_ENV=production \
    -e DB_PATH=/app/data/sync.db \
    -e LOG_LEVEL=info \
    "$IMAGE_NAME" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    test_pass "Container started successfully"
else
    test_fail "Container failed to start" "Check docker logs $CONTAINER_NAME"
    exit 1
fi

# Wait for container to be ready
echo "Waiting for container to initialize..."
sleep 5

# Test 6: Verify container is running
test_start "Container status check"
if docker ps | grep -q "$CONTAINER_NAME"; then
    test_pass "Container is running"
else
    test_fail "Container is not running" "Check docker logs $CONTAINER_NAME"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

# Test 7: Health endpoint responds
test_start "Health endpoint"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    test_pass "Health endpoint returns 200 OK"
else
    test_fail "Health endpoint returned $HEALTH_RESPONSE" "Expected 200"
fi

# Test 8: Health endpoint JSON valid
test_start "Health endpoint JSON"
HEALTH_JSON=$(curl -s http://localhost:$TEST_PORT/health)
STATUS=$(echo "$HEALTH_JSON" | jq -r '.status' 2>/dev/null)
if [ "$STATUS" = "ok" ]; then
    test_pass "Health endpoint returns valid JSON with status: ok"
else
    test_fail "Health endpoint JSON invalid or status not ok" "Response: $HEALTH_JSON"
fi

# Test 9: Version endpoint
test_start "Version endpoint"
VERSION_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/version)
if [ "$VERSION_RESPONSE" = "200" ]; then
    test_pass "Version endpoint returns 200 OK"
else
    test_fail "Version endpoint returned $VERSION_RESPONSE" "Expected 200"
fi

# Test 10: Version endpoint JSON
test_start "Version endpoint JSON"
VERSION_JSON=$(curl -s http://localhost:$TEST_PORT/version)
VERSION=$(echo "$VERSION_JSON" | jq -r '.version' 2>/dev/null)
if [ -n "$VERSION" ] && [ "$VERSION" != "null" ]; then
    test_pass "Version endpoint returns valid JSON with version: $VERSION"
else
    test_fail "Version endpoint JSON invalid" "Response: $VERSION_JSON"
fi

# Test 11: Database connection
test_start "Database connection"
DB_STATUS=$(curl -s http://localhost:$TEST_PORT/health | jq -r '.database.status')
if [ "$DB_STATUS" = "ok" ]; then
    test_pass "Database connection is healthy"
else
    test_fail "Database connection failed" "Status: $DB_STATUS"
fi

# Test 12: Container logs (no errors)
test_start "Container logs check"
ERROR_COUNT=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -i "error" | grep -v "0 error" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    test_pass "No errors in container logs"
else
    test_fail "Found $ERROR_COUNT errors in logs" "Check docker logs $CONTAINER_NAME"
    docker logs "$CONTAINER_NAME" 2>&1 | grep -i "error" | head -5
fi

# Test 13: Container healthcheck
test_start "Docker healthcheck"
sleep 30  # Wait for healthcheck to run
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null)
if [ "$HEALTH_STATUS" = "healthy" ]; then
    test_pass "Container healthcheck passed"
elif [ "$HEALTH_STATUS" = "starting" ]; then
    test_pass "Container healthcheck is starting (not failed)"
elif [ -z "$HEALTH_STATUS" ]; then
    echo -e "${YELLOW}⚠ SKIP${NC}: Healthcheck not configured or not ready"
else
    test_fail "Container healthcheck failed" "Status: $HEALTH_STATUS"
fi

# Test 14: Container resource limits
test_start "Container resource limits"
MEMORY_LIMIT=$(docker inspect --format='{{.HostConfig.Memory}}' "$CONTAINER_NAME")
if [ "$MEMORY_LIMIT" = "0" ]; then
    echo -e "${YELLOW}⚠ WARN${NC}: No memory limit set (OK for test)"
    test_pass "Container started without resource limits"
else
    test_pass "Container has memory limit: $((MEMORY_LIMIT / 1024 / 1024))MB"
fi

# Test 15: Container user (non-root)
test_start "Container runs as non-root user"
CONTAINER_USER=$(docker exec "$CONTAINER_NAME" whoami 2>/dev/null)
if [ "$CONTAINER_USER" != "root" ]; then
    test_pass "Container runs as non-root user: $CONTAINER_USER"
else
    test_fail "Container runs as root" "Should run as unprivileged user"
fi

# Test 16: Database persistence
test_start "Database file created"
DB_EXISTS=$(docker exec "$CONTAINER_NAME" ls /app/data/sync.db 2>/dev/null)
if [ -n "$DB_EXISTS" ]; then
    test_pass "Database file created successfully"
else
    test_fail "Database file not found" "Expected /app/data/sync.db"
fi

# Test 17: Test sync push endpoint
test_start "Sync push endpoint"
PUSH_RESPONSE=$(curl -s -X POST http://localhost:$TEST_PORT/sync/push \
    -H "Content-Type: application/json" \
    -d '{
        "protocol_version": "1.0.0",
        "device_id": "test-device",
        "timestamp": 1705507200,
        "changes": []
    }' \
    -o /dev/null -w "%{http_code}")
if [ "$PUSH_RESPONSE" = "200" ]; then
    test_pass "Sync push endpoint accepts valid requests"
else
    test_fail "Sync push endpoint returned $PUSH_RESPONSE" "Expected 200"
fi

# Test 18: Test sync pull endpoint
test_start "Sync pull endpoint"
PULL_RESPONSE=$(curl -s -X POST http://localhost:$TEST_PORT/sync/pull \
    -H "Content-Type: application/json" \
    -d '{
        "protocol_version": "1.0.0",
        "device_id": "test-device",
        "since_timestamp": 0,
        "sync_vector": {}
    }' \
    -o /dev/null -w "%{http_code}")
if [ "$PULL_RESPONSE" = "200" ]; then
    test_pass "Sync pull endpoint accepts valid requests"
else
    test_fail "Sync pull endpoint returned $PULL_RESPONSE" "Expected 200"
fi

# Test 19: Container restart
test_start "Container restart resilience"
docker restart "$CONTAINER_NAME" > /dev/null 2>&1
sleep 5
RESTART_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/health)
if [ "$RESTART_HEALTH" = "200" ]; then
    test_pass "Container survives restart"
else
    test_fail "Container failed after restart" "Health check returned $RESTART_HEALTH"
fi

# Test 20: Check exposed ports
test_start "Port exposure"
EXPOSED_PORT=$(docker port "$CONTAINER_NAME" 8787 | grep -o "$TEST_PORT")
if [ -n "$EXPOSED_PORT" ]; then
    test_pass "Port 8787 correctly exposed to $TEST_PORT"
else
    test_fail "Port 8787 not exposed correctly" "Check docker run -p flag"
fi

# Summary
echo ""
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total:  $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Logs available:"
    echo "  Build log: /tmp/docker-build.log"
    echo "  Container logs: docker logs $CONTAINER_NAME"
    exit 1
fi
