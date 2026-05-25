import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/scheduled_task_api.dart';
import '../data/models/scheduled_task.dart';
import '../data/services/cache_service.dart';
import 'auth_provider.dart';

final scheduledTaskApiRefProvider = Provider<ScheduledTaskApi>((ref) {
  return ScheduledTaskApi(ref.watch(apiClientProvider));
});

final tasksProvider =
    AsyncNotifierProvider.autoDispose<TasksNotifier, TasksResponse>(() {
  return TasksNotifier();
});

class TasksNotifier extends AutoDisposeAsyncNotifier<TasksResponse> {
  final CacheService _cache = CacheService();

  @override
  Future<TasksResponse> build() async {
    try {
      final cached = await _cache.getTasksJson();
      if (cached != null) {
        _fetchAndCache();
        return TasksResponse.fromJson(cached);
      }
    } catch (_) {}
    return await _fetchAndCache();
  }

  Future<TasksResponse> _fetchAndCache() async {
    try {
      final res = await ref.read(scheduledTaskApiRefProvider).getTasks();
      final data = res.data as Map<String, dynamic>;
      final tasks = TasksResponse.fromJson(data);
      await _cache.cacheTasksJson(data);
      return tasks;
    } catch (e) {
      final cached = await _cache.getTasksJson();
      if (cached != null) return TasksResponse.fromJson(cached);
      rethrow;
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<void> updatePresetTask(String taskType, bool enabled, String pushTime) async {
    await ref.read(scheduledTaskApiRefProvider).updatePresetTask(taskType, {
      'enabled': enabled,
      'pushTime': pushTime,
    });
    await refresh();
  }

  Future<void> updateCustomTask(String taskId, bool enabled, String pushTime) async {
    await ref.read(scheduledTaskApiRefProvider).updateCustomTask(taskId, {
      'enabled': enabled,
      'pushTime': pushTime,
    });
    await refresh();
  }

  Future<void> deleteCustomTask(String taskId) async {
    await ref.read(scheduledTaskApiRefProvider).deleteCustomTask(taskId);
    await refresh();
  }
}

class EnabledTask {
  final String id;
  final String name;
  final IconData icon;
  final bool isCustom;

  EnabledTask({
    required this.id,
    required this.name,
    required this.icon,
    required this.isCustom,
  });
}
