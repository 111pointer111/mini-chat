import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/chat_provider.dart';
import '../../../data/models/message.dart';
import '../../../shared/utils/time_utils.dart';
import '../../../shared/widgets/ai_message_content.dart';

class ChatWindow extends ConsumerStatefulWidget {
  const ChatWindow({super.key});

  @override
  ConsumerState<ChatWindow> createState() => _ChatWindowState();
}

class _ChatWindowState extends ConsumerState<ChatWindow> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  int _previousMessageCount = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels <= 50) {
      ref.read(messagesProvider.notifier).loadMore();
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

  void _sendMessage() {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    final selection = ref.read(chatSelectionProvider);
    final socketService = ref.read(socketServiceProvider);
    final currentUser = ref.read(authStateProvider).valueOrNull;

    if (selection.type == ChatType.friend && selection.id != null) {
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

      socketService.emitWithAck('send_message', {
        'receiverId': selection.id,
        'content': content,
        'type': 'text',
      }, ack: (ack) {
        if (ack != null &&
            ack is Map<String, dynamic> &&
            ack['success'] == true) {
          final serverMessage = ack['message'];
          if (serverMessage is Map<String, dynamic>) {
            ref
                .read(messagesProvider.notifier)
                .replaceTempMessage(tempId, Message.fromJson(serverMessage));
          } else {
            final realId = ack['messageId'] as String? ?? tempId;
            ref.read(messagesProvider.notifier).updateMessageId(tempId, realId);
          }
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

      socketService.emitWithAck('send_group_message', {
        'groupId': selection.id,
        'content': content,
        'type': 'text',
      }, ack: (ack) {
        if (ack != null &&
            ack is Map<String, dynamic> &&
            ack['success'] == true) {
          final realId = ack['messageId'] as String? ?? tempId;
          ref.read(messagesProvider.notifier).updateMessageId(tempId, realId);
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
    final messagesNotifier = ref.read(messagesProvider.notifier);

    if (selection.type == ChatType.none) {
      return _buildEmptyChat();
    }

    return Column(
      children: [
        _buildChatHeader(selection),
        Expanded(child: _buildMessagesList(messagesAsync, messagesNotifier)),
        if (selection.type != ChatType.task) _buildInputArea(),
      ],
    );
  }

  Widget _buildEmptyChat() {
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
              Icons.chat_bubble_outline,
              size: 56,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            '选择一个聊天开始对话',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '从左侧好友列表中选择',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.textSecondaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatHeader(ChatSelection selection) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppThemeHelper.isDark(context)
            ? AppColors.surfaceDark
            : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(5),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.accent],
              ),
              borderRadius: AppRadius.smAll,
            ),
            child: CircleAvatar(
              radius: 18,
              backgroundColor: AppThemeHelper.isDark(context)
                  ? AppColors.surfaceDark
                  : Colors.white,
              child: Text(
                (selection.name ?? '?')[0].toUpperCase(),
                style: GoogleFonts.inter(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              selection.name ?? '',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppThemeHelper.textPrimary(context),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessagesList(AsyncValue<List<Message>> messagesAsync,
      MessagesNotifier messagesNotifier) {
    return messagesAsync.when(
      data: (messages) {
        if (messages.isEmpty) {
          return _buildEmptyMessages();
        }

        if (messages.length > _previousMessageCount) {
          _scrollToBottom();
        }
        _previousMessageCount = messages.length;

        return ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.all(16),
          itemCount: messages.length +
              (messagesNotifier.hasMore || messagesNotifier.loadError != null
                  ? 1
                  : 0),
          itemBuilder: (context, index) {
            if (index == 0 &&
                (messagesNotifier.hasMore ||
                    messagesNotifier.loadError != null)) {
              if (messagesNotifier.isLoadingMore) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                );
              }
              if (messagesNotifier.loadError != null) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Center(
                    child: TextButton.icon(
                      onPressed: () =>
                          ref.read(messagesProvider.notifier).loadMore(),
                      icon: const Icon(Icons.refresh, size: 16),
                      label: Text(
                        messagesNotifier.loadError!,
                        style: GoogleFonts.inter(
                            fontSize: 12, color: AppColors.textSecondaryLight),
                      ),
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            }
            final msgIndex = messagesNotifier.hasMore ? index - 1 : index;
            return _buildMessageBubble(messages[msgIndex]);
          },
        );
      },
      loading: () => const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
      error: (e, stack) => _buildErrorState(),
    );
  }

  Widget _buildEmptyMessages() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(13),
              borderRadius: AppRadius.xlAll,
            ),
            child: const Icon(
              Icons.waving_hand_outlined,
              size: 40,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            '暂无消息',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '发送第一条消息开始对话',
            style: GoogleFonts.inter(
              fontSize: 13,
              color: AppColors.textSecondaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppColors.error),
          const SizedBox(height: 8),
          Text(
            '加载失败',
            style: GoogleFonts.inter(color: AppColors.textSecondaryLight),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () {
              final sel = ref.read(chatSelectionProvider);
              if (sel.type == ChatType.friend && sel.id != null) {
                ref
                    .read(messagesProvider.notifier)
                    .fetchFriendMessages(sel.id!);
              } else if (sel.type == ChatType.group && sel.id != null) {
                ref.read(messagesProvider.notifier).fetchGroupMessages(sel.id!);
              }
            },
            child: Text(
              '重试',
              style: GoogleFonts.inter(color: AppColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppThemeHelper.isDark(context)
            ? AppColors.surfaceDark
            : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(5),
            blurRadius: 4,
            offset: const Offset(0, -1),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: AppThemeHelper.isDark(context)
                      ? AppColors.surfaceDark.withAlpha(153)
                      : AppColors.backgroundLight,
                  borderRadius: AppRadius.xlAll,
                ),
                child: TextField(
                  controller: _messageController,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppThemeHelper.textPrimary(context),
                  ),
                  decoration: InputDecoration(
                    hintText: '输入消息...',
                    hintStyle: GoogleFonts.inter(
                      color: AppThemeHelper.textSecondary(context),
                      fontSize: 14,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: AppRadius.xlAll,
                      borderSide: BorderSide.none,
                    ),
                    filled: true,
                    fillColor: AppThemeHelper.isDark(context)
                        ? AppColors.surfaceDark.withAlpha(153)
                        : AppColors.backgroundLight,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 10,
                    ),
                  ),
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Container(
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
              child: IconButton(
                icon: const Icon(Icons.send_rounded,
                    color: Colors.white, size: 20),
                onPressed: _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(Message message) {
    final currentUser = ref.read(authStateProvider).valueOrNull;
    final selection = ref.read(chatSelectionProvider);
    final isMe = message.senderId == currentUser?.id;
    final isSystem = message.type == 'system';
    final isAIMessage =
        message.isAiAssistant || selection.type == ChatType.task;

    if (isSystem && !isAIMessage) {
      return Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          margin: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.textSecondaryLight.withAlpha(20),
            borderRadius: AppRadius.mdAll,
          ),
          child: Text(
            message.content,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: AppColors.textSecondaryLight,
            ),
          ),
        ),
      );
    }

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width *
              (selection.type == ChatType.task ? 0.9 : 0.7),
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isMe && message.senderUser != null)
              Padding(
                padding: const EdgeInsets.only(left: 12, bottom: 4),
                child: Text(
                  message.senderUser!.username,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppColors.textSecondaryLight,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                gradient: isMe
                    ? const LinearGradient(
                        colors: [AppColors.primary, AppColors.accent],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: isMe
                    ? null
                    : (AppThemeHelper.isDark(context)
                        ? AppColors.surfaceDark
                        : Colors.white),
                borderRadius: BorderRadius.circular(16).copyWith(
                  bottomRight: isMe ? const Radius.circular(4) : null,
                  bottomLeft: !isMe ? const Radius.circular(4) : null,
                ),
                boxShadow: [
                  BoxShadow(
                    color: isMe
                        ? AppColors.primary.withAlpha(51)
                        : Colors.black.withAlpha(10),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment:
                    isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  if (isAIMessage)
                    AIMessageContent(
                      content: message.content,
                      textColor: AppThemeHelper.textPrimary(context),
                      accentColor: AppColors.primary,
                    )
                  else
                    SelectableText(
                      message.content,
                      style: GoogleFonts.inter(
                        color: isMe
                            ? Colors.white
                            : AppThemeHelper.textPrimary(context),
                        fontSize: 14,
                      ),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    formatMessageTime(message.createdAt),
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: isMe
                          ? Colors.white70
                          : AppThemeHelper.textSecondary(context),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
