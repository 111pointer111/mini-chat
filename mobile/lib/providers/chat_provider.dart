import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/friend_api.dart';
import '../data/api/message_api.dart';
import '../data/api/group_api.dart';
import '../data/api/scheduled_task_api.dart';
import '../data/models/user.dart';
import '../data/models/message.dart';
import '../data/models/friend_request.dart';
import '../data/services/cache_service.dart';
import 'auth_provider.dart';

final friendApiProvider = Provider<FriendApi>((ref) {
  return FriendApi(ref.watch(apiClientProvider));
});

final messageApiProvider = Provider<MessageApi>((ref) {
  return MessageApi(ref.watch(apiClientProvider));
});

final groupApiProvider = Provider<GroupApi>((ref) {
  return GroupApi(ref.watch(apiClientProvider));
});

final scheduledTaskApiProvider = Provider<ScheduledTaskApi>((ref) {
  return ScheduledTaskApi(ref.watch(apiClientProvider));
});

final friendsProvider =
    AsyncNotifierProvider.autoDispose<FriendsNotifier, List<User>>(() {
  return FriendsNotifier();
});

class FriendsNotifier extends AutoDisposeAsyncNotifier<List<User>> {
  final CacheService _cache = CacheService();

  @override
  Future<List<User>> build() async {
    final userId = ref.read(authStateProvider).valueOrNull?.id;
    if (userId != null) {
      try {
        final cached = await _cache.getFriendUsers(userId);
        if (cached.isNotEmpty) {
          // 异步拉取网络更新，不阻塞返回
          _fetchAndCache(userId);
          return cached;
        }
      } catch (_) {}
    }
    return await _fetchAndCache(userId);
  }

  Future<List<User>> _fetchAndCache(String? userId) async {
    try {
      final res = await ref.read(friendApiProvider).getFriends();
      final users = (res.data as List<dynamic>)
          .map((e) => User.fromJson(e as Map<String, dynamic>))
          .toList();
      if (userId != null) {
        await _cache.cacheFriends(users, userId);
      }
      return users;
    } catch (e) {
      // 网络失败时如果有缓存数据则保持，否则抛出
      final userId2 = ref.read(authStateProvider).valueOrNull?.id;
      if (userId2 != null) {
        final cached = await _cache.getFriendUsers(userId2);
        if (cached.isNotEmpty) return cached;
      }
      rethrow;
    }
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(() => build());
  }

  Future<void> sendRequest(String recipientId) async {
    await ref.read(friendApiProvider).sendRequest(recipientId);
  }
}

final pendingRequestsProvider = AsyncNotifierProvider.autoDispose<
    PendingRequestsNotifier, List<FriendRequest>>(() {
  return PendingRequestsNotifier();
});

