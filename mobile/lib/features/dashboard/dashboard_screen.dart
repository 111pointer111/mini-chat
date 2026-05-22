import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/chat_provider.dart';
import '../../data/models/message.dart';
import 'widgets/friend_list.dart';
import 'widgets/chat_window.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  final List<StreamSubscription> _subscriptions = [];

  @override
  void initState() {
    super.initState();
    _setupSocketListeners();
  }

  @override
  void dispose() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    super.dispose();
  }

  void _setupSocketListeners() {
    final socketService = ref.read(socketServiceProvider);

    _subscriptions.add(
      socketService.onReceiveMessage.listen((data) {
        final message = Message.fromJson(data);
        ref.read(messagesProvider.notifier).addMessage(message);
      }),
    );

    _subscriptions.add(
      socketService.onReceiveGroupMessage.listen((data) {
        final message = Message.fromJson(data);
        ref.read(messagesProvider.notifier).addMessage(message);
      }),
    );

    _subscriptions.add(
      socketService.onScheduledTaskMessage.listen((data) {
        final selection = ref.read(chatSelectionProvider);
        if (selection.type == ChatType.task) {
          ref.read(messagesProvider.notifier).fetchTaskMessages(selection.id!);
        }
      }),
    );

    _subscriptions.add(
      socketService.onFriendRequestAccepted.listen((data) {
        ref.read(friendsProvider.notifier).refresh();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${data['accepterName'] ?? '好友'} 已接受你的好友请求'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }),
    );
  }

  void _logout() {
    ref.read(authStateProvider.notifier).logout();
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).valueOrNull;
    final selection = ref.watch(chatSelectionProvider);
    final hasChat = selection.type != ChatType.none;

    return Scaffold(
      appBar: hasChat
          ? AppBar(
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  ref.read(chatSelectionProvider.notifier).state =
                      const ChatSelection();
                },
              ),
              title: Text(selection.name ?? ''),
              actions: [
                PopupMenuButton<String>(
                  icon: CircleAvatar(
                    radius: 16,
                    backgroundColor: AppTheme.primary.withAlpha(25),
                    child: Text(
                      (user?.username ?? 'U')[0].toUpperCase(),
                      style: const TextStyle(
                          color: AppTheme.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14),
                    ),
                  ),
                  onSelected: (value) {
                    switch (value) {
                      case 'ai':
                        context.push('/ai-chat');
                        break;
                      case 'tasks':
                        context.push('/scheduled-tasks');
                        break;
                      case 'kb':
                        context.push('/knowledge-base');
                        break;
                      case 'mcp':
                        context.push('/mcp-tools');
                        break;
                      case 'admin':
                        context.push('/admin/ai-providers');
                        break;
                      case 'logout':
                        _logout();
                        break;
                    }
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'profile',
                      enabled: false,
                      child: Text(
                          '${user?.username ?? "用户"} (${user?.email ?? ""})'),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'ai',
                      child: ListTile(
                          leading: Icon(Icons.smart_toy_outlined),
                          title: Text('AI 对话'),
                          dense: true),
                    ),
                    const PopupMenuItem(
                      value: 'tasks',
                      child: ListTile(
                          leading: Icon(Icons.schedule_outlined),
                          title: Text('定时任务'),
                          dense: true),
                    ),
                    const PopupMenuItem(
                      value: 'kb',
                      child: ListTile(
                          leading: Icon(Icons.menu_book),
                          title: Text('知识库'),
                          dense: true),
                    ),
                    const PopupMenuItem(
                      value: 'mcp',
                      child: ListTile(
                          leading: Icon(Icons.build_outlined),
                          title: Text('MCP 工具'),
                          dense: true),
                    ),
                    if (user?.role == 'admin')
                      const PopupMenuItem(
                        value: 'admin',
                        child: ListTile(
                            leading: Icon(Icons.admin_panel_settings),
                            title: Text('管理后台'),
                            dense: true),
                      ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'logout',
                      child: ListTile(
                          leading: Icon(Icons.logout, color: Colors.red),
                          title: Text('退出登录',
                              style: TextStyle(color: Colors.red)),
                          dense: true),
                    ),
                  ],
                ),
              ],
            )
          : AppBar(
              title: const Text('Mini-Chat'),
              actions: [
                IconButton(
                  icon: const Icon(Icons.smart_toy_outlined),
                  tooltip: 'AI 对话',
                  onPressed: () => context.push('/ai-chat'),
                ),
                IconButton(
                  icon: const Icon(Icons.group_outlined),
                  tooltip: '群组',
                  onPressed: () => context.push('/groups'),
                ),
                IconButton(
                  icon: const Icon(Icons.schedule_outlined),
                  tooltip: '定时任务',
                  onPressed: () => context.push('/scheduled-tasks'),
                ),
                PopupMenuButton<String>(
                  icon: CircleAvatar(
                    radius: 16,
                    backgroundColor: AppTheme.primary.withAlpha(25),
                    child: Text(
                      (user?.username ?? 'U')[0].toUpperCase(),
                      style: const TextStyle(
                          color: AppTheme.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14),
                    ),
                  ),
                  onSelected: (value) {
                    switch (value) {
                      case 'kb':
                        context.push('/knowledge-base');
                        break;
                      case 'mcp':
                        context.push('/mcp-tools');
                        break;
                      case 'admin':
                        context.push('/admin/ai-providers');
                        break;
                      case 'logout':
                        _logout();
                        break;
                    }
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'profile',
                      enabled: false,
                      child: Text(
                          '${user?.username ?? "用户"} (${user?.email ?? ""})'),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'kb',
                      child: ListTile(
                          leading: Icon(Icons.menu_book),
                          title: Text('知识库'),
                          dense: true),
                    ),
                    const PopupMenuItem(
                      value: 'mcp',
                      child: ListTile(
                          leading: Icon(Icons.build_outlined),
                          title: Text('MCP 工具'),
                          dense: true),
                    ),
                    if (user?.role == 'admin')
                      const PopupMenuItem(
                        value: 'admin',
                        child: ListTile(
                            leading: Icon(Icons.admin_panel_settings),
                            title: Text('管理后台'),
                            dense: true),
                      ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'logout',
                      child: ListTile(
                          leading: Icon(Icons.logout, color: Colors.red),
                          title: Text('退出登录',
                              style: TextStyle(color: Colors.red)),
                          dense: true),
                    ),
                  ],
                ),
              ],
            ),
      body: hasChat ? const ChatWindow() : const FriendList(),
    );
  }
}
