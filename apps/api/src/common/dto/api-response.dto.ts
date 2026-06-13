import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto {
    @ApiProperty({ example: 200 })
    statusCode!: number;

    @ApiProperty({ example: 'Success' })
    message!: string;

    // 這裡不直接定義 data，而是透過 Decorator 動態組合
    // 否則 nest-cli plugin 會因為泛型 T 而報 circular dependency error
    // data!: T;

    @ApiProperty({ example: '2025-12-26T14:21:30.263+08:00' })
    timestamp!: string;
}
