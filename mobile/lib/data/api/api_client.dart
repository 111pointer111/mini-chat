import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants.dart';
import '../../providers/auth_provider.dart';

/// 全局单例 Dio 客户端。
/// token 通过 Ref 动态读取，不再每次 token 变化时重建实例。
class ApiClient {
  late final Dio dio;
  final Ref _ref;

  ApiClient(this._ref) {
    dio = Dio(BaseOptions(
      baseUrl: AppConstants.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _ref.read(tokenProvider);
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          debugPrint('[ApiClient] 401 received, logging out');
          _ref.read(authStateProvider.notifier).logout();
          // 用 DioException 替代原始错误，防止调用方重复处理
          handler.reject(DioException(
            requestOptions: error.requestOptions,
            response: error.response,
            type: DioExceptionType.badResponse,
            message: '登录已过期',
          ));
          return;
        }
        handler.next(error);
      },
    ));
  }

  /// 当 API 地址变化时（如热重载切换环境），更新 baseUrl
  void updateBaseUrl(String url) {
    dio.options.baseUrl = url;
  }
}
