import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/group.dart';
import '../../data/models/user.dart';
import '../../providers/group_provider.dart';

class GroupSettingsScreen extends ConsumerStatefulWidget {
  final String groupId;

  const GroupSettingsScreen({super.key, required this.groupId});

  @override
  ConsumerState<GroupSettingsScreen> createState() =>
      _GroupSettingsScreenState();
}

class _GroupSettingsScreenState extends ConsumerState<GroupSettingsScreen> {
  @override
  void initState() {
    super.initState();
    ref.read(groupMembersProvider(widget.groupId).notifier).refresh(widget.groupId);
  }

  @override
  Widget build(BuildContext context) {
    final membersAsync = ref.watch(groupMembersProvider(widget.groupId));
    final groupsAsync = ref.watch(groupsProvider);
    final group = groupsAsync.valueOrNull
        ?.where((g) => g.id == widget.groupId)
        .firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('群设置'),
      ),
      body: ListView(
        children: [
          // 群信息卡片
          Container(
            padding: const EdgeInsets.all(24),
            color: Colors.white,
            child: Column(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.group,
                      color: Colors.white, size: 40),
                ),
                const SizedBox(height: 16),
                Text(
                  group?.name ?? '群组',
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold),
                ),
                if (group?.assistantEnabled == true) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.withAlpha(25),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.smart_toy,
                            size: 14, color: Colors.green),
                        SizedBox(width: 4),
                        Text(
                          '小助手已启用',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          // 功能按钮
          _buildMenuItem(
            icon: Icons.library_books_outlined,
            title: '群知识库',
            subtitle: '管理群组共享的知识文档',
            onTap: () => context
                .push('/groups/${widget.groupId}/knowledge-base'),
          ),
          _buildMenuItem(
            icon: Icons.person_add_outlined,
            title: '添加成员',
            subtitle: '邀请好友加入群组',
            onTap: () => _showAddMemberDialog(),
          ),
          const SizedBox(height: 8),
          // 成员列表
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.white,
            child: Row(
              children: [
                const Icon(Icons.people_outline,
                    size: 18, color: AppTheme.textSecondary),
                const SizedBox(width: 8),
                const Text(
                  '群成员',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary),
                ),
                const Spacer(),
                membersAsync.when(
                  data: (members) => Text(
                    '${members.length} 人',
                    style: const TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary),
                  ),
                  loading: () => const SizedBox(),
                  error: (_, __) => const SizedBox(),
                ),
              ],
            ),
          ),
          membersAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('加载失败: ${e.toString()}'),
              ),
            ),
            data: (members) => Column(
              children: members
                  .map((member) => _buildMemberTile(member))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      color: Colors.white,
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppTheme.primary.withAlpha(15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppTheme.primary, size: 20),
        ),
        title: Text(title,
            style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w500)),
        subtitle: Text(subtitle,
            style: const TextStyle(
                fontSize: 12, color: AppTheme.textSecondary)),
        trailing: const Icon(Icons.chevron_right, size: 20),
        onTap: onTap,
      ),
    );
  }

  Widget _buildMemberTile(User member) {
    return Container(
      color: Colors.white,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppTheme.primary.withAlpha(25),
          child: Text(
            member.username.isNotEmpty
                ? member.username[0].toUpperCase()
                : '?',
            style: const TextStyle(color: AppTheme.primary),
          ),
        ),
        title: Text(member.username),
        subtitle: member.id == 'owner'
            ? const Text('群主',
                style: TextStyle(fontSize: 12, color: Colors.orange))
            : null,
      ),
    );
  }

  Future<void> _showAddMemberDialog() async {
    // TODO: 实现添加成员对话框
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('添加成员功能开发中')),
    );
  }
}
