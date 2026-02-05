import { getFormattedProducts } from './catalog.js';
import { performance } from 'perf_hooks';

console.log('Starting benchmark...');
const start = performance.now();
for (let i = 0; i < 100; i++) {
  await getFormattedProducts();
}
const end = performance.now();
console.log(`Total time for 100 iterations: ${(end - start).toFixed(2)}ms`);
console.log(`Average time per iteration: ${((end - start) / 100).toFixed(2)}ms`);
