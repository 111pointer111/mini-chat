import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/scheduled_task_api.dart';
import '../data/models/scheduled_task.dart';
import 'auth_provider.dart';

final scheduledTaskApiRefProvider = Provider<ScheduledTaskApi>((ref) {
  return ScheduledTaskApi(ref.watch(apiClientProvider));
});

final tasksProvider =
    AsyncNotifierProvider<TasksNotifier, TasksResponse>(() {
  return TasksNotifier();
});

class TasksNotifier extends AsyncNotifier<TasksResponse> {
  @override
  Future<TasksResponse> build() async {
    final res = await ref.read(scheduledTaskApiRefProvider).getTasks();
    return TasksResponse.fromJson(res.data as Map<String, dynamic>);
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
    refresh();
  }

  Future<void> updateCustomTask(String taskId, bool enabled, String pushTime) async {
    await ref.read(scheduledTaskApiRefProvider).updateCustomTask(taskId, {
      'enabled': enabled,
      'pushTime': pushTime,
    });
    refresh();
  }

  Future<void> deleteCustomTask(String taskId) async {
    await ref.read(scheduledTaskApiRefProvider).deleteCustomTask(taskId);
    refresh();
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
