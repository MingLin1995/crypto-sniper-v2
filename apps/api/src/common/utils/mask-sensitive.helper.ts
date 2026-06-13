/**
 * 敏感資料遮罩工具
 * 用於在記錄 log 前遮蔽敏感資訊，防止洩漏
 */

/**
 * 需要遮罩的敏感欄位列表
 */
const SENSITIVE_FIELDS = [
  // 認證相關
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'currentPassword',
  'passwordConfirm',

  // Token 相關
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'apiSecret',
  'secret',
  'secretKey',
  'authorization',

  // 金融相關
  'creditCard',
  'cardNumber',
  'cvv',
  'cvv2',
  'cardCvv',
  'accountNumber',
  'bankAccount',

  // 個人敏感資料
  'ssn', // 身分證字號
  'idNumber',
  'passport',
  'driverLicense',

  // 其他
  'privateKey',
  'encryptionKey',
  'sessionId',
];

/**
 * 遮罩單一值
 * @param value - 原始值
 * @returns 遮罩後的值
 */
function maskValue(value: any): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  const strValue = String(value);

  // 如果值太短，全部遮罩
  if (strValue.length <= 4) {
    return '***';
  }

  // 保留前後各 2 個字元，中間遮罩
  const start = strValue.substring(0, 2);
  const end = strValue.substring(strValue.length - 2);
  const maskedLength = Math.min(strValue.length - 4, 10); // 最多顯示 10 個星號
  const masked = '*'.repeat(maskedLength);

  return `${start}${masked}${end}`;
}

/**
 * 檢查欄位名稱是否為敏感欄位
 * @param fieldName - 欄位名稱
 * @returns 是否為敏感欄位
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some((sensitive) => lowerFieldName.includes(sensitive.toLowerCase()));
}

const FULL_MASK_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'session',
  'cvv',
];

function shouldFullMask(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return FULL_MASK_FIELDS.some((field) => lower.includes(field));
}

/**
 * 遮罩物件中的敏感資料（遞迴處理）
 * @param data - 原始資料
 * @param maxDepth - 最大遞迴深度（防止循環引用）
 * @param currentDepth - 當前深度
 * @returns 遮罩後的資料
 */
export function maskSensitiveData(data: any, maxDepth = 5, currentDepth = 0): any {
  // 防止過深的遞迴
  if (currentDepth >= maxDepth) {
    return '[Max Depth Reached]';
  }

  // 處理 null 和 undefined
  if (data === null || data === undefined) {
    return data;
  }

  // 處理陣列
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, maxDepth, currentDepth + 1));
  }

  // 處理物件
  if (typeof data === 'object') {
    const masked: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveField(key)) {
        // 敏感欄位：如果是憑證密鑰類，則完全遮蔽；其餘（如卡號、電話）部分遮蔽
        if (shouldFullMask(key)) {
          masked[key] = '*****';
        } else {
          masked[key] = maskValue(value);
        }
      } else if (typeof value === 'object' && value !== null) {
        // 非敏感欄位但值為物件：遞迴處理
        masked[key] = maskSensitiveData(value, maxDepth, currentDepth + 1);
      } else {
        // 一般欄位：保持原值
        masked[key] = value;
      }
    }

    return masked;
  }

  // 基本類型：直接返回
  return data;
}

/**
 * 將資料轉換為 JSON 字串（已遮罩敏感資料）
 * @param data - 原始資料
 * @returns JSON 字串，如果轉換失敗則返回 null
 */
export function safeStringify(data: any): string | null {
  try {
    if (!data) return null;
    const masked = maskSensitiveData(data);
    return JSON.stringify(masked);
  } catch (error) {
    // 如果有循環引用或其他錯誤，返回錯誤訊息
    return `[Stringify Error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}
