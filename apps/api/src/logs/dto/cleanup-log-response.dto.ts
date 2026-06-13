import { ApiProperty } from '@nestjs/swagger';

export class CleanupLogResponseDto {
    @ApiProperty({ example: '已刪除 30 天前的日誌' })
    message!: string;

    @ApiProperty({ example: 1500 })
    deletedCount!: number;
}
