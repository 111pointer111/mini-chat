import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../data/models/user.dart';
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
        if (!_isCurrentGroupPayload(data)) return;
        final message = Message.fromJson(data);
        ref.read(messagesProvider.notifier).addMessage(message);
      }),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamStart.listen((data) {
        if (!_isCurrentGroupPayload(data)) return;
        final message = data['message'];
        if (message is Map<String, dynamic>) {
          ref
              .read(messagesProvider.notifier)
              .addMessage(Message.fromJson(message));
        }
      }),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamChunk.listen((data) {
        if (!_isCurrentGroupPayload(data)) return;
        final tempMessageId = data['tempMessageId'] as String?;
        final content = data['content'] as String? ?? '';
        if (tempMessageId != null) {
          ref
              .read(messagesProvider.notifier)
              .appendMessageContent(tempMessageId, content);
        }
      }),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamDone.listen(_replaceGroupAiStreamMessage),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamError.listen(_replaceGroupAiStreamMessage),
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

  void _replaceGroupAiStreamMessage(Map<String, dynamic> data) {
    if (!_isCurrentGroupPayload(data)) return;
    final tempMessageId = data['tempMessageId'] as String?;
    final message = data['message'];
    if (tempMessageId != null && message is Map<String, dynamic>) {
      ref
          .read(messagesProvider.notifier)
          .replaceTempMessage(tempMessageId, Message.fromJson(message));
    }
  }

  bool _isCurrentGroupPayload(Map<String, dynamic> data) {
    final selection = ref.read(chatSelectionProvider);
    return selection.type == ChatType.group && data['groupId'] == selection.id;
  }

  void _logout() {
    ref.read(authStateProvider.notifier).logout();
    context.go('/login');
  }

  Future<void> _checkForUpdate() async {
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

  PreferredSizeWidget _buildMainAppBar(User? user) {
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

  PreferredSizeWidget _buildChatAppBar(User? user, ChatSelection selection) {
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

  Widget _buildUserMenu(User? user) {
    final avatarImage = _avatarImage(user?.avatar);

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
          backgroundImage: avatarImage,
          child: avatarImage == null
              ? Text(
                  _avatarInitial(user),
                  style: GoogleFonts.inter(
                    color: AppColors.primary,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                )
              : null,
        ),
      ),
      onSelected: (value) {
        switch (value) {
          case 'profile':
            context.push('/settings/profile');
            break;
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
                child: avatarImage == null
                    ? const Icon(Icons.person, color: Colors.white, size: 20)
                    : CircleAvatar(
                        radius: 10,
                        backgroundImage: avatarImage,
                        backgroundColor: Colors.white,
                      ),
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
              const Icon(Icons.chevron_right, size: 18),
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

  ImageProvider? _avatarImage(String? avatar) {
    final url = AppConstants.resolveFileUrl(avatar ?? '');
    if (url.isEmpty) return null;
    return NetworkImage(url);
  }

  String _avatarInitial(User? user) {
    final username = user?.username.trim() ?? '';
    if (username.isEmpty) return 'U';
    return username.substring(0, 1).toUpperCase();
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
