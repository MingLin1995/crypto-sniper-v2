import { calculatePagination, createPaginationMeta, createPaginatedResponse } from './pagination.helper';

describe('Pagination Helpers (分頁輔助工具)', () => {
  describe('calculatePagination', () => {
    it('預設 page=1, limit=10 時應回傳 skip=0, take=10', () => {
      const res = calculatePagination({});
      expect(res).toEqual({ skip: 0, take: 10 });
    });

    it('page=3, limit=20 時應回傳 skip=40, take=20', () => {
      const res = calculatePagination({ page: 3, limit: 20 });
      expect(res).toEqual({ skip: 40, take: 20 });
    });
  });

  describe('createPaginationMeta', () => {
    it('應正確計算總頁數與前後頁狀態', () => {
      // 100 筆，每頁 10 筆，當前第 1 頁
      const metaFirst = createPaginationMeta(1, 10, 100);
      expect(metaFirst.totalPages).toBe(10);
      expect(metaFirst.hasPreviousPage).toBe(false);
      expect(metaFirst.hasNextPage).toBe(true);

      // 當前第 5 頁
      const metaMiddle = createPaginationMeta(5, 10, 100);
      expect(metaMiddle.hasPreviousPage).toBe(true);
      expect(metaMiddle.hasNextPage).toBe(true);

      // 當前第 10 頁
      const metaLast = createPaginationMeta(10, 10, 100);
      expect(metaLast.hasPreviousPage).toBe(true);
      expect(metaLast.hasNextPage).toBe(false);
    });
  });

  describe('createPaginatedResponse', () => {
    it('應包裝資料陣列與元數據為 PaginatedResponseDto', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const response = createPaginatedResponse(items, 1, 10, 2);

      expect(response.data).toEqual(items);
      expect(response.meta.total).toBe(2);
      expect(response.meta.page).toBe(1);
    });
  });
});
