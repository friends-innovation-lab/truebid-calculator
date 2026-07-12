#!/usr/bin/env node
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Find most recent results file
const dir = 'test-results';
const files = readdirSync(dir).filter(f => f.startsWith('jest-') && f.endsWith('.json'));
const latest = files.sort().pop();
const results = JSON.parse(readFileSync(join(dir, latest)));

console.log(`Tests: ${results.numTotalTests} total, ${results.numPassedTests} passed, ${results.numFailedTests} failed`);
console.log(`Duration: ${((Date.now() - results.startTime) / 1000).toFixed(1)}s`);
console.log(`Results: ${join(dir, latest)}`);
