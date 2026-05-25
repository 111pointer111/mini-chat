import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../data/models/message.dart';
import '../../providers/group_provider.dart';
import '../../providers/auth_provider.dart';
import '../../shared/utils/toast_utils.dart';
import '../../shared/widgets/ai_message_content.dart';

class GroupChatScreen extends ConsumerStatefulWidget {
  final String groupId;

  const GroupChatScreen({super.key, required this.groupId});

  @override
  ConsumerState<GroupChatScreen> createState() => _GroupChatScreenState();
}

class _GroupChatScreenState extends ConsumerState<GroupChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  bool _isSending = false;
  final List<StreamSubscription> _subscriptions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadMessages();
      _setupSocketListeners();
    });
  }

  @override
  void dispose() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _loadMessages() {
    ref
        .read(groupMessagesProvider(widget.groupId).notifier)
        .refresh(widget.groupId);
  }

  void _setupSocketListeners() {
    final socketService = ref.read(socketServiceProvider);

    // 加入群房间
    socketService.joinGroupRoom(widget.groupId);

    // 监听群消息
    _subscriptions.add(
      socketService.onReceiveGroupMessage.listen((data) {
        final groupId = data['groupId'] as String?;
        if (groupId == widget.groupId) {
          ref
              .read(groupMessagesProvider(widget.groupId).notifier)
              .addMessage(data);
          _scrollToBottom();
        }
      }),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamStart.listen((data) {
        final groupId = data['groupId'] as String?;
        final message = data['message'];
        if (groupId == widget.groupId && message is Map<String, dynamic>) {
          ref
              .read(groupMessagesProvider(widget.groupId).notifier)
              .addMessage(message);
          _scrollToBottom();
        }
      }),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamChunk.listen((data) {
        final groupId = data['groupId'] as String?;
        final tempMessageId = data['tempMessageId'] as String?;
        final content = data['content'] as String? ?? '';
        if (groupId == widget.groupId && tempMessageId != null) {
          ref
              .read(groupMessagesProvider(widget.groupId).notifier)
              .appendMessageContent(tempMessageId, content);
          _scrollToBottom();
        }
      }),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamDone.listen((data) {
        _replaceStreamMessage(data);
      }),
    );

    _subscriptions.add(
      socketService.onGroupAiStreamError.listen((data) {
        _replaceStreamMessage(data);
      }),
    );
  }

  void _replaceStreamMessage(Map<String, dynamic> data) {
    final groupId = data['groupId'] as String?;
    final tempMessageId = data['tempMessageId'] as String?;
    final message = data['message'];
    if (groupId == widget.groupId &&
        tempMessageId != null &&
        message is Map<String, dynamic>) {
      ref
          .read(groupMessagesProvider(widget.groupId).notifier)
          .replaceMessage(tempMessageId, message);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty || _isSending) return;

    setState(() => _isSending = true);
    _messageController.clear();

    final socketService = ref.read(socketServiceProvider);

    if (!socketService.isConnected) {
      if (mounted) {
        showErrorToast(context, '网络连接已断开，请稍后重试');
      }
      setState(() => _isSending = false);
      return;
    }

    // Optimistic UI: 先插入临时消息
    final user = ref.read(authStateProvider).valueOrNull;
    final tempId = 'temp-${DateTime.now().millisecondsSinceEpoch}';
    final tempMessage = {
      '_id': tempId,
      'sender':
          user != null ? {'_id': user.id, 'username': user.username} : tempId,
      'groupId': widget.groupId,
      'content': content,
      'type': 'text',
      'createdAt': DateTime.now().toIso8601String(),
    };

    ref
        .read(groupMessagesProvider(widget.groupId).notifier)
        .addMessage(tempMessage);
    _scrollToBottom();

    // 发送消息
    socketService.emitWithAck('send_group_message', {
      'groupId': widget.groupId,
      'content': content,
      'type': 'text',
    }, ack: (response) {
      if (response is Map<String, dynamic> && response['success'] == true) {
        final serverMessage = response['message'];
        if (serverMessage is Map<String, dynamic>) {
          ref
              .read(groupMessagesProvider(widget.groupId).notifier)
              .replaceMessage(tempId, serverMessage);
        }
      } else {
        if (mounted) {
          showErrorToast(context, response['error'] as String? ?? '发送失败');
        }
      }
      if (mounted) setState(() => _isSending = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(groupMessagesProvider(widget.groupId));
    final currentUser = ref.watch(authStateProvider).valueOrNull;

    // 获取群组信息
    final groupsAsync = ref.watch(groupsProvider);
    final group = groupsAsync.valueOrNull
        ?.where((g) => g.id == widget.groupId)
        .firstOrNull;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        context.go('/');
      },
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                group?.name ?? '群聊',
                style: const TextStyle(fontSize: 16),
              ),
              if (group?.assistantEnabled == true)
                const Text(
                  '输入 @小助手 可提问',
                  style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                ),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.library_books_outlined),
              tooltip: '群知识库',
              onPressed: () =>
                  context.push('/groups/${widget.groupId}/knowledge-base'),
            ),
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              tooltip: '群设置',
              onPressed: () =>
                  context.push('/groups/${widget.groupId}/settings'),
            ),
          ],
        ),
        body: Column(
          children: [
            // 消息列表
            Expanded(
              child: messagesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline,
                          size: 48, color: Colors.red[300]),
                      const SizedBox(height: 12),
                      Text('加载消息失败', style: TextStyle(color: Colors.grey[600])),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _loadMessages,
                        icon: const Icon(Icons.refresh),
                        label: const Text('重试'),
                      ),
                    ],
                  ),
                ),
                data: (messages) {
                  if (messages.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.chat_bubble_outline,
                              size: 64, color: Colors.grey[300]),
                          const SizedBox(height: 16),
                          Text('暂无消息',
                              style: TextStyle(
                                  fontSize: 16, color: Colors.grey[500])),
                          const SizedBox(height: 8),
                          Text('发送第一条消息开始群聊',
                              style: TextStyle(
                                  fontSize: 13, color: Colors.grey[400])),
                        ],
                      ),
                    );
                  }
                  return ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    itemCount: messages.length,
                    itemBuilder: (context, index) =>
                        _buildMessageBubble(messages[index], currentUser),
                  );
                },
              ),
            ),
            // 输入栏
            _buildInputBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(Message message, dynamic currentUser) {
    final senderId = message.senderId;
    final senderName = message.senderUser?.username ?? '成员';
    final isMe = senderId == currentUser?.id;
    final isAssistant = senderId == AppConstants.aiAssistantId;
    final content = message.content;
    final createdAt = message.createdAt;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isMe) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: isAssistant
                  ? Colors.indigo.shade50
                  : AppTheme.primary.withAlpha(25),
              child: isAssistant
                  ? Icon(Icons.smart_toy,
                      size: 16, color: Colors.indigo.shade400)
                  : Text(
                      senderName.isNotEmpty ? senderName[0].toUpperCase() : '?',
                      style: const TextStyle(
                          fontSize: 12, color: AppTheme.primary),
                    ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isMe)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      isAssistant ? '群聊小助手' : senderName,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isAssistant
                            ? Colors.indigo.shade600
                            : AppTheme.textSecondary,
                      ),
                    ),
                  ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.75,
                  ),
                  decoration: BoxDecoration(
                    color: isMe
                        ? AppTheme.primary
                        : isAssistant
                            ? Colors.indigo.shade50
                            : (AppThemeHelper.isDark(context)
                                ? AppColors.surfaceDark
                                : Colors.white),
                    borderRadius: BorderRadius.circular(16).copyWith(
                      bottomRight: isMe ? const Radius.circular(4) : null,
                      bottomLeft: !isMe ? const Radius.circular(4) : null,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(10),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: isAssistant
                      ? AIMessageContent(
                          content: content,
                          textColor: Colors.indigo.shade900,
                          accentColor: Colors.indigo.shade600,
                        )
                      : Text(
                          content,
                          style: TextStyle(
                            color: isMe ? Colors.white : AppTheme.textPrimary,
                            fontSize: 14,
                          ),
                        ),
                ),
                if (createdAt.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      DateFormat('HH:mm')
                          .format(DateTime.parse(createdAt).toLocal()),
                      style: const TextStyle(
                          fontSize: 10, color: AppTheme.textSecondary),
                    ),
                  ),
              ],
            ),
          ),
          if (isMe) ...[
            const SizedBox(width: 8),
            CircleAvatar(
              radius: 16,
              backgroundColor: AppTheme.primary.withAlpha(25),
              child: Text(
                currentUser?.username.isNotEmpty == true
                    ? currentUser!.username[0].toUpperCase()
                    : '?',
                style: const TextStyle(fontSize: 12, color: AppTheme.primary),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(200),
          border:
              Border(top: BorderSide(color: Colors.grey.shade200, width: 0.5)),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                enabled: !_isSending,
                maxLines: 4,
                minLines: 1,
                decoration: InputDecoration(
                  hintText: '输入消息，@小助手 可提问...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade100,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
            const SizedBox(width: 8),
            CircleAvatar(
              backgroundColor: _isSending ? Colors.grey : AppTheme.primary,
              child: IconButton(
                icon: _isSending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send, color: Colors.white, size: 20),
                onPressed: _isSending ? null : _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
