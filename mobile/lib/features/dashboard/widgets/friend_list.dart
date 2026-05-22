import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

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
        _buildSearchBar(),
        requestsAsync.when(
          data: (requests) {
            if (requests.isEmpty) return const SizedBox.shrink();
            return _buildPendingRequests(requests);
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),
        Expanded(
          child: friendsAsync.when(
            data: (friends) {
              if (friends.isEmpty && _enabledTasks.isEmpty) {
                return _buildEmptyState();
              }
              return RefreshIndicator(
                onRefresh: _loadData,
                color: AppColors.primary,
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  children: [
                    if (_enabledTasks.isNotEmpty) ...[
                      _buildSectionHeader('定时任务', Icons.schedule_outlined),
                      ..._enabledTasks.map((t) => _buildTaskTile(t, selection)),
                      if (friends.isNotEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          child: Divider(height: 1),
                        ),
                    ],
                    if (friends.isNotEmpty) ...[
                      _buildSectionHeader('好友', Icons.people_outline, count: friends.length),
                      ...friends.map((f) => _buildFriendTile(f, selection)),
                    ],
                    const SizedBox(height: 20),
                  ],
                ),
              );
            },
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
            error: (e, _) => Center(
              child: Text(
                extractErrorMessage(e, fallback: '加载好友列表失败'),
                style: GoogleFonts.inter(color: AppColors.textSecondaryLight),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Container(
        decoration: BoxDecoration(
          color: AppThemeHelper.isDark(context)
              ? AppColors.surfaceDark
              : Colors.white,
          borderRadius: AppRadius.lgAll,
          boxShadow: AppShadows.sm,
        ),
        child: TextField(
          decoration: InputDecoration(
            hintText: '搜索好友...',
            hintStyle: GoogleFonts.inter(
              color: AppThemeHelper.textSecondary(context),
            ),
            prefixIcon: Icon(
              Icons.search,
              size: 20,
              color: AppThemeHelper.textSecondary(context),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: AppRadius.lgAll,
              borderSide: BorderSide.none,
            ),
            filled: true,
            fillColor: AppThemeHelper.isDark(context)
                ? AppColors.surfaceDark
                : Colors.white,
            suffixIcon: Container(
              margin: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.accent],
                ),
                borderRadius: AppRadius.smAll,
              ),
              child: IconButton(
                icon: const Icon(Icons.person_add_outlined, size: 18, color: Colors.white),
                onPressed: () => _showUserSearch(context),
              ),
            ),
          ),
          readOnly: true,
          onTap: () => _showUserSearch(context),
        ),
      ),
    );
  }

  Widget _buildPendingRequests(List<dynamic> requests) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withAlpha(13),
            AppColors.accent.withAlpha(13),
          ],
        ),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.primary.withAlpha(26)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: AppRadius.smAll,
                ),
                child: const Icon(Icons.person_add, size: 14, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Text(
                '待处理请求 (${requests.length})',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...requests.map((req) => _buildRequestTile(req)),
        ],
      ),
    );
  }

  Widget _buildRequestTile(dynamic req) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.mdAll,
        boxShadow: AppShadows.sm,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.secondary.withAlpha(26),
            child: Text(
              req.requester.username[0].toUpperCase(),
              style: GoogleFonts.inter(
                color: AppColors.secondary,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              req.requester.username,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.accent],
              ),
              borderRadius: AppRadius.smAll,
            ),
            child: ElevatedButton(
              onPressed: () => ref.read(pendingRequestsProvider.notifier).acceptRequest(req.id),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.smAll,
                ),
              ),
              child: Text(
                '接受',
                style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(13),
              borderRadius: AppRadius.xxlAll,
            ),
            child: const Icon(
              Icons.people_outline,
              size: 56,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            '暂无好友',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '点击右上角添加好友',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.textSecondaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, {int? count}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.textSecondaryLight),
          const SizedBox(width: 6),
          Text(
            count != null ? '$title ($count)' : title,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: AppColors.textSecondaryLight,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskTile(EnabledTask task, ChatSelection selection) {
    final isSelected = selection.type == ChatType.task && selection.id == task.id;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.secondary.withAlpha(20) : Colors.transparent,
        borderRadius: AppRadius.mdAll,
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.secondary : AppColors.secondary.withAlpha(20),
            borderRadius: AppRadius.smAll,
          ),
          child: Icon(
            task.icon,
            size: 18,
            color: isSelected ? Colors.white : AppColors.secondary,
          ),
        ),
        title: Text(
          task.name,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        onTap: () {
          ref.read(chatSelectionProvider.notifier).state = ChatSelection(
            type: ChatType.task,
            id: task.id,
            name: task.name,
          );
          ref.read(messagesProvider.notifier).fetchTaskMessages(task.id);
        },
      ),
    );
  }

  Widget _buildFriendTile(User friend, ChatSelection selection) {
    final isSelected = selection.type == ChatType.friend && selection.id == friend.id;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.primary.withAlpha(20) : Colors.transparent,
        borderRadius: AppRadius.mdAll,
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            gradient: isSelected
                ? const LinearGradient(colors: [AppColors.primary, AppColors.accent])
                : null,
            color: isSelected ? null : AppColors.primary.withAlpha(20),
            borderRadius: AppRadius.smAll,
          ),
          child: CircleAvatar(
            radius: 18,
            backgroundColor: isSelected ? Colors.transparent : Colors.white,
            child: Text(
              friend.username[0].toUpperCase(),
              style: GoogleFonts.inter(
                color: isSelected ? Colors.white : AppColors.primary,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ),
        title: Text(
          friend.username,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        onTap: () {
          ref.read(chatSelectionProvider.notifier).state = ChatSelection(
            type: ChatType.friend,
            id: friend.id,
            name: friend.username,
          );
          ref.read(messagesProvider.notifier).fetchFriendMessages(friend.id);
        },
      ),
    );
  }

  void _showUserSearch(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const UserSearch(),
    );
  }
}
