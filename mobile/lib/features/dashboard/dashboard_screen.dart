import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/chat_provider.dart';
import '../../data/models/message.dart';
import 'widgets/app_update_prompt.dart';
import 'widgets/friend_list.dart';
import 'widgets/chat_window.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  final List<StreamSubscription> _subscriptions = [];
  bool _didCheckForUpdate = false;

  @override
  void initState() {
    super.initState();
    _setupSocketListeners();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_checkForUpdate());
    });
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
              backgroundColor: AppColors.success,
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

  Future<void> _checkForUpdate() async {
    if (_didCheckForUpdate) return;
    _didCheckForUpdate = true;
    await AppUpdatePrompt.check(context, ref);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).valueOrNull;
    final selection = ref.watch(chatSelectionProvider);
    final hasChat = selection.type != ChatType.none;

    return PopScope(
      canPop: !hasChat,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        ref.read(chatSelectionProvider.notifier).state = const ChatSelection();
      },
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: hasChat
            ? _buildChatAppBar(user, selection)
            : _buildMainAppBar(user),
        body: hasChat ? const ChatWindow() : const FriendList(),
      ),
    );
  }

  PreferredSizeWidget _buildMainAppBar(dynamic user) {
    return AppBar(
      title: Text(
        'Mini-Chat',
        style: GoogleFonts.poppins(
          fontWeight: FontWeight.w700,
          fontSize: 22,
        ),
      ),
      actions: [
        _buildAppBarIcon(
          icon: Icons.smart_toy_outlined,
          tooltip: 'AI 对话',
          onPressed: () => context.push('/ai-chat'),
        ),
        _buildAppBarIcon(
          icon: Icons.group_add,
          tooltip: '创建群组',
          onPressed: () => context.push('/groups/create'),
        ),
        _buildAppBarIcon(
          icon: Icons.schedule_outlined,
          tooltip: '定时任务',
          onPressed: () => context.push('/scheduled-tasks'),
        ),
        const SizedBox(width: 4),
        _buildUserMenu(user),
        const SizedBox(width: 8),
      ],
    );
  }

  PreferredSizeWidget _buildChatAppBar(dynamic user, ChatSelection selection) {
    return AppBar(
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, size: 20),
        onPressed: () {
          ref.read(chatSelectionProvider.notifier).state =
              const ChatSelection();
        },
      ),
      title: Text(
        selection.name ?? '',
        style: GoogleFonts.inter(fontWeight: FontWeight.w600),
      ),
      actions: [
        _buildUserMenu(user),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildAppBarIcon({
    required IconData icon,
    required String tooltip,
    required VoidCallback onPressed,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        color: AppColors.primary.withAlpha(13),
        borderRadius: AppRadius.smAll,
      ),
      child: IconButton(
        icon: Icon(icon, size: 22),
        tooltip: tooltip,
        onPressed: onPressed,
        color: AppColors.primary,
      ),
    );
  }

  Widget _buildUserMenu(dynamic user) {
    return PopupMenuButton<String>(
      offset: const Offset(0, 48),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
      ),
      icon: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.primary, AppColors.accent],
          ),
          borderRadius: AppRadius.fullAll,
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withAlpha(77),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: CircleAvatar(
          radius: 16,
          backgroundColor: Colors.white,
          child: Text(
            (user?.username ?? 'U')[0].toUpperCase(),
            style: GoogleFonts.inter(
              color: AppColors.primary,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
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
          case 'groups':
            context.push('/groups');
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
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.accent],
                  ),
                  borderRadius: AppRadius.smAll,
                ),
                child: const Icon(Icons.person, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user?.username ?? '用户',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      user?.email ?? '',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const PopupMenuDivider(),
        _buildMenuItem(
          value: 'ai',
          icon: Icons.smart_toy_outlined,
          title: 'AI 对话',
        ),
        _buildMenuItem(
          value: 'groups',
          icon: Icons.group_outlined,
          title: '群组',
        ),
        _buildMenuItem(
          value: 'tasks',
          icon: Icons.schedule_outlined,
          title: '定时任务',
        ),
        _buildMenuItem(
          value: 'kb',
          icon: Icons.menu_book,
          title: '知识库',
        ),
        _buildMenuItem(
          value: 'mcp',
          icon: Icons.build_outlined,
          title: 'MCP 工具',
        ),
        if (user?.role == 'admin')
          _buildMenuItem(
            value: 'admin',
            icon: Icons.admin_panel_settings,
            title: '管理后台',
          ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: 'logout',
          child: ListTile(
            leading: const Icon(Icons.logout, color: AppColors.error, size: 22),
            title: Text(
              '退出登录',
              style: GoogleFonts.inter(
                color: AppColors.error,
                fontWeight: FontWeight.w500,
              ),
            ),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      ],
    );
  }

  PopupMenuItem<String> _buildMenuItem({
    required String value,
    required IconData icon,
    required String title,
  }) {
    return PopupMenuItem(
      value: value,
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary, size: 22),
        title: Text(
          title,
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w500,
            fontSize: 14,
          ),
        ),
        dense: true,
        contentPadding: EdgeInsets.zero,
      ),
    );
  }
}
