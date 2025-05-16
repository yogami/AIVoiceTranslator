/**
 * Basic test file to verify Vitest is working correctly
 * Converted from Jest to Vitest
 */
import { describe, it, expect } from 'vitest';

describe('Basic test suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
  
  it('should handle object equality', () => {
    const obj1 = { name: 'test', value: 123 };
    const obj2 = { name: 'test', value: 123 };
    expect(obj1).toEqual(obj2);
  });
  
  it('should handle array operations', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toHaveLength(5);
    expect(arr).toContain(3);
    expect(arr.map(x => x * 2)).toEqual([2, 4, 6, 8, 10]);
  });
});