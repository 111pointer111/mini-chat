import 'package:dio/dio.dart';

/// 从异常中提取用户友好的错误信息。
///
/// [context] 用于区分不同场景下的相同状态码含义，如 'login' 时 401 是密码错误，
/// 其他场景 401 是登录过期。
String extractErrorMessage(
  Object error, {
  String fallback = '操作失败，请稍后重试',
  String context = 'general',
}) {
  if (error is DioException) {
    // 网络层错误（无响应）
    if (error.response == null) {
      return _networkErrorMessage(error);
    }

    final statusCode = error.response?.statusCode;
    final data = error.response?.data;

    // 优先使用服务端返回的 message
    if (data is Map<String, dynamic> && data['message'] != null) {
      return data['message'] as String;
    }

    return _statusCodeMessage(statusCode, context) ?? fallback;
  }

  // FormatException（JSON 解析等）
  if (error is FormatException) {
    return '数据格式异常，请稍后重试';
  }

  return fallback;
}

/// 网络层错误：超时、断网、连接拒绝等
String _networkErrorMessage(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
      return '连接超时，请检查网络后重试';
    case DioExceptionType.sendTimeout:
      return '发送超时，请稍后重试';
    case DioExceptionType.receiveTimeout:
      return '服务器响应超时，请稍后重试';
    case DioExceptionType.connectionError:
      return '网络连接失败，请检查网络设置';
    case DioExceptionType.cancel:
      return '请求已取消';
    default:
      return '网络异常，请检查网络后重试';
  }
}

/// HTTP 状态码 → 用户友好消息
String? _statusCodeMessage(int? statusCode, String context) {
  switch (statusCode) {
    case 400:
      return '请求参数错误';
    case 401:
      // 登录场景：密码错误；其他场景：登录过期
      return context == 'login' ? '邮箱或密码错误' : '登录已过期，请重新登录';
    case 403:
      return '没有权限执行此操作';
    case 404:
      return '请求的资源不存在';
    case 409:
      return '数据冲突，可能已存在相同记录';
    case 429:
      return '操作太频繁，请稍后再试';
    case 500:
      return '服务器错误，请稍后重试';
    case 502:
    case 503:
      return '服务暂时不可用，请稍后重试';
    default:
      return null;
  }
}