class PendingRequestsNotifier
    extends AutoDisposeAsyncNotifier<List<FriendRequest>> {
  @override
  Future<List<FriendRequest>> build() async {
    final res = await ref.read(friendApiProvider).getPendingRequests();
    return (res.data as List<dynamic>)
        .map((e) => FriendRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(() => build());
  }

  Future<void> acceptRequest(String requestId) async {
    await ref.read(friendApiProvider).acceptRequest(requestId);
    refresh();
    ref.read(friendsProvider.notifier).refresh();
  }
}

enum ChatType { none, friend, group, task }

class ChatSelection {
  final ChatType type;
  final String? id;
  final String? name;

  const ChatSelection({this.type = ChatType.none, this.id, this.name});

  ChatSelection copyWith({ChatType? type, String? id, String? name}) {
    return ChatSelection(
      type: type ?? this.type,
      id: id ?? this.id,
      name: name ?? this.name,
    );
  }
}

final chatSelectionProvider =
    StateProvider<ChatSelection>((ref) => const ChatSelection());

final messagesProvider =
    AsyncNotifierProvider<MessagesNotifier, List<Message>>(() {
  return MessagesNotifier();
});

class MessagesNotifier extends AsyncNotifier<List<Message>> {
  bool _hasMore = true;
  bool _isLoadingMore = false;
  String? _loadError;
  String? _currentFriendId;
  String? _currentGroupId;
  String? _currentConversationId;

  final CacheService _cache = CacheService();

  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;
  String? get loadError => _loadError;

  @override
  List<Message> build() => [];

  /// 获取好友消息（SQLite 主导，不会串位）
  Future<void> fetchFriendMessages(String friendId) async {
    final conversationId = 'friend_$friendId';
    _currentConversationId = conversationId;
    _currentFriendId = friendId;
    _currentGroupId = null;
    _hasMore = true;

    // 1. 先从 SQLite 加载（不会串位，因为按 conversationId 存储）
    try {
      final cachedMessages = await _cache.getMessages(conversationId);
      if (cachedMessages.isNotEmpty) {
        state = AsyncValue.data(cachedMessages);
      } else {
        state = const AsyncValue.loading();
      }
    } catch (e) {
      debugPrint('[MessagesNotifier] Cache load error: $e');
      state = const AsyncValue.loading();
    }

    // 2. 从网络加载最新数据
    try {
      final res = await ref.read(messageApiProvider).getMessages(friendId);
      final data = res.data;
      final messagesList = data is Map<String, dynamic>
          ? (data['messages'] as List<dynamic>? ?? [])
          : data as List<dynamic>;
      _hasMore = data is Map<String, dynamic>
          ? (data['hasMore'] as bool? ?? false)
          : false;
      final messages = messagesList
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();

      // 3. 保存到 SQLite
      await _cache.cacheMessages(conversationId, messages);
      await _cache.updateSyncStatus(
        conversationId: conversationId,
        lastMessageId: messages.isNotEmpty ? messages.last.id : null,
        lastMessageTime: messages.isNotEmpty ? messages.last.createdAt : null,
      );

      // 4. 校验 conversationId（防止串位）
      if (_currentConversationId == conversationId) {
        state = AsyncValue.data(messages);
      }
    } catch (e) {
      debugPrint('[MessagesNotifier] Network fetch error: $e');
      // 网络失败，但 SQLite 中有缓存，不会丢失数据
      if (_currentConversationId == conversationId &&
          state.valueOrNull == null) {
        state = AsyncValue.error(e, StackTrace.current);
      }
    }
  }

  /// 获取群组消息（SQLite 主导，不会串位）
  Future<void> fetchGroupMessages(String groupId) async {
    final conversationId = 'group_$groupId';
    _currentConversationId = conversationId;
    _currentGroupId = groupId;
    _currentFriendId = null;
    _hasMore = true;

    // 1. 先从 SQLite 加载
    try {
      final cachedMessages = await _cache.getMessages(conversationId);
      if (cachedMessages.isNotEmpty) {
        state = AsyncValue.data(cachedMessages);
      } else {
        state = const AsyncValue.loading();
      }
    } catch (e) {
      debugPrint('[MessagesNotifier] Cache load error: $e');
      state = const AsyncValue.loading();
    }

    // 2. 从网络加载
    try {
      final res = await ref.read(groupApiProvider).getGroupMessages(groupId);
      final data = res.data;
      final messagesList = data is Map<String, dynamic>
          ? (data['messages'] as List<dynamic>? ?? [])
          : data as List<dynamic>;
      _hasMore = data is Map<String, dynamic>
          ? (data['hasMore'] as bool? ?? false)
          : false;
      final messages = messagesList
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();

      // 3. 保存到 SQLite
      await _cache.cacheMessages(conversationId, messages);

      // 4. 校验 conversationId
      if (_currentConversationId == conversationId) {
        state = AsyncValue.data(messages);
      }
    } catch (e) {
      debugPrint('[MessagesNotifier] Network fetch error: $e');
      if (_currentConversationId == conversationId &&
          state.valueOrNull == null) {
        state = AsyncValue.error(e, StackTrace.current);
      }
    }
  }

  /// 获取定时任务消息
  Future<void> fetchTaskMessages(String taskType) async {
    final conversationId = 'task_$taskType';
    _currentConversationId = conversationId;
    _hasMore = false;

    // 1. 先从 SQLite 加载
    try {
      final cachedMessages = await _cache.getMessages(conversationId);
      if (cachedMessages.isNotEmpty) {
        state = AsyncValue.data(cachedMessages);
      } else {
        state = const AsyncValue.loading();
      }
    } catch (e) {
      state = const AsyncValue.loading();
    }

    // 2. 从网络加载
    try {
      final res =
          await ref.read(scheduledTaskApiProvider).getTaskMessages(taskType);
      final messages = (res.data['messages'] as List<dynamic>? ?? [])
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();

      // 3. 保存到 SQLite
      await _cache.cacheMessages(conversationId, messages);

      // 4. 校验 conversationId
      if (_currentConversationId == conversationId) {
        state = AsyncValue.data(messages);
      }
    } catch (e) {
      if (_currentConversationId == conversationId &&
          state.valueOrNull == null) {
        state = AsyncValue.error(e, StackTrace.current);
      }
    }
  }

  /// 加载更多历史消息（上滑触发）
  Future<void> loadMore() async {
    if (!_hasMore || _isLoadingMore) return;
    final currentMessages = state.valueOrNull;
    if (currentMessages == null || currentMessages.isEmpty) return;

    final conversationId = _currentConversationId;
    _loadError = null;
    _isLoadingMore = true;
    try {
      final oldest = currentMessages.first;
      final before = oldest.createdAt;

      Response res;
      if (_currentFriendId != null) {
        res = await ref
            .read(messageApiProvider)
            .getMessages(_currentFriendId!, before: before);
      } else if (_currentGroupId != null) {
        res = await ref
            .read(groupApiProvider)
            .getGroupMessages(_currentGroupId!, before: before);
      } else {
        return;
      }

      final data = res.data;
      final messagesList = data is Map<String, dynamic>
          ? (data['messages'] as List<dynamic>? ?? [])
          : data as List<dynamic>;
      _hasMore = data is Map<String, dynamic>
          ? (data['hasMore'] as bool? ?? false)
          : false;
      final olderMessages = messagesList
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();

      // 保存到 SQLite
      if (conversationId != null) {
        await _cache.cacheMessages(conversationId, olderMessages);
      }

      // 校验 conversationId
      if (_currentConversationId == conversationId) {
        state = AsyncValue.data([...olderMessages, ...currentMessages]);
      }
    } catch (e) {
      _loadError = '加载历史消息失败，点击重试';
    } finally {
      _isLoadingMore = false;
    }
  }

  void addMessage(Message message) {
    final current = state.valueOrNull ?? [];
    if (current.any((item) => item.id == message.id)) return;
    state = AsyncValue.data([...current, message]);

    // 同时保存到 SQLite
    if (_currentConversationId != null) {
      _cache.cacheMessage(
        id: message.id,
        conversationId: _currentConversationId!,
        senderId: message.senderId,
        receiverId: message.receiver,
        groupId: message.groupId,
        content: message.content,
        type: message.type,
        images: message.images,
        mentionAssistant: message.mentionAssistant,
        createdAt: message.createdAt,
      );

      // 更新会话的最后消息
      _cache.updateConversationLastMessage(
        _currentConversationId!,
        message.content.length > 50
            ? '${message.content.substring(0, 50)}...'
            : message.content,
        message.createdAt,
      );
    }
  }

  void replaceTempMessage(String tempId, Message serverMessage) {
    final current = state.valueOrNull ?? [];
    var replaced = false;
    final updated = current.map((m) {
      if (m.id == tempId) {
        replaced = true;
        return serverMessage;
      }
      return m;
    }).toList();

    if (!replaced && !updated.any((m) => m.id == serverMessage.id)) {
      updated.add(serverMessage);
    }

    state = AsyncValue.data([
      for (final item in updated)
        if (updated.indexWhere((candidate) => candidate.id == item.id) ==
            updated.indexOf(item))
          item,
    ]);
  }

  void updateMessageId(String tempId, String realId) {
    final current = state.valueOrNull ?? [];
    final updated = current.map((m) {
      if (m.id == tempId) {
        return Message(
          id: realId,
          sender: m.sender,
          receiver: m.receiver,
          groupId: m.groupId,
          content: m.content,
          type: m.type,
          createdAt: m.createdAt,
          mentionAssistant: m.mentionAssistant,
          images: m.images,
        );
      }
      return m;
    }).toList();
    state = AsyncValue.data(updated);
  }

  void appendMessageContent(String messageId, String content) {
    if (content.isEmpty) return;
    final current = state.valueOrNull ?? [];
    final updated = current.map((m) {
      if (m.id != messageId) return m;
      return Message(
        id: m.id,
        sender: m.sender,
        receiver: m.receiver,
        groupId: m.groupId,
        content: '${m.content}$content',
        type: m.type,
        createdAt: m.createdAt,
        mentionAssistant: m.mentionAssistant,
        images: m.images,
      );
    }).toList();
    state = AsyncValue.data(updated);
  }
}
