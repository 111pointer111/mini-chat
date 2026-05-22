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
  @override
  Future<User?> build() async {
    final storage = ref.read(secureStorageProvider);
    final token = await storage.read(key: AppConstants.tokenKey);
    if (token == null) return null;

    ref.read(tokenProvider.notifier).state = token;

    try {
      final res = await ref.read(authApiProvider).getMe();
      final user = User.fromJson(res.data['user'] as Map<String, dynamic>);
      _connectSocket(token);
      return user;
    } catch (e) {
      await storage.delete(key: AppConstants.tokenKey);
      ref.read(tokenProvider.notifier).state = null;
      return null;
    }
  }

  Future<void> login(User user, String token) async {
    final storage = ref.read(secureStorageProvider);
    await storage.write(key: AppConstants.tokenKey, value: token);
    ref.read(tokenProvider.notifier).state = token;
    state = AsyncValue.data(user);
    _connectSocket(token);
  }

  Future<void> logout() async {
    final storage = ref.read(secureStorageProvider);
    await storage.delete(key: AppConstants.tokenKey);
    ref.read(tokenProvider.notifier).state = null;
    ref.read(socketServiceProvider).disconnect();
    state = const AsyncValue.data(null);
  }

  void _connectSocket(String token) {
    ref.read(socketServiceProvider).connect(token);
  }
}
