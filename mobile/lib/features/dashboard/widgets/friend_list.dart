import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../data/models/user.dart';
import '../../../providers/chat_provider.dart';
import '../../../providers/scheduled_task_provider.dart';
import '../../../shared/utils/error_utils.dart';
import 'user_search.dart';

class FriendList extends ConsumerStatefulWidget {
  const FriendList({super.key});

  @override
  ConsumerState<FriendList> createState() => _FriendListState();
}

class _FriendListState extends ConsumerState<FriendList> {
  List<EnabledTask> _enabledTasks = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _loadData());
  }

  Future<void> _loadData() async {
    await ref.read(friendsProvider.notifier).refresh();
    await ref.read(pendingRequestsProvider.notifier).refresh();
    await _loadEnabledTasks();
  }

  Future<void> _loadEnabledTasks() async {
    try {
      final api = ref.read(scheduledTaskApiRefProvider);
      final res = await api.getTasks();
      final data = res.data as Map<String, dynamic>;
      final presetTasks = (data['presetTasks'] as List<dynamic>? ?? []);
      final customTasks = (data['customTasks'] as List<dynamic>? ?? []);
      final result = <EnabledTask>[];
      for (final t in presetTasks) {
        final map = t as Map<String, dynamic>;
        if (map['enabled'] == true && map['conversationId'] != null) {
          result.add(EnabledTask(
            id: map['taskType'] as String? ?? '',
            name: map['taskName'] as String? ?? '',
            icon: _taskIcon(map['taskType'] as String? ?? ''),
            isCustom: false,
          ));
        }
      }
      for (final t in customTasks) {
        final map = t as Map<String, dynamic>;
        if (map['enabled'] == true && map['conversationId'] != null) {
          result.add(EnabledTask(
            id: map['_id'] as String? ?? '',
            name: map['taskName'] as String? ?? '',
            icon: Icons.auto_awesome,
            isCustom: true,
          ));
        }
      }
      if (mounted) setState(() => _enabledTasks = result);
    } catch (_) {}
  }

  IconData _taskIcon(String taskType) {
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

  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(friendsProvider);
    final requestsAsync = ref.watch(pendingRequestsProvider);
    final selection = ref.watch(chatSelectionProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              hintText: '搜索用户...',
              prefixIcon: const Icon(Icons.search, size: 20),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              filled: true,
              fillColor: Colors.grey.shade100,
              suffixIcon: IconButton(
                icon: const Icon(Icons.person_add_outlined, size: 20),
                onPressed: () => _showUserSearch(context),
              ),
            ),
            readOnly: true,
            onTap: () => _showUserSearch(context),
          ),
        ),
        requestsAsync.when(
          data: (requests) {
            if (requests.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Text('待处理请求 (${requests.length})',
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.w600)),
                ),
                ...requests.map((req) => ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppTheme.secondary.withAlpha(25),
                        child: Text(
                          req.requester.username[0].toUpperCase(),
                          style: const TextStyle(
                              color: AppTheme.secondary,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      title: Text(req.requester.username,
                          style: const TextStyle(fontSize: 14)),
                      trailing: ElevatedButton(
                        onPressed: () => ref
                            .read(pendingRequestsProvider.notifier)
                            .acceptRequest(req.id),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          textStyle: const TextStyle(fontSize: 12),
                        ),
                        child: const Text('接受'),
                      ),
                      dense: true,
                    )),
                const Divider(),
              ],
            );
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),
        Expanded(
          child: friendsAsync.when(
            data: (friends) {
              if (friends.isEmpty && _enabledTasks.isEmpty) {
                return const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.people_outline,
                          size: 64, color: AppTheme.textSecondary),
                      SizedBox(height: 16),
                      Text('暂无好友',
                          style: TextStyle(
                              fontSize: 16, color: AppTheme.textSecondary)),
                      SizedBox(height: 8),
                      Text('点击右上角添加好友',
                          style: TextStyle(
                              fontSize: 13, color: AppTheme.textSecondary)),
                    ],
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: _loadData,
                child: ListView(
                  children: [
                    if (_enabledTasks.isNotEmpty) ...[
                      _buildSectionHeader('定时任务'),
                      ..._enabledTasks
                          .map((t) => _buildTaskTile(t, selection)),
                      if (friends.isNotEmpty) const Divider(),
                    ],
                    if (friends.isNotEmpty) ...[
                      _buildSectionHeader('好友 (${friends.length})'),
                      ...friends
                          .map((f) => _buildFriendTile(f, selection)),
                    ],
                  ],
                ),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text(extractErrorMessage(e, fallback: '加载好友列表失败'))),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(title,
          style: const TextStyle(
              fontSize: 12,
              color: AppTheme.textSecondary,
              fontWeight: FontWeight.w600)),
    );
  }

  Widget _buildTaskTile(EnabledTask task, ChatSelection selection) {
    final isSelected =
        selection.type == ChatType.task && selection.id == task.id;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor:
            isSelected ? AppTheme.secondary : AppTheme.secondary.withAlpha(25),
        child: Icon(
          task.icon,
          size: 18,
          color: isSelected ? Colors.white : AppTheme.secondary,
        ),
      ),
      title: Text(task.name,
          style: TextStyle(
              fontSize: 14,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal)),
      selected: isSelected,
      selectedTileColor: AppTheme.secondary.withAlpha(15),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onTap: () {
        ref.read(chatSelectionProvider.notifier).state = ChatSelection(
          type: ChatType.task,
          id: task.id,
          name: task.name,
        );
        ref.read(messagesProvider.notifier).fetchTaskMessages(task.id);
      },
    );
  }

  Widget _buildFriendTile(User friend, ChatSelection selection) {
    final isSelected =
        selection.type == ChatType.friend && selection.id == friend.id;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor:
            isSelected ? AppTheme.primary : AppTheme.primary.withAlpha(25),
        child: Text(
          friend.username[0].toUpperCase(),
          style: TextStyle(
            color: isSelected ? Colors.white : AppTheme.primary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      title: Text(friend.username,
          style: TextStyle(
              fontSize: 14,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal)),
      selected: isSelected,
      selectedTileColor: AppTheme.primary.withAlpha(15),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onTap: () {
        ref.read(chatSelectionProvider.notifier).state = ChatSelection(
          type: ChatType.friend,
          id: friend.id,
          name: friend.username,
        );
        ref.read(messagesProvider.notifier).fetchFriendMessages(friend.id);
      },
    );
  }

  void _showUserSearch(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => const UserSearch(),
    );
  }
}
