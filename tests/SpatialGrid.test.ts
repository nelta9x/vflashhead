import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGrid } from '../src/utils/SpatialGrid';

describe('SpatialGrid', () => {
  let grid: SpatialGrid;

  beforeEach(() => {
    grid = new SpatialGrid(800, 600, 100);
  });

  it('insert 후 forEachInRadius로 해당 엔티티 반환', () => {
    grid.insert(1, 150, 150);
    const found: number[] = [];
    grid.forEachInRadius(160, 160, 50, (id) => found.push(id));
    expect(found).toContain(1);
  });

  it('범위 밖 셀의 엔티티는 반환하지 않음', () => {
    grid.insert(1, 10, 10);
    grid.insert(2, 700, 500);
    const found: number[] = [];
    grid.forEachInRadius(10, 10, 50, (id) => found.push(id));
    expect(found).toContain(1);
    expect(found).not.toContain(2);
  });

  it('같은 셀에 여러 엔티티 삽입 가능', () => {
    grid.insert(1, 50, 50);
    grid.insert(2, 60, 60);
    grid.insert(3, 70, 70);
    const found: number[] = [];
    grid.forEachInRadius(55, 55, 50, (id) => found.push(id));
    expect(found).toContain(1);
    expect(found).toContain(2);
    expect(found).toContain(3);
  });

  it('clear 후 엔티티가 없음', () => {
    grid.insert(1, 50, 50);
    grid.clear();
    const found: number[] = [];
    grid.forEachInRadius(50, 50, 200, (id) => found.push(id));
    expect(found).toHaveLength(0);
  });

  it('forEachEntity는 전체 엔티티 순회', () => {
    grid.insert(1, 10, 10);
    grid.insert(2, 700, 500);
    grid.insert(3, 400, 300);
    const found: number[] = [];
    grid.forEachEntity((id) => found.push(id));
    expect(found.sort()).toEqual([1, 2, 3]);
  });

  it('경계 바깥 좌표도 clamped되어 삽입됨', () => {
    grid.insert(1, -50, -50);
    grid.insert(2, 1000, 800);
    const found: number[] = [];
    grid.forEachEntity((id) => found.push(id));
    expect(found.sort()).toEqual([1, 2]);
  });

  it('큰 반경으로 검색 시 모든 엔티티 반환', () => {
    grid.insert(1, 10, 10);
    grid.insert(2, 790, 590);
    const found: number[] = [];
    grid.forEachInRadius(400, 300, 800, (id) => found.push(id));
    expect(found.sort()).toEqual([1, 2]);
  });

  it('반경 0 검색은 해당 셀만 반환', () => {
    grid.insert(1, 150, 150);
    grid.insert(2, 250, 250);
    const found: number[] = [];
    grid.forEachInRadius(150, 150, 0, (id) => found.push(id));
    expect(found).toContain(1);
    expect(found).not.toContain(2);
  });
});
