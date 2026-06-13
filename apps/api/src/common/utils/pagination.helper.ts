import { PaginationDto } from '../dto/pagination.dto';
import { PaginationMetaDto, PaginatedResponseDto } from '../dto/paginated-response.dto';

/**
 * 計算 Prisma 查詢所需的 skip 和 take 參數
 *
 * @param paginationDto - 分頁參數
 * @returns { skip, take } - Prisma 查詢參數
 *
 * @example
 * const { skip, take } = calculatePagination({ page: 2, limit: 10 });
 * // 結果: { skip: 10, take: 10 }
 *
 * const users = await prisma.user.findMany({ skip, take });
 */
export function calculatePagination(paginationDto: PaginationDto) {
  const page = paginationDto.page || 1;
  const limit = paginationDto.limit || 10;

  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * 建立分頁元數據
 *
 * @param page - 當前頁碼
 * @param limit - 每頁筆數
 * @param total - 總筆數
 * @returns PaginationMetaDto
 *
 * @example
 * const meta = createPaginationMeta(1, 10, 100);
 * // 結果: { page: 1, limit: 10, total: 100, totalPages: 10, hasPreviousPage: false, hasNextPage: true }
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMetaDto {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

/**
 * 建立分頁響應（結合數據和元數據）
 *
 * @param data - 資料列表
 * @param page - 當前頁碼
 * @param limit - 每頁筆數
 * @param total - 總筆數
 * @returns PaginatedResponseDto
 *
 * @example
 * const users = await prisma.user.findMany({ skip, take });
 * const total = await prisma.user.count();
 * const response = createPaginatedResponse(users, 1, 10, total);
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResponseDto<T> {
  const meta = createPaginationMeta(page, limit, total);
  return new PaginatedResponseDto(data, meta);
}
