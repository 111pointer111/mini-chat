import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/chat_provider.dart';
import '../../../data/models/message.dart';
import '../../../shared/utils/time_utils.dart';

class ChatWindow extends ConsumerStatefulWidget {
  const ChatWindow({super.key});

  @override
  ConsumerState<ChatWindow> createState() => _ChatWindowState();
}

class _ChatWindowState extends ConsumerState<ChatWindow> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
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

  void _sendMessage() {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    final selection = ref.read(chatSelectionProvider);
    final socketService = ref.read(socketServiceProvider);
    final currentUser = ref.read(authStateProvider).valueOrNull;

    if (selection.type == ChatType.friend && selection.id != null) {
      // Optimistic UI
      final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
      final tempMessage = Message(
        id: tempId,
        sender: currentUser?.id ?? '',
        receiver: selection.id,
        content: content,
        type: 'text',
        createdAt: DateTime.now().toIso8601String(),
      );
      ref.read(messagesProvider.notifier).addMessage(tempMessage);

      socketService.emit('send_message', {
        'receiverId': selection.id,
        'content': content,
        'type': 'text',
      }, (ack) {
        if (ack != null && ack is Map<String, dynamic>) {
          // Replace temp message with server ack
          final serverMessage = Message.fromJson(ack);
          ref.read(messagesProvider.notifier).replaceTempMessage(tempId, serverMessage);
        }
      });
    } else if (selection.type == ChatType.group && selection.id != null) {
      final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
      final tempMessage = Message(
        id: tempId,
        sender: currentUser?.id ?? '',
        groupId: selection.id,
        content: content,
        type: 'text',
        createdAt: DateTime.now().toIso8601String(),
      );
      ref.read(messagesProvider.notifier).addMessage(tempMessage);

      socketService.emit('send_group_message', {
        'groupId': selection.id,
        'content': content,
        'type': 'text',
      }, (ack) {
        if (ack != null && ack is Map<String, dynamic>) {
          final serverMessage = Message.fromJson(ack);
          ref.read(messagesProvider.notifier).replaceTempMessage(tempId, serverMessage);
        }
      });
    }

    _messageController.clear();
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final selection = ref.watch(chatSelectionProvider);
    final messagesAsync = ref.watch(messagesProvider);

    if (selection.type == ChatType.none) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline, size: 64, color: AppTheme.textSecondary),
            SizedBox(height: 16),
            Text('选择一个聊天开始对话',
                style: TextStyle(fontSize: 16, color: AppTheme.textSecondary)),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Chat header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(200),
            border: Border(
                bottom: BorderSide(color: Colors.grey.shade200, width: 0.5)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: AppTheme.primary.withAlpha(25),
                child: Text(
                  (selection.name ?? '?')[0].toUpperCase(),
                  style: const TextStyle(
                      color: AppTheme.primary, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 12),
              Text(selection.name ?? '',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600)),
            ],
          ),
        ),

        // Messages
        Expanded(
          child: messagesAsync.when(
            data: (messages) {
              if (messages.isEmpty) {
                return const Center(child: Text('暂无消息'));
              }
              _scrollToBottom();
              return ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(16),
                itemCount: messages.length,
                itemBuilder: (context, index) =>
                    _buildMessageBubble(messages[index]),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, stack) {
              print('Messages error: $e');
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                    const SizedBox(height: 8),
                    Text('加载失败', style: TextStyle(color: Colors.grey[600])),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () {
                        final selection = ref.read(chatSelectionProvider);
                        if (selection.type == ChatType.friend && selection.id != null) {
                          ref.read(messagesProvider.notifier).fetchFriendMessages(selection.id!);
                        }
                      },
                      child: const Text('重试'),
                    ),
                  ],
                ),
              );
            },
          ),
        ),

        // Input area
        if (selection.type != ChatType.task)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(200),
              border: Border(
                  top: BorderSide(color: Colors.grey.shade200, width: 0.5)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: InputDecoration(
                      hintText: '输入消息...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      fillColor: Colors.grey.shade100,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 10),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                CircleAvatar(
                  backgroundColor: AppTheme.primary,
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white, size: 20),
                    onPressed: _sendMessage,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildMessageBubble(Message message) {
    final currentUser = ref.watch(authStateProvider).valueOrNull;
    final isMe = message.senderId == currentUser?.id;
    final isSystem = message.type == 'system';

    if (isSystem) {
      return Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          margin: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(message.content,
              style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
        ),
      );
    }

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.6,
        ),
        decoration: BoxDecoration(
          color: isMe ? AppTheme.primary : Colors.white,
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
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isMe && message.senderUser != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  message.senderUser!.username,
                  style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.w600),
                ),
              ),
            Text(
              message.content,
              style: TextStyle(
                color: isMe ? Colors.white : AppTheme.textPrimary,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              formatMessageTime(message.createdAt),
              style: TextStyle(
                fontSize: 10,
                color: isMe ? Colors.white70 : AppTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
