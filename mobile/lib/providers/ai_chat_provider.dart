import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants.dart';
import '../data/api/ai_chat_api.dart';
import '../data/api/upload_api.dart';
import '../data/models/conversation.dart';
import '../data/services/cache_service.dart';
import '../shared/utils/ai_message_parser.dart';
import 'auth_provider.dart';

final aiChatApiProvider = Provider<AIChatApi>((ref) {
  return AIChatApi(ref.watch(apiClientProvider));
});

final uploadApiProvider = Provider<UploadApi>((ref) {
  return UploadApi(ref.watch(apiClientProvider));
});

final conversationsProvider = AsyncNotifierProvider.autoDispose<
    ConversationsNotifier, List<Conversation>>(() {
  return ConversationsNotifier();
});

class ConversationsNotifier
    extends AutoDisposeAsyncNotifier<List<Conversation>> {
  final CacheService _cache = CacheService();

  @override
  Future<List<Conversation>> build() async {
    final userId = ref.read(authStateProvider).valueOrNull?.id;
    if (userId != null) {
      try {
        final cached = await _cache.getConversations(userId);
        if (cached.isNotEmpty) {
          final convs = cached.map((m) => Conversation(
            id: m['id'] as String,
            name: m['name'] as String? ?? '',
            lastMessageAt: m['last_message_at'] as String? ?? '',
          )).toList();
          _fetchAndCache(userId);
          return convs;
        }
      } catch (_) {}
    }
    return await _fetchAndCache(userId);
  }

  Future<List<Conversation>> _fetchAndCache(String? userId) async {
    try {
      final res = await ref.read(aiChatApiProvider).getConversations();
      final convs = (res.data as List<dynamic>)
          .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
          .toList();
      if (userId != null) {
        for (final conv in convs) {
          await _cache.cacheConversation(
            id: conv.id,
            userId: userId,
            type: 'ai',
            name: conv.name,
            lastMessageAt: conv.lastMessageAt,
          );
        }
      }
      return convs;
    } catch (e) {
      final userId2 = ref.read(authStateProvider).valueOrNull?.id;
      if (userId2 != null) {
        final cached = await _cache.getConversations(userId2);
        if (cached.isNotEmpty) {
          return cached.map((m) => Conversation(
            id: m['id'] as String,
            name: m['name'] as String? ?? '',
            lastMessageAt: m['last_message_at'] as String? ?? '',
          )).toList();
        }
      }
      rethrow;
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<Conversation> create() async {
    final res = await ref.read(aiChatApiProvider).createConversation();
    final conv = Conversation.fromJson(res.data as Map<String, dynamic>);
    refresh();
    return conv;
  }

  Future<void> rename(String id, String name) async {
    await ref.read(aiChatApiProvider).renameConversation(id, name);
    refresh();
  }

  Future<void> delete(String id) async {
    await ref.read(aiChatApiProvider).deleteConversation(id);
    refresh();
  }
}

class AIChatMessage {
  final String id;
  final String role; // 'user', 'assistant'
  final String content;
  final List<String>? images;
  final String? thinking;
  final bool pendingTask;
  final bool taskCreated;
  final List<dynamic> sources;
  final String? createdAt;

  AIChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.images,
    this.thinking,
    this.pendingTask = false,
    this.taskCreated = false,
    this.sources = const [],
    this.createdAt,
  });

  factory AIChatMessage.fromBackend(Map<String, dynamic> json) {
    final content = json['content'] as String? ?? '';
    final parsed = _parseThinking(content);
    final senderId = _senderIdFromBackend(json['sender']);
    return AIChatMessage(
      id: json['_id'] as String? ?? '',
      role: senderId == AppConstants.aiAssistantId || senderId == 'ai'
          ? 'assistant'
          : 'user',
      content: parsed['content']!,
      thinking: parsed['thinking'],
      images:
          (json['images'] as List<dynamic>?)?.map((e) => e as String).toList(),
      sources: json['sources'] as List<dynamic>? ?? const [],
      createdAt: json['createdAt'] as String?,
    );
  }

  static String _senderIdFromBackend(dynamic sender) {
    if (sender is Map<String, dynamic>) {
      return (sender['_id'] ?? sender['id'] ?? '').toString();
    }
    return sender?.toString() ?? '';
  }

  static Map<String, String> _parseThinking(String content) {
    final parsed = parseAIMessageContent(content);
    return {
      'content': parsed.content,
      'thinking': parsed.thinking ?? '',
    };
  }
}

final aiMessagesProvider =
    StateNotifierProvider.autoDispose<AIMessagesNotifier, List<AIChatMessage>>(
        (ref) {
  return AIMessagesNotifier();
});

class AIMessagesNotifier extends StateNotifier<List<AIChatMessage>> {
  AIMessagesNotifier() : super([]);

  void setMessages(List<AIChatMessage> messages) {
    state = messages;
  }

  void addUserMessage(String content, {List<String>? images}) {
    state = [
      ...state,
      AIChatMessage(
        id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
        role: 'user',
        content: content,
        images: images,
      ),
    ];
  }

  void startAssistantMessage() {
    state = [
      ...state,
      AIChatMessage(
        id: 'streaming_${DateTime.now().millisecondsSinceEpoch}',
        role: 'assistant',
        content: '',
      ),
    ];
  }

  void appendToLastMessage(String chunk) {
    if (state.isEmpty) return;
    final last = state.last;
    final updated = AIChatMessage(
      id: last.id,
      role: last.role,
      content: last.content + chunk,
      images: last.images,
      thinking: last.thinking,
      pendingTask: last.pendingTask,
      taskCreated: last.taskCreated,
      sources: last.sources,
    );
    state = [...state.sublist(0, state.length - 1), updated];
  }

  void markStreamDone({
    bool pendingTask = false,
    bool taskCreated = false,
    List<dynamic> sources = const [],
  }) {
    if (state.isEmpty) return;
    final last = state.last;
    final parsed = AIChatMessage._parseThinking(last.content);
    final updated = AIChatMessage(
      id: 'done_${DateTime.now().millisecondsSinceEpoch}',
      role: last.role,
      content: parsed['content']!,
      thinking: parsed['thinking'],
      images: last.images,
      pendingTask: pendingTask,
      taskCreated: taskCreated,
      sources: sources,
    );
    state = [...state.sublist(0, state.length - 1), updated];
  }

  void replaceLastAssistantWithError(String message) {
    if (state.isEmpty) return;
    final last = state.last;
    final updated = AIChatMessage(
      id: last.id,
      role: 'assistant',
      content: message,
      images: last.images,
    );
    state = [...state.sublist(0, state.length - 1), updated];
  }

  void clear() {
    state = [];
  }
}

final currentConversationIdProvider =
    StateProvider.autoDispose<String?>((ref) => null);
final isStreamingProvider = StateProvider.autoDispose<bool>((ref) => false);
