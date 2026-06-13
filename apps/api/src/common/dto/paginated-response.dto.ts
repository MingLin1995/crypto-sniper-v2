import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ description: '當前頁碼', example: 1 })
  page!: number;

  @ApiProperty({ description: '每頁筆數', example: 10 })
  limit!: number;

  @ApiProperty({ description: '總筆數', example: 100 })
  total!: number;

  @ApiProperty({ description: '總頁數', example: 10 })
  totalPages!: number;

  @ApiProperty({ description: '是否有上一頁', example: false })
  hasPreviousPage!: boolean;

  @ApiProperty({ description: '是否有下一頁', example: true })
  hasNextPage!: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: '資料列表', isArray: true })
  data: T[];

  @ApiProperty({ description: '分頁元數據', type: PaginationMetaDto })
  meta: PaginationMetaDto;

  constructor(data: T[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}
