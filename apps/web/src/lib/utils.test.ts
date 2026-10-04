import { describe, expect, it } from 'bun:test';
import { cn } from './utils';

describe('Web Utils - cn()', () => {
  it('應正確合併基礎 Tailwind class', () => {
    const result = cn('bg-red-500', 'text-white');
    expect(result).toBe('bg-red-500 text-white');
  });

  it('衝突的 Tailwind class 應由後者覆蓋 (twMerge)', () => {
    const result = cn('p-4', 'p-8');
    expect(result).toBe('p-8');
  });

  it('條件式為 false 或 undefined 時應自動忽略', () => {
    const isActive = false;
    const result = cn('btn', isActive && 'btn-active', undefined, null);
    expect(result).toBe('btn');
  });
});
