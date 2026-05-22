import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/friend_api.dart';
import '../data/api/message_api.dart';
import '../data/api/group_api.dart';
import '../data/api/scheduled_task_api.dart';
import '../data/models/user.dart';
import '../data/models/message.dart';
import '../data/models/friend_request.dart';
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

final friendsProvider = AsyncNotifierProvider.autoDispose<FriendsNotifier, List<User>>(() {
  return FriendsNotifier();
});

class FriendsNotifier extends AutoDisposeAsyncNotifier<List<User>> {
  @override
  Future<List<User>> build() async {
    final res = await ref.read(friendApiProvider).getFriends();
    return (res.data as List<dynamic>)
        .map((e) => User.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<void> sendRequest(String recipientId) async {
    await ref.read(friendApiProvider).sendRequest(recipientId);
  }
}

final pendingRequestsProvider =
    AsyncNotifierProvider.autoDispose<PendingRequestsNotifier, List<FriendRequest>>(() {
  return PendingRequestsNotifier();
});

class PendingRequestsNotifier extends AutoDisposeAsyncNotifier<List<FriendRequest>> {
  @override
  Future<List<FriendRequest>> build() async {
    final res = await ref.read(friendApiProvider).getPendingRequests();
    return (res.data as List<dynamic>)
        .map((e) => FriendRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
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
    StateProvider.autoDispose<ChatSelection>((ref) => const ChatSelection());

final messagesProvider =
    AsyncNotifierProvider.autoDispose<MessagesNotifier, List<Message>>(() {
  return MessagesNotifier();
});

class MessagesNotifier extends AutoDisposeAsyncNotifier<List<Message>> {
  bool _hasMore = true;
  bool _isLoadingMore = false;
  String? _loadError;
  String? _currentFriendId;
  String? _currentGroupId;

  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;
  String? get loadError => _loadError;

  @override
  List<Message> build() => [];

  Future<void> fetchFriendMessages(String friendId) async {
    _currentFriendId = friendId;
    _currentGroupId = null;
    _hasMore = true;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final res = await ref.read(messageApiProvider).getMessages(friendId);
      final data = res.data;
      final messagesList = data is Map<String, dynamic>
          ? (data['messages'] as List<dynamic>? ?? [])
          : data as List<dynamic>;
      _hasMore = data is Map<String, dynamic>
          ? (data['hasMore'] as bool? ?? false)
          : false;
      return messagesList
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
    });
  }

  Future<void> fetchGroupMessages(String groupId) async {
    _currentGroupId = groupId;
    _currentFriendId = null;
    _hasMore = true;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final res = await ref.read(groupApiProvider).getGroupMessages(groupId);
      final data = res.data;
      final messagesList = data is Map<String, dynamic>
          ? (data['messages'] as List<dynamic>? ?? [])
          : data as List<dynamic>;
      _hasMore = data is Map<String, dynamic>
          ? (data['hasMore'] as bool? ?? false)
          : false;
      return messagesList
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
    });
  }

  Future<void> fetchTaskMessages(String taskType) async {
    _hasMore = false;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final res =
          await ref.read(scheduledTaskApiProvider).getTaskMessages(taskType);
      final messages = res.data['messages'] as List<dynamic>? ?? [];
      return messages
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
    });
  }

  /// 加载更多历史消息（上滑触发）
  Future<void> loadMore() async {
    if (!_hasMore || _isLoadingMore) return;
    final currentMessages = state.valueOrNull;
    if (currentMessages == null || currentMessages.isEmpty) return;

    _loadError = null;
    _isLoadingMore = true;
    try {
      final oldest = currentMessages.first;
      final before = oldest.createdAt;

      Response res;
      if (_currentFriendId != null) {
        res = await ref.read(messageApiProvider)
            .getMessages(_currentFriendId!, before: before);
      } else if (_currentGroupId != null) {
        res = await ref.read(groupApiProvider)
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

      state = AsyncValue.data([...olderMessages, ...currentMessages]);
    } catch (e) {
      _loadError = '加载历史消息失败，点击重试';
    } finally {
      _isLoadingMore = false;
    }
  }

  void addMessage(Message message) {
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data([...current, message]);
  }

  void replaceTempMessage(String tempId, Message serverMessage) {
    final current = state.valueOrNull ?? [];
    final updated = current.map((m) => m.id == tempId ? serverMessage : m).toList();
    state = AsyncValue.data(updated);
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
}
