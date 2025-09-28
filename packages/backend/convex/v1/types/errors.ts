/**
 * 聊天系统自定义错误类
 */
export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ChatError';
  }

  /**
   * 将错误转换为可序列化的对象
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * 聊天系统错误代码常量
 */
export const ChatErrorCodes = {
  // 认证和授权错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // 资源不存在错误
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  
  // 验证错误
  INVALID_CONTENT: 'INVALID_CONTENT',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  EMPTY_CONTENT: 'EMPTY_CONTENT',
  
  // 业务逻辑错误
  NOT_FRIENDS: 'NOT_FRIENDS',
  ALREADY_PARTICIPANT: 'ALREADY_PARTICIPANT',
  CONVERSATION_FULL: 'CONVERSATION_FULL',
  CANNOT_LEAVE_DIRECT_CHAT: 'CANNOT_LEAVE_DIRECT_CHAT',
  MESSAGE_ALREADY_DELETED: 'MESSAGE_ALREADY_DELETED',
  
  // 限制错误
  RATE_LIMITED: 'RATE_LIMITED',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  TOO_MANY_PARTICIPANTS: 'TOO_MANY_PARTICIPANTS',
  
  // 系统错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ChatErrorCode = typeof ChatErrorCodes[keyof typeof ChatErrorCodes];

/**
 * 创建特定类型的错误
 */
export class ChatErrorFactory {
  /**
   * 未授权错误
   */
  static unauthorized(message = "Unauthorized access"): ChatError {
    return new ChatError(message, ChatErrorCodes.UNAUTHORIZED, 401);
  }

  /**
   * 访问被拒绝错误
   */
  static accessDenied(message = "Access denied"): ChatError {
    return new ChatError(message, ChatErrorCodes.ACCESS_DENIED, 403);
  }

  /**
   * 权限不足错误
   */
  static insufficientPermissions(message = "Insufficient permissions"): ChatError {
    return new ChatError(message, ChatErrorCodes.INSUFFICIENT_PERMISSIONS, 403);
  }

  /**
   * 资源不存在错误
   */
  static notFound(resource: string, id?: string): ChatError {
    const message = id 
      ? `${resource} with id "${id}" not found`
      : `${resource} not found`;
    
    const code = resource.toLowerCase().includes('conversation') 
      ? ChatErrorCodes.CONVERSATION_NOT_FOUND
      : resource.toLowerCase().includes('message')
      ? ChatErrorCodes.MESSAGE_NOT_FOUND
      : ChatErrorCodes.USER_NOT_FOUND;
    
    return new ChatError(message, code, 404);
  }

  /**
   * 验证错误
   */
  static validation(message: string, field?: string): ChatError {
    return new ChatError(
      message, 
      ChatErrorCodes.INVALID_PARAMETERS, 
      400,
      field ? { field } : undefined
    );
  }

  /**
   * 内容验证错误
   */
  static invalidContent(message = "Invalid content"): ChatError {
    return new ChatError(message, ChatErrorCodes.INVALID_CONTENT, 400);
  }

  /**
   * 内容过长错误
   */
  static contentTooLong(maxLength: number): ChatError {
    return new ChatError(
      `Content exceeds maximum length of ${maxLength} characters`,
      ChatErrorCodes.CONTENT_TOO_LONG,
      400,
      { maxLength }
    );
  }

  /**
   * 空内容错误
   */
  static emptyContent(message = "Content cannot be empty"): ChatError {
    return new ChatError(message, ChatErrorCodes.EMPTY_CONTENT, 400);
  }

  /**
   * 非好友关系错误
   */
  static notFriends(userId1: string, userId2: string): ChatError {
    return new ChatError(
      `Users ${userId1} and ${userId2} are not friends`,
      ChatErrorCodes.NOT_FRIENDS,
      400,
      { userId1, userId2 }
    );
  }

  /**
   * 已是参与者错误
   */
  static alreadyParticipant(userId: string): ChatError {
    return new ChatError(
      `User ${userId} is already a participant`,
      ChatErrorCodes.ALREADY_PARTICIPANT,
      400,
      { userId }
    );
  }

  /**
   * 不能离开直接聊天错误
   */
  static cannotLeaveDirectChat(): ChatError {
    return new ChatError(
      "Cannot leave direct conversations",
      ChatErrorCodes.CANNOT_LEAVE_DIRECT_CHAT,
      400
    );
  }

  /**
   * 消息已删除错误
   */
  static messageAlreadyDeleted(): ChatError {
    return new ChatError(
      "Message has already been deleted",
      ChatErrorCodes.MESSAGE_ALREADY_DELETED,
      400
    );
  }

  /**
   * 限流错误
   */
  static rateLimited(retryAfter?: number): ChatError {
    return new ChatError(
      "Rate limit exceeded",
      ChatErrorCodes.RATE_LIMITED,
      429,
      retryAfter ? { retryAfter } : undefined
    );
  }

  /**
   * 参与者过多错误
   */
  static tooManyParticipants(maxParticipants: number): ChatError {
    return new ChatError(
      `Too many participants. Maximum allowed: ${maxParticipants}`,
      ChatErrorCodes.TOO_MANY_PARTICIPANTS,
      400,
      { maxParticipants }
    );
  }

  /**
   * 内部服务器错误
   */
  static internal(message = "Internal server error"): ChatError {
    return new ChatError(message, ChatErrorCodes.INTERNAL_ERROR, 500);
  }

  /**
   * 数据库错误
   */
  static database(message = "Database operation failed"): ChatError {
    return new ChatError(message, ChatErrorCodes.DATABASE_ERROR, 500);
  }
}

/**
 * 错误处理中间件
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      // 如果已经是ChatError，直接抛出
      if (error instanceof ChatError) {
        throw error;
      }
      
      // 记录未知错误
      console.error('Unexpected error in chat API:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        args: args.length > 0 ? args[0] : undefined,
      });
      
      // 转换为ChatError
      if (error instanceof Error) {
        // 检查是否是常见的数据库错误
        if (error.message.includes('database') || error.message.includes('query')) {
          throw ChatErrorFactory.database(error.message);
        }
        
        // 检查是否是验证错误
        if (error.message.includes('validation') || error.message.includes('invalid')) {
          throw ChatErrorFactory.validation(error.message);
        }
        
        // 其他错误作为内部错误处理
        throw ChatErrorFactory.internal(error.message);
      }
      
      // 未知错误类型
      throw ChatErrorFactory.internal('An unexpected error occurred');
    }
  };
}

/**
 * 检查是否是重试的错误
 */
export function isRetryableError(error: ChatError): boolean {
  const retryableCodes = [
    ChatErrorCodes.NETWORK_ERROR,
    ChatErrorCodes.DATABASE_ERROR,
    ChatErrorCodes.INTERNAL_ERROR,
  ];
  
  return retryableCodes.includes(error.code as ChatErrorCode);
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(error: ChatError): string {
  const messageMap: Record<string, string> = {
    [ChatErrorCodes.UNAUTHORIZED]: "请先登录",
    [ChatErrorCodes.ACCESS_DENIED]: "您没有权限执行此操作",
    [ChatErrorCodes.CONVERSATION_NOT_FOUND]: "会话不存在",
    [ChatErrorCodes.MESSAGE_NOT_FOUND]: "消息不存在",
    [ChatErrorCodes.USER_NOT_FOUND]: "用户不存在",
    [ChatErrorCodes.INVALID_CONTENT]: "消息内容无效",
    [ChatErrorCodes.CONTENT_TOO_LONG]: "消息内容过长",
    [ChatErrorCodes.EMPTY_CONTENT]: "消息内容不能为空",
    [ChatErrorCodes.NOT_FRIENDS]: "只能与好友聊天",
    [ChatErrorCodes.ALREADY_PARTICIPANT]: "用户已在会话中",
    [ChatErrorCodes.CANNOT_LEAVE_DIRECT_CHAT]: "无法离开私聊",
    [ChatErrorCodes.MESSAGE_ALREADY_DELETED]: "消息已被删除",
    [ChatErrorCodes.RATE_LIMITED]: "操作过于频繁，请稍后再试",
    [ChatErrorCodes.TOO_MANY_PARTICIPANTS]: "群组成员已达上限",
    [ChatErrorCodes.INTERNAL_ERROR]: "服务器内部错误",
    [ChatErrorCodes.DATABASE_ERROR]: "数据库操作失败",
    [ChatErrorCodes.NETWORK_ERROR]: "网络连接错误",
  };
  
  return messageMap[error.code] || error.message || "发生未知错误";
}