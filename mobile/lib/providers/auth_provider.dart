import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/constants.dart';
import '../data/api/api_client.dart';
import '../data/api/auth_api.dart';
import '../data/models/user.dart';
import '../data/services/socket_service.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final tokenProvider = StateProvider<String?>((ref) => null);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref);
});

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(apiClientProvider));
});

final socketServiceProvider = Provider<SocketService>((ref) {
  final service = SocketService();
  ref.onDispose(() => service.dispose());
  return service;
});

final authStateProvider = AsyncNotifierProvider<AuthNotifier, User?>(() {
  return AuthNotifier();
});

class AuthNotifier extends AsyncNotifier<User?> {
  User? _cachedUser;
  bool _isRefreshing = false;

  @override
  Future<User?> build() async {
    // 如果已有缓存，直接返回，不显示加载状态
    if (_cachedUser != null) return _cachedUser;

    final storage = ref.read(secureStorageProvider);
    final token = await storage.read(key: AppConstants.tokenKey);
    if (token == null) return null;

    ref.read(tokenProvider.notifier).state = token;

    try {
      final res = await ref.read(authApiProvider).getMe();
      final user = User.fromJson(res.data['user'] as Map<String, dynamic>);
      _cachedUser = user;
      _connectSocket(token);
      return user;
    } catch (e) {
      await storage.delete(key: AppConstants.tokenKey);
      ref.read(tokenProvider.notifier).state = null;
      _cachedUser = null;
      return null;
    }
  }

  Future<void> login(User user, String token) async {
    final storage = ref.read(secureStorageProvider);
    await storage.write(key: AppConstants.tokenKey, value: token);
    ref.read(tokenProvider.notifier).state = token;
    _cachedUser = user;
    state = AsyncValue.data(user);
    _connectSocket(token);
  }

  Future<void> logout() async {
    final storage = ref.read(secureStorageProvider);
    await storage.delete(key: AppConstants.tokenKey);
    ref.read(tokenProvider.notifier).state = null;
    ref.read(socketServiceProvider).disconnect();
    _cachedUser = null;
    state = const AsyncValue.data(null);
  }

  /// 静默刷新用户数据（不显示加载状态）
  Future<void> refreshSilently() async {
    if (_isRefreshing) return;
    _isRefreshing = true;

    try {
      final token = ref.read(tokenProvider);
      if (token == null) {
        _isRefreshing = false;
        return;
      }

      final res = await ref.read(authApiProvider).getMe();
      final user = User.fromJson(res.data['user'] as Map<String, dynamic>);
      _cachedUser = user;
      // 不更新 state，避免触发 loading 状态
    } catch (e) {
      // 静默失败，不改变状态
      // 如果是 token 过期，下次操作会重新登录
    } finally {
      _isRefreshing = false;
    }
  }

  /// 获取缓存的用户（不触发异步加载）
  User? get cachedUser => _cachedUser;

  void _connectSocket(String token) {
    ref.read(socketServiceProvider).connect(token);
  }
}
