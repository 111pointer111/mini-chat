import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../providers/chat_provider.dart';
import '../../providers/group_provider.dart';
import '../../shared/utils/toast_utils.dart';
import '../../shared/utils/error_utils.dart';

class CreateGroupScreen extends ConsumerStatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  ConsumerState<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends ConsumerState<CreateGroupScreen> {
  final _nameController = TextEditingController();
  final Set<String> _selectedMemberIds = {};
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _createGroup() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      showErrorToast(context, '请输入群名称');
      return;
    }
    if (_selectedMemberIds.isEmpty) {
      showErrorToast(context, '请选择至少一位好友');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final group = await ref
          .read(groupsProvider.notifier)
          .createGroup(name, _selectedMemberIds.toList());
      if (mounted) {
        showSuccessToast(context, '群组创建成功');
        context.go('/groups/${group.id}');
      }
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, fallback: '创建群组失败'));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(friendsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('创建群组'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _createGroup,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('创建'),
          ),
        ],
      ),
      body: Column(
        children: [
          // 群名称输入
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                hintText: '输入群名称',
                prefixIcon: Icon(Icons.group_outlined),
                border: OutlineInputBorder(),
              ),
            ),
          ),
          // 已选成员
          if (_selectedMemberIds.isNotEmpty)
            Container(
              height: 80,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.grey[50],
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '已选 ${_selectedMemberIds.length} 人',
                    style: const TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 4),
                  Expanded(
                    child: friendsAsync.when(
                      data: (friends) {
                        final selectedFriends = friends
                            .where((f) => _selectedMemberIds.contains(f.id))
                            .toList();
                        return ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: selectedFriends.length,
                          itemBuilder: (context, index) {
                            final friend = selectedFriends[index];
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Chip(
                                avatar: CircleAvatar(
                                  backgroundColor: AppTheme.primary.withAlpha(25),
                                  child: Text(
                                    friend.username.isNotEmpty
                                        ? friend.username[0].toUpperCase()
                                        : '?',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppTheme.primary),
                                  ),
                                ),
                                label: Text(
                                  friend.username,
                                  style: const TextStyle(fontSize: 12),
                                ),
                                deleteIcon:
                                    const Icon(Icons.close, size: 16),
                                onDeleted: () {
                                  setState(() {
                                    _selectedMemberIds.remove(friend.id);
                                  });
                                },
                              ),
                            );
                          },
                        );
                      },
                      loading: () => const SizedBox(),
                      error: (_, __) => const SizedBox(),
                    ),
                  ),
                ],
              ),
            ),
          // 好友列表
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Icon(Icons.people_outline,
                    size: 18, color: AppTheme.textSecondary),
                SizedBox(width: 8),
                Text(
                  '选择好友',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),
          Expanded(
            child: friendsAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline,
                        size: 48, color: Colors.red[300]),
                    const SizedBox(height: 12),
                    Text('加载好友列表失败',
                        style: TextStyle(color: Colors.grey[600])),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () =>
                          ref.read(friendsProvider.notifier).refresh(),
                      icon: const Icon(Icons.refresh),
                      label: const Text('重试'),
                    ),
                  ],
                ),
              ),
              data: (friends) {
                if (friends.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.people_outline,
                            size: 64, color: Colors.grey[300]),
                        const SizedBox(height: 16),
                        Text('暂无好友',
                            style: TextStyle(
                                fontSize: 16, color: Colors.grey[500])),
                        const SizedBox(height: 8),
                        Text('请先添加好友后再创建群组',
                            style: TextStyle(
                                fontSize: 13, color: Colors.grey[400])),
                      ],
                    ),
                  );
                }
                return ListView.builder(
                  itemCount: friends.length,
                  itemBuilder: (context, index) {
                    final friend = friends[index];
                    final isSelected =
                        _selectedMemberIds.contains(friend.id);
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppTheme.primary.withAlpha(25),
                        child: Text(
                          friend.username.isNotEmpty
                              ? friend.username[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                              color: AppTheme.primary),
                        ),
                      ),
                      title: Text(friend.username),
                      trailing: Checkbox(
                        value: isSelected,
                        onChanged: (value) {
                          setState(() {
                            if (value == true) {
                              _selectedMemberIds.add(friend.id);
                            } else {
                              _selectedMemberIds.remove(friend.id);
                            }
                          });
                        },
                        activeColor: AppTheme.primary,
                      ),
                      onTap: () {
                        setState(() {
                          if (isSelected) {
                            _selectedMemberIds.remove(friend.id);
                          } else {
                            _selectedMemberIds.add(friend.id);
                          }
                        });
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
