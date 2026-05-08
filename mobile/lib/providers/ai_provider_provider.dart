import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/ai_provider_api.dart';
import '../data/models/ai_provider.dart';
import 'auth_provider.dart';

final aiProviderApiProvider = Provider<AIProviderApi>((ref) {
  return AIProviderApi(ref.watch(apiClientProvider));
});

final aiProvidersProvider =
    AsyncNotifierProvider<AIProvidersNotifier, List<AIProvider>>(() {
  return AIProvidersNotifier();
});

class AIProvidersNotifier extends AsyncNotifier<List<AIProvider>> {
  @override
  Future<List<AIProvider>> build() async {
    final res = await ref.read(aiProviderApiProvider).getProviders();
    return (res.data as List<dynamic>)
        .map((e) => AIProvider.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }
}

final userAIProviderProvider =
    AsyncNotifierProvider<UserAIProviderNotifier, AIProvider?>(() {
  return UserAIProviderNotifier();
});

class UserAIProviderNotifier extends AsyncNotifier<AIProvider?> {
  @override
  Future<AIProvider?> build() async {
    try {
      final res = await ref.read(aiProviderApiProvider).getUserProvider();
      if (res.data == null || res.data is! Map<String, dynamic>) return null;
      return AIProvider.fromJson(res.data as Map<String, dynamic>);
    } catch (e) {
      return null;
    }
  }

  Future<void> selectProvider(String providerId) async {
    await ref.read(aiProviderApiProvider).setUserProvider(providerId);
    ref.invalidateSelf();
  }
}

// Admin providers
final adminProvidersProvider =
    AsyncNotifierProvider<AdminProvidersNotifier, List<AIProvider>>(() {
  return AdminProvidersNotifier();
});

class AdminProvidersNotifier extends AsyncNotifier<List<AIProvider>> {
  @override
  Future<List<AIProvider>> build() async {
    final res = await ref.read(aiProviderApiProvider).getAdminProviders();
    return (res.data as List<dynamic>)
        .map((e) => AIProvider.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<void> create(Map<String, dynamic> data) async {
    await ref.read(aiProviderApiProvider).createProvider(data);
    refresh();
  }

  Future<void> updateProvider(String id, Map<String, dynamic> data) async {
    await ref.read(aiProviderApiProvider).updateProvider(id, data);
    refresh();
  }

  Future<void> delete(String id) async {
    await ref.read(aiProviderApiProvider).deleteProvider(id);
    refresh();
  }
}
