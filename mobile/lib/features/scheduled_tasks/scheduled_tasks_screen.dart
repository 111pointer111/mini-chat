import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../data/models/scheduled_task.dart';
import '../../providers/scheduled_task_provider.dart';
import '../../shared/utils/toast_utils.dart';

class ScheduledTasksScreen extends ConsumerStatefulWidget {
  const ScheduledTasksScreen({super.key});

  @override
  ConsumerState<ScheduledTasksScreen> createState() =>
      _ScheduledTasksScreenState();
}

class _ScheduledTasksScreenState extends ConsumerState<ScheduledTasksScreen> {
  @override
  void initState() {
    super.initState();
    ref.read(tasksProvider.notifier).refresh();
  }

  IconData _presetIcon(String taskType) {
    switch (taskType) {
      case 'github_trending':
        return Icons.code;
      case 'daily_poem':
        return Icons.menu_book;
      case 'daily_english':
        return Icons.language;
      default:
        return Icons.task_alt;
    }
  }

  String _presetLabel(String taskType) {
    switch (taskType) {
      case 'github_trending':
        return 'GitHub Trending';
      case 'daily_poem':
        return '每日诗词';
      case 'daily_english':
        return '每日英语';
      default:
        return taskType;
    }
  }

  Future<void> _pickTime(PresetTask task) async {
    final parts = task.pushTime.split(':');
    final initial = TimeOfDay(
      hour: int.tryParse(parts[0]) ?? 9,
      minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0,
    );
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null && mounted) {
      final time =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      try {
        await ref
            .read(tasksProvider.notifier)
            .updatePresetTask(task.taskType, task.enabled, time);
        if (mounted) showSuccessToast(context, '推送时间已更新');
      } catch (e) {
        if (mounted) showErrorToast(context, '更新失败');
      }
    }
  }

  Future<void> _pickCustomTime(CustomTask task) async {
    final parts = task.pushTime.split(':');
    final initial = TimeOfDay(
      hour: int.tryParse(parts[0]) ?? 9,
      minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0,
    );
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null && mounted) {
      final time =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      try {
        await ref
            .read(tasksProvider.notifier)
            .updateCustomTask(task.id, task.enabled, time);
        if (mounted) showSuccessToast(context, '推送时间已更新');
      } catch (e) {
        if (mounted) showErrorToast(context, '更新失败');
      }
    }
  }

  Future<void> _togglePreset(PresetTask task, bool value) async {
    try {
      await ref
          .read(tasksProvider.notifier)
          .updatePresetTask(task.taskType, value, task.pushTime);
    } catch (e) {
      if (mounted) showErrorToast(context, '更新失败');
    }
  }

  Future<void> _toggleCustom(CustomTask task, bool value) async {
    try {
      await ref
          .read(tasksProvider.notifier)
          .updateCustomTask(task.id, value, task.pushTime);
    } catch (e) {
      if (mounted) showErrorToast(context, '更新失败');
    }
  }

  Future<void> _deleteCustom(CustomTask task) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: Text('确定要删除任务「${task.taskName}」吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirm == true && mounted) {
      try {
        await ref.read(tasksProvider.notifier).deleteCustomTask(task.id);
        if (mounted) showSuccessToast(context, '已删除');
      } catch (e) {
        if (mounted) showErrorToast(context, '删除失败');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(tasksProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
        title: const Text('定时任务'),
      ),
      body: tasksAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
              const SizedBox(height: 12),
              Text('加载失败', style: TextStyle(color: Colors.grey[600])),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () =>
                    ref.read(tasksProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh),
                label: const Text('重试'),
              ),
            ],
          ),
        ),
        data: (tasks) {
          if (tasks.presetTasks.isEmpty && tasks.customTasks.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.schedule_outlined,
                      size: 64, color: Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text('暂无定时任务',
                      style: TextStyle(
                          fontSize: 16, color: Colors.grey[500])),
                ],
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (tasks.presetTasks.isNotEmpty) ...[
                const Text(
                  '预设任务',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                ...tasks.presetTasks.map((t) => _buildPresetCard(t)),
                const SizedBox(height: 24),
              ],
              if (tasks.customTasks.isNotEmpty) ...[
                const Text(
                  '自定义任务',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                ...tasks.customTasks.map((t) => _buildCustomCard(t)),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildPresetCard(PresetTask task) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppTheme.primary.withAlpha(25),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_presetIcon(task.taskType),
                  color: AppTheme.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_presetLabel(task.taskType),
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    '推送时间 ${task.pushTime}',
                    style: const TextStyle(
                        fontSize: 13, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.access_time, size: 20),
              tooltip: '设置时间',
              onPressed: () => _pickTime(task),
            ),
            Switch(
              value: task.enabled,
              activeColor: AppTheme.primary,
              onChanged: (v) => _togglePreset(task, v),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomCard(CustomTask task) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppTheme.secondary.withAlpha(25),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.auto_awesome,
                  color: AppTheme.secondary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.taskName,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    '推送时间 ${task.pushTime}',
                    style: const TextStyle(
                        fontSize: 13, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
            Switch(
              value: task.enabled,
              activeColor: AppTheme.primary,
              onChanged: (v) => _toggleCustom(task, v),
            ),
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert,
                  size: 20, color: AppTheme.textSecondary),
              padding: EdgeInsets.zero,
              onSelected: (value) {
                switch (value) {
                  case 'time':
                    _pickCustomTime(task);
                    break;
                  case 'delete':
                    _deleteCustom(task);
                    break;
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'time',
                  child: Row(
                    children: [
                      Icon(Icons.access_time, size: 18),
                      SizedBox(width: 8),
                      Text('设置时间'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline,
                          size: 18, color: Colors.red),
                      SizedBox(width: 8),
                      Text('删除', style: TextStyle(color: Colors.red)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
