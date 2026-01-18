const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));

const failedSuites = [];
for (const result of data.testResults || []) {
    const failedTests = (result.assertionResults || []).filter(t => t.status === 'failed');
    if (failedTests.length > 0) {
        failedSuites.push({
            file: result.name.replace(/^.*graceful_books[\\/]/, ''),
            failedCount: failedTests.length,
            tests: failedTests.slice(0, 5).map(t => ({
                name: t.fullName,
                error: (t.failureMessages || []).join('\n').substring(0, 300)
            }))
        });
    }
}

console.log('=== TEST FAILURE SUMMARY ===');
console.log('Total Test Suites:', data.numTotalTestSuites);
console.log('Passed Test Suites:', data.numPassedTestSuites);
console.log('Failed Test Suites:', data.numFailedTestSuites);
console.log('');
console.log('Total Tests:', data.numTotalTests);
console.log('Passed Tests:', data.numPassedTests);
console.log('Failed Tests:', data.numFailedTests);
console.log('Pass Rate:', ((data.numPassedTests / data.numTotalTests) * 100).toFixed(2) + '%');
console.log('');
console.log('=== FAILED TEST FILES (' + failedSuites.length + ' files) ===');
console.log('');

for (const suite of failedSuites) {
    console.log(`File: ${suite.file}`);
    console.log(`Failed: ${suite.failedCount} tests`);
    for (const test of suite.tests) {
        console.log(`  - ${test.name}`);
        if (test.error) {
            const errorLine = test.error.split('\n')[0];
            console.log(`    ${errorLine.substring(0, 150)}`);
        }
    }
    console.log('');
}
