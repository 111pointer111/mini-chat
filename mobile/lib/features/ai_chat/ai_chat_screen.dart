import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';

import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../data/models/conversation.dart';
import '../../providers/ai_chat_provider.dart';
import '../../providers/auth_provider.dart';
import '../../shared/widgets/ai_provider_selector.dart';
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
          errorMsg =
              data['error'] as String? ?? data['message'] as String? ?? errorMsg;
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
          
          // 解析回复内容
          String mainContent = reply;
          String? thinkingContent;
          
          // 提取 thinking 标签
          final thinkRegex = RegExp(r'<think>([\s\S]*?)</think>', dotAll: true);
          final thinkMatch = thinkRegex.firstMatch(reply);
          if (thinkMatch != null) {
            thinkingContent = thinkMatch.group(1)?.trim();
            mainContent = reply.replaceAll(thinkRegex, '').trim();
          }
          
          // 更新消息
          final messages = ref.read(aiMessagesProvider);
          if (messages.isNotEmpty) {
            final lastMessage = messages.last;
            ref.read(aiMessagesProvider.notifier).setMessages(
              messages.sublist(0, messages.length - 1)..add(
                AIChatMessage(
                  id: lastMessage.id,
                  role: 'assistant',
                  content: mainContent,
                  thinking: thinkingContent,
                  createdAt: DateTime.now().toIso8601String(),
                ),
              ),
            );
          }
          
          // 更新会话 ID
          if (newConversationId != null && conversationId == null) {
            ref.read(currentConversationIdProvider.notifier).state = newConversationId;
          }
          
          _loadConversations();
        }
      } catch (e) {
        // REST API 也失败了，显示错误
        final messages = ref.read(aiMessagesProvider);
        if (messages.isNotEmpty) {
          final lastMessage = messages.last;
          ref.read(aiMessagesProvider.notifier).setMessages(
            messages.sublist(0, messages.length - 1)..add(
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
          .map(
              (e) => AIChatMessage.fromBackend(e as Map<String, dynamic>))
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
      final conv =
          await ref.read(conversationsProvider.notifier).create();
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
                ref
                    .read(conversationsProvider.notifier)
                    .rename(convId, name);
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

    return Scaffold(
      key: _scaffoldKey,
      drawer: Drawer(
        child: _buildConversationDrawer(
            conversationsAsync, currentConvId),
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
                        padding: const EdgeInsets.all(24),
                        decoration: const BoxDecoration(
                          gradient: AppTheme.primaryGradient,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.auto_awesome,
                            size: 48, color: Colors.white),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'AI 智能助手',
                        style: TextStyle(
                            fontSize: 22, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        '发送消息开始对话，支持图片和 Markdown',
                        style: TextStyle(
                            fontSize: 14, color: AppTheme.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
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
    );
  }

  Widget _buildConversationDrawer(
      AsyncValue<List<Conversation>> conversationsAsync,
      String? currentConvId) {
    return SafeArea(
      child: Column(
        children: [
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            decoration: BoxDecoration(
              border: Border(
                  bottom:
                      BorderSide(color: Colors.grey.shade200, width: 0.5)),
            ),
            child: Row(
              children: [
                const Icon(Icons.chat_outlined,
                    size: 22, color: AppTheme.primary),
                const SizedBox(width: 10),
                const Text('会话列表',
                    style: TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w600)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.add, size: 22),
                  onPressed: _createConversation,
                  tooltip: '新建会话',
                ),
              ],
            ),
          ),
          Expanded(
            child: conversationsAsync.when(
              data: (conversations) {
                if (conversations.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.forum_outlined,
                            size: 48, color: AppTheme.textSecondary),
                        SizedBox(height: 12),
                        Text('暂无会话',
                            style: TextStyle(
                                color: AppTheme.textSecondary,
                                fontSize: 14)),
                        SizedBox(height: 4),
                        Text('点击 + 创建新对话',
                            style: TextStyle(
                                color: AppTheme.textSecondary,
                                fontSize: 12)),
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
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppTheme.primary.withAlpha(20)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        border: isSelected
                            ? Border.all(
                                color: AppTheme.primary.withAlpha(40))
                            : null,
                      ),
                      child: ListTile(
                        dense: true,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 2),
                        leading: Icon(
                          Icons.chat_bubble_outline,
                          size: 18,
                          color: isSelected
                              ? AppTheme.primary
                              : AppTheme.textSecondary,
                        ),
                        title: Text(
                          conv.name.isEmpty ? '新对话' : conv.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isSelected
                                ? FontWeight.w600
                                : FontWeight.normal,
                            color: isSelected
                                ? AppTheme.primary
                                : AppTheme.textPrimary,
                          ),
                        ),
                        subtitle: conv.lastMessageAt.isNotEmpty
                            ? Text(
                                DateFormat('MM-dd HH:mm').format(
                                    DateTime.parse(conv.lastMessageAt)
                                        .toLocal()),
                                style: const TextStyle(fontSize: 11),
                              )
                            : null,
                        onTap: () => _selectConversation(conv.id),
                        trailing: PopupMenuButton<String>(
                          icon: Icon(Icons.more_horiz,
                              size: 16, color: AppTheme.textSecondary),
                          padding: EdgeInsets.zero,
                          onSelected: (value) {
                            switch (value) {
                              case 'rename':
                                _showRenameDialog(
                                    conv.id,
                                    conv.name.isEmpty
                                        ? '新对话'
                                        : conv.name);
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
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 40, color: Colors.red),
                    const SizedBox(height: 8),
                    const Text('加载失败',
                        style: TextStyle(color: Colors.red)),
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

  Widget _buildMessageBubble(
      AIChatMessage message, bool isCurrentlyStreaming) {
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
              child: const Icon(Icons.auto_awesome,
                  size: 18, color: Colors.white),
            ),
            const SizedBox(width: 10),
          ],
          Flexible(
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              decoration: BoxDecoration(
                color: isUser ? AppTheme.primary : Colors.white,
                borderRadius: BorderRadius.circular(16).copyWith(
                  bottomRight:
                      isUser ? const Radius.circular(4) : null,
                  bottomLeft:
                      !isUser ? const Radius.circular(4) : null,
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
                  if (message.images != null &&
                      message.images!.isNotEmpty) ...[
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
                  if (message.thinking != null &&
                      message.thinking!.isNotEmpty)
                    _ThinkingBlock(thinking: message.thinking!),
                  if (isUser)
                    Text(
                      message.content,
                      style: const TextStyle(
                          color: Colors.white, fontSize: 14),
                    )
                  else
                    MarkdownBody(
                      data: message.content.isEmpty &&
                              isCurrentlyStreaming
                          ? '▋'
                          : message.content,
                      styleSheet: MarkdownStyleSheet(
                        p: const TextStyle(
                            fontSize: 14, color: AppTheme.textPrimary),
                        code: TextStyle(
                          fontSize: 13,
                          color: AppTheme.primary,
                          backgroundColor:
                              AppTheme.primary.withAlpha(15),
                        ),
                        codeblockDecoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        blockquoteDecoration: BoxDecoration(
                          border: Border(
                              left: BorderSide(
                                  color: AppTheme.primary, width: 3)),
                        ),
                        blockquotePadding:
                            const EdgeInsets.only(left: 12),
                        h1: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold),
                        h2: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold),
                        h3: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  if (!isUser &&
                      message.content.isEmpty &&
                      !isCurrentlyStreaming)
                    Text(
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
              child: const Icon(Icons.person,
                  size: 20, color: AppTheme.primary),
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
          color: Colors.white.withAlpha(200),
          border: Border(
              top: BorderSide(color: Colors.grey.shade200, width: 0.5)),
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
                            borderRadius: BorderRadius.circular(8),
                            image: DecorationImage(
                              image: FileImage(
                                  File(_pendingImages[index].path)),
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
                                color: Colors.red,
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
                IconButton(
                  icon: _isUploading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.image_outlined,
                          color: AppTheme.primary),
                  onPressed: isStreaming || _isUploading
                      ? null
                      : _pickImages,
                  tooltip: '上传图片',
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    enabled: !isStreaming,
                    maxLines: 4,
                    minLines: 1,
                    decoration: InputDecoration(
                      hintText:
                          isStreaming ? 'AI 正在回复...' : '输入消息...',
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
                  backgroundColor:
                      isStreaming ? Colors.grey : AppTheme.primary,
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
                        : const Icon(Icons.send,
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

class _ThinkingBlock extends StatefulWidget {
  final String thinking;

  const _ThinkingBlock({required this.thinking});

  @override
  State<_ThinkingBlock> createState() => _ThinkingBlockState();
}

class _ThinkingBlockState extends State<_ThinkingBlock> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(8)),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 10, vertical: 6),
              child: Row(
                children: [
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_down
                        : Icons.keyboard_arrow_right,
                    size: 18,
                    color: Colors.amber.shade800,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '思考过程',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade800,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.only(
                  left: 10, right: 10, bottom: 8),
              child: Text(
                widget.thinking,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade700,
                  height: 1.5,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
