import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';

import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../data/models/conversation.dart';
import '../../providers/ai_chat_provider.dart';
import '../../providers/auth_provider.dart';
import '../../shared/utils/ai_message_parser.dart';
import '../../shared/widgets/ai_provider_selector.dart';
import '../../shared/widgets/ai_message_content.dart';
import '../../shared/utils/error_utils.dart';
import '../../shared/utils/toast_utils.dart';

class AIChatScreen extends ConsumerStatefulWidget {
  const AIChatScreen({super.key});

  @override
  ConsumerState<AIChatScreen> createState() => _AIChatScreenState();
}

class _AIChatScreenState extends ConsumerState<AIChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _renameController = TextEditingController();
  final _picker = ImagePicker();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  List<XFile> _pendingImages = [];
  bool _isUploading = false;
  final List<StreamSubscription> _subscriptions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
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
    _renameController.dispose();
    super.dispose();
  }

  void _loadConversations() {
    ref.read(conversationsProvider.notifier).refresh();
  }

  void _setupSocketListeners() {
    final socketService = ref.read(socketServiceProvider);

    _subscriptions.add(
      socketService.onAIStream.listen((data) {
        final content = data['content'] as String? ?? '';
        final done = data['done'] as bool? ?? false;

        if (content.isNotEmpty) {
          ref.read(aiMessagesProvider.notifier).appendToLastMessage(content);
        }
        if (done) {
          ref.read(aiMessagesProvider.notifier).markStreamDone();
          ref.read(isStreamingProvider.notifier).state = false;
          _loadConversations();
        }
        _scrollToBottom();
      }),
    );

    _subscriptions.add(
      socketService.onAIStreamError.listen((data) {
        String errorMsg = 'AI 响应出错';
        if (data is Map<String, dynamic>) {
          errorMsg = data['error'] as String? ??
              data['message'] as String? ??
              errorMsg;
        } else if (data is String) {
          errorMsg = data;
        }
        ref
            .read(aiMessagesProvider.notifier)
            .appendToLastMessage('\n\n❌ $errorMsg');
        ref.read(aiMessagesProvider.notifier).markStreamDone();
        ref.read(isStreamingProvider.notifier).state = false;
        _scrollToBottom();
      }),
    );

    _subscriptions.add(
      socketService.onConversationRenamed.listen((data) {
        ref.read(conversationsProvider.notifier).refresh();
      }),
    );
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

  Future<void> _pickImages() async {
    final images = await _picker.pickMultiImage(imageQuality: 80);
    if (images.isNotEmpty) {
      setState(() {
        _pendingImages = images;
      });
    }
  }

  void _removePendingImage(int index) {
    setState(() {
      _pendingImages.removeAt(index);
    });
  }

  Future<List<String>> _uploadImages() async {
    if (_pendingImages.isEmpty) return [];
    setState(() => _isUploading = true);
    try {
      final uploadApi = ref.read(uploadApiProvider);
      final files = _pendingImages
          .map((x) => MultipartFile.fromFileSync(x.path, filename: x.name))
          .toList();
      final res = await uploadApi.uploadImages(files);
      final urls =
          (res.data['urls'] as List<dynamic>).map((e) => e as String).toList();
      return urls;
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, fallback: '图片上传失败'));
      }
      return [];
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty && _pendingImages.isEmpty) return;
    if (ref.read(isStreamingProvider)) return;

    final imageUrls = await _uploadImages();

    ref.read(aiMessagesProvider.notifier).addUserMessage(
          content,
          images: imageUrls.isNotEmpty ? imageUrls : null,
        );

    _messageController.clear();
    setState(() => _pendingImages = []);
    _scrollToBottom();

    ref.read(aiMessagesProvider.notifier).startAssistantMessage();
    ref.read(isStreamingProvider.notifier).state = true;
    _scrollToBottom();

    final socketService = ref.read(socketServiceProvider);
    final conversationId = ref.read(currentConversationIdProvider);
    final now = DateTime.now();
    final timezoneOffset = now.timeZoneOffset.inMinutes;

    // 检查 Socket 连接状态
    if (socketService.isConnected) {
      // Socket 连接正常 → 使用 Socket 流式传输
      socketService.emitAIChatStream({
        'message': content,
        if (imageUrls.isNotEmpty) 'images': imageUrls,
        'timezone': timezoneOffset,
        if (conversationId != null) 'conversationId': conversationId,
      });
    } else {
      // Socket 断开 → fallback 到 REST API
      try {
        final api = ref.read(aiChatApiProvider);
        final res = await api.sendMessage(
          content,
          images: imageUrls.isNotEmpty ? imageUrls : null,
          conversationId: conversationId,
        );

        final data = res.data;
        if (data != null) {
          final reply = data['reply'] as String? ?? '';
          final newConversationId = data['conversationId'] as String?;

          final parsedReply = parseAIMessageContent(reply);

          // 更新消息
          final messages = ref.read(aiMessagesProvider);
          if (messages.isNotEmpty) {
            final lastMessage = messages.last;
            ref.read(aiMessagesProvider.notifier).setMessages(
                  messages.sublist(0, messages.length - 1)
                    ..add(
                      AIChatMessage(
                        id: lastMessage.id,
                        role: 'assistant',
                        content: parsedReply.content,
                        thinking: parsedReply.thinking,
                        createdAt: DateTime.now().toIso8601String(),
                      ),
                    ),
                );
          }

          // 更新会话 ID
          if (newConversationId != null && conversationId == null) {
            ref.read(currentConversationIdProvider.notifier).state =
                newConversationId;
          }

          _loadConversations();
        }
      } catch (e) {
        // REST API 也失败了，显示错误
        final messages = ref.read(aiMessagesProvider);
        if (messages.isNotEmpty) {
          final lastMessage = messages.last;
          ref.read(aiMessagesProvider.notifier).setMessages(
                messages.sublist(0, messages.length - 1)
                  ..add(
                    AIChatMessage(
                      id: lastMessage.id,
                      role: 'assistant',
                      content: '❌ 发送失败，请检查网络连接后重试',
                      createdAt: DateTime.now().toIso8601String(),
                    ),
                  ),
              );
        }
      } finally {
        ref.read(isStreamingProvider.notifier).state = false;
        _scrollToBottom();
      }
    }
  }

  Future<void> _selectConversation(String convId) async {
    final currentId = ref.read(currentConversationIdProvider);
    if (currentId == convId) {
      Navigator.pop(context);
      return;
    }

    ref.read(currentConversationIdProvider.notifier).state = convId;
    ref.read(aiMessagesProvider.notifier).clear();
    Navigator.pop(context);

    try {
      final api = ref.read(aiChatApiProvider);
      final res = await api.getHistory(convId: convId);
      final data = res.data;
      final messagesList = data is Map<String, dynamic>
          ? (data['messages'] as List<dynamic>? ?? [])
          : (data as List<dynamic>);
      final messages = messagesList
          .map((e) => AIChatMessage.fromBackend(e as Map<String, dynamic>))
          .toList();
      ref.read(aiMessagesProvider.notifier).setMessages(messages);
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, fallback: '加载历史消息失败'));
      }
    }
  }

  Future<void> _createConversation() async {
    try {
      final conv = await ref.read(conversationsProvider.notifier).create();
      _selectConversation(conv.id);
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, fallback: '创建会话失败'));
      }
    }
  }

  Future<void> _deleteConversation(String convId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除会话'),
        content: const Text('确定要删除这个会话吗？删除后无法恢复。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(conversationsProvider.notifier).delete(convId);
      final currentId = ref.read(currentConversationIdProvider);
      if (currentId == convId) {
        ref.read(currentConversationIdProvider.notifier).state = null;
        ref.read(aiMessagesProvider.notifier).clear();
      }
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, fallback: '删除会话失败'));
      }
    }
  }

  void _showRenameDialog(String convId, String currentName) {
    _renameController.text = currentName;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('重命名会话'),
        content: TextField(
          controller: _renameController,
          autofocus: true,
          decoration: const InputDecoration(hintText: '输入新名称'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              final name = _renameController.text.trim();
              if (name.isNotEmpty) {
                ref.read(conversationsProvider.notifier).rename(convId, name);
              }
              Navigator.pop(ctx);
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final conversationsAsync = ref.watch(conversationsProvider);
    final currentConvId = ref.watch(currentConversationIdProvider);
    final messages = ref.watch(aiMessagesProvider);
    final isStreaming = ref.watch(isStreamingProvider);

    final currentConvName = conversationsAsync.valueOrNull
        ?.where((c) => c.id == currentConvId)
        .firstOrNull
        ?.name;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        context.go('/');
      },
      child: Scaffold(
        key: _scaffoldKey,
        drawer: Drawer(
          child: _buildConversationDrawer(conversationsAsync, currentConvId),
        ),
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => _scaffoldKey.currentState?.openDrawer(),
          ),
          title: GestureDetector(
            onTap: () => _scaffoldKey.currentState?.openDrawer(),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    currentConvName?.isNotEmpty == true
                        ? currentConvName!
                        : (currentConvId != null ? '对话中' : 'AI 智能助手'),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down, size: 20),
              ],
            ),
          ),
          actions: [
            const AIProviderSelector(),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.add_comment_outlined),
              tooltip: '新对话',
              onPressed: _createConversation,
            ),
          ],
        ),
        body: Column(
          children: [
            if (currentConvId == null && messages.isEmpty)
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(28),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.primary, AppColors.accent],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withAlpha(77),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.auto_awesome,
                              size: 48, color: Colors.white),
                        ),
                        const SizedBox(height: 28),
                        Text(
                          'AI 智能助手',
                          style: GoogleFonts.poppins(
                              fontSize: 24, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          '发送消息开始对话，支持图片和 Markdown',
                          style: GoogleFonts.inter(
                              fontSize: 15,
                              color: AppColors.textSecondaryLight),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 36),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          alignment: WrapAlignment.center,
                          children: [
                            _buildSuggestionChip('帮我写一段代码'),
                            _buildSuggestionChip('解释一下量子力学'),
                            _buildSuggestionChip('推荐几本好书'),
                            _buildSuggestionChip('今天的新闻'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  controller: _scrollController,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  itemCount: messages.length,
                  itemBuilder: (context, index) => _buildMessageBubble(
                      messages[index],
                      isStreaming && index == messages.length - 1),
                ),
              ),
            _buildInputBar(isStreaming),
          ],
        ),
      ),
    );
  }

  Widget _buildConversationDrawer(
      AsyncValue<List<Conversation>> conversationsAsync,
      String? currentConvId) {
    return SafeArea(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.accent],
                    ),
                    borderRadius: AppRadius.smAll,
                  ),
                  child: const Icon(Icons.chat_outlined,
                      size: 18, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Text('会话列表',
                    style: GoogleFonts.inter(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: AppThemeHelper.textPrimary(context))),
                const Spacer(),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(13),
                    borderRadius: AppRadius.smAll,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.add,
                        size: 20, color: AppColors.primary),
                    onPressed: _createConversation,
                    tooltip: '新建会话',
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: conversationsAsync.when(
              data: (conversations) {
                if (conversations.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withAlpha(13),
                            borderRadius: AppRadius.xlAll,
                          ),
                          child: const Icon(Icons.forum_outlined,
                              size: 40, color: AppColors.primary),
                        ),
                        const SizedBox(height: 12),
                        Text('暂无会话',
                            style: GoogleFonts.inter(
                                color: AppColors.textPrimaryLight,
                                fontSize: 15,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text('点击 + 创建新对话',
                            style: GoogleFonts.inter(
                                color: AppColors.textSecondaryLight,
                                fontSize: 13)),
                      ],
                    ),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: conversations.length,
                  itemBuilder: (context, index) {
                    final conv = conversations[index];
                    final isSelected = conv.id == currentConvId;
                    return Container(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary.withAlpha(20)
                            : Colors.transparent,
                        borderRadius: AppRadius.mdAll,
                        border: isSelected
                            ? Border.all(color: AppColors.primary.withAlpha(40))
                            : null,
                      ),
                      child: ListTile(
                        dense: true,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 2),
                        leading: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.primary.withAlpha(13),
                            borderRadius: AppRadius.smAll,
                          ),
                          child: Icon(
                            Icons.chat_bubble_outline,
                            size: 16,
                            color:
                                isSelected ? Colors.white : AppColors.primary,
                          ),
                        ),
                        title: Text(
                          conv.name.isEmpty ? '新对话' : conv.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight:
                                isSelected ? FontWeight.w600 : FontWeight.w500,
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.textPrimaryLight,
                          ),
                        ),
                        subtitle: conv.lastMessageAt.isNotEmpty
                            ? Text(
                                DateFormat('MM-dd HH:mm').format(
                                    DateTime.parse(conv.lastMessageAt)
                                        .toLocal()),
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  color: AppColors.textSecondaryLight,
                                ),
                              )
                            : null,
                        onTap: () => _selectConversation(conv.id),
                        trailing: PopupMenuButton<String>(
                          icon: const Icon(Icons.more_horiz,
                              size: 16, color: AppTheme.textSecondary),
                          padding: EdgeInsets.zero,
                          onSelected: (value) {
                            switch (value) {
                              case 'rename':
                                _showRenameDialog(conv.id,
                                    conv.name.isEmpty ? '新对话' : conv.name);
                                break;
                              case 'delete':
                                _deleteConversation(conv.id);
                                break;
                            }
                          },
                          itemBuilder: (_) => [
                            const PopupMenuItem(
                              value: 'rename',
                              child: Row(
                                children: [
                                  Icon(Icons.edit_outlined, size: 16),
                                  SizedBox(width: 8),
                                  Text('重命名'),
                                ],
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'delete',
                              child: Row(
                                children: [
                                  Icon(Icons.delete_outline,
                                      size: 16, color: Colors.red),
                                  SizedBox(width: 8),
                                  Text('删除',
                                      style: TextStyle(color: Colors.red)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 40, color: Colors.red),
                    const SizedBox(height: 8),
                    const Text('加载失败', style: TextStyle(color: Colors.red)),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _loadConversations,
                      child: const Text('重试'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionChip(String text) {
    return ActionChip(
      label: Text(text, style: const TextStyle(fontSize: 13)),
      onPressed: () {
        _messageController.text = text;
        _sendMessage();
      },
      backgroundColor: AppTheme.primary.withAlpha(15),
      side: BorderSide(color: AppTheme.primary.withAlpha(40)),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
    );
  }

  Widget _buildMessageBubble(AIChatMessage message, bool isCurrentlyStreaming) {
    final isUser = message.role == 'user';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child:
                  const Icon(Icons.auto_awesome, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 10),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              decoration: BoxDecoration(
                color: isUser ? AppTheme.primary : Colors.white,
                borderRadius: BorderRadius.circular(16).copyWith(
                  bottomRight: isUser ? const Radius.circular(4) : null,
                  bottomLeft: !isUser ? const Radius.circular(4) : null,
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (message.images != null && message.images!.isNotEmpty) ...[
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: message.images!.map((url) {
                        final fullUrl = url.startsWith('http')
                            ? url
                            : '${AppConstants.uploadsBaseUrl}$url';
                        return ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: CachedNetworkImage(
                            imageUrl: fullUrl,
                            width: 120,
                            height: 120,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => Container(
                              width: 120,
                              height: 120,
                              color: Colors.grey.shade200,
                              child: const Icon(Icons.broken_image,
                                  color: Colors.grey),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (isUser)
                    Text(
                      message.content,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                    )
                  else
                    AIMessageContent(
                      content: message.content.isEmpty && isCurrentlyStreaming
                          ? '▋'
                          : message.content,
                      thinking: message.thinking,
                      textColor: AppTheme.textPrimary,
                      accentColor: AppTheme.primary,
                    ),
                  if (!isUser &&
                      message.content.isEmpty &&
                      !isCurrentlyStreaming)
                    const Text(
                      '(空回复)',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppTheme.textSecondary,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (isUser) ...[
            const SizedBox(width: 10),
            CircleAvatar(
              radius: 18,
              backgroundColor: AppTheme.primary.withAlpha(25),
              child:
                  const Icon(Icons.person, size: 20, color: AppTheme.primary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInputBar(bool isStreaming) {
    return SafeArea(
      top: false,
      child: Container(
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_pendingImages.isNotEmpty)
              Container(
                height: 80,
                margin: const EdgeInsets.only(bottom: 8),
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _pendingImages.length,
                  itemBuilder: (context, index) {
                    return Stack(
                      children: [
                        Container(
                          margin: const EdgeInsets.only(right: 8),
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            borderRadius: AppRadius.mdAll,
                            image: DecorationImage(
                              image:
                                  FileImage(File(_pendingImages[index].path)),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        Positioned(
                          top: 2,
                          right: 10,
                          child: GestureDetector(
                            onTap: () => _removePendingImage(index),
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close,
                                  size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            Row(
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(13),
                    borderRadius: AppRadius.fullAll,
                  ),
                  child: IconButton(
                    icon: _isUploading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          )
                        : const Icon(Icons.image_outlined,
                            color: AppColors.primary),
                    onPressed: isStreaming || _isUploading ? null : _pickImages,
                    tooltip: '上传图片',
                  ),
                ),
                const SizedBox(width: 8),
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
                      enabled: !isStreaming,
                      maxLines: 4,
                      minLines: 1,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppThemeHelper.textPrimary(context),
                      ),
                      decoration: InputDecoration(
                        hintText: isStreaming ? 'AI 正在回复...' : '输入消息...',
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
                            horizontal: 20, vertical: 10),
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  decoration: BoxDecoration(
                    gradient: isStreaming
                        ? null
                        : const LinearGradient(
                            colors: [AppColors.primary, AppColors.accent],
                          ),
                    color: isStreaming ? Colors.grey : null,
                    borderRadius: AppRadius.fullAll,
                    boxShadow: isStreaming
                        ? null
                        : [
                            BoxShadow(
                              color: AppColors.primary.withAlpha(77),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                  ),
                  child: IconButton(
                    icon: isStreaming
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send_rounded,
                            color: Colors.white, size: 20),
                    onPressed: isStreaming ? null : _sendMessage,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
