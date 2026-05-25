import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/group.dart';
import '../data/models/message.dart';
import '../data/models/user.dart';
import '../data/models/kb_document.dart';
import 'chat_provider.dart';

// 群组列表
final groupsProvider =
    AsyncNotifierProvider.autoDispose<GroupsNotifier, List<Group>>(() {
  return GroupsNotifier();
});

class GroupsNotifier extends AutoDisposeAsyncNotifier<List<Group>> {
  @override
  Future<List<Group>> build() async {
    final res = await ref.read(groupApiProvider).getGroups();
    return (res.data as List<dynamic>)
        .map((e) => Group.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<Group> createGroup(String name, List<String> memberIds) async {
    final res = await ref.read(groupApiProvider).createGroup(name, memberIds);
    final group = Group.fromJson(res.data as Map<String, dynamic>);
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data([group, ...current]);
    return group;
  }
}

// 群成员（带群内角色）
class GroupMember {
  final User user;
  final String role; // 'owner', 'admin', 'member'

  GroupMember({required this.user, required this.role});
}

final groupMembersProvider = AsyncNotifierProvider.autoDispose
    .family<GroupMembersNotifier, List<GroupMember>, String>(() {
  return GroupMembersNotifier();
});

class GroupMembersNotifier
    extends AutoDisposeFamilyAsyncNotifier<List<GroupMember>, String> {
  @override
  Future<List<GroupMember>> build(String groupId) async {
    final res = await ref.read(groupApiProvider).getGroupMembers(groupId);
    return (res.data as List<dynamic>).map((e) {
      final map = e as Map<String, dynamic>;
      return GroupMember(
        user: User.fromJson(map['user'] as Map<String, dynamic>),
        role: map['role'] as String? ?? 'member',
      );
    }).toList();
  }

  Future<void> refresh(String groupId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build(groupId));
  }

  Future<void> addMembers(String groupId, List<String> memberIds) async {
    await ref.read(groupApiProvider).addGroupMembers(groupId, memberIds);
    await refresh(groupId);
  }
}

// 群消息
final groupMessagesProvider = AsyncNotifierProvider.autoDispose
    .family<GroupMessagesNotifier, List<Message>, String>(() {
  return GroupMessagesNotifier();
});

class GroupMessagesNotifier
    extends AutoDisposeFamilyAsyncNotifier<List<Message>, String> {
  bool _hasMore = true;
  bool _isLoadingMore = false;
  String? _loadError;

  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;
  String? get loadError => _loadError;

  @override
  Future<List<Message>> build(String groupId) async {
    _hasMore = true;
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
  }

  Future<void> refresh(String groupId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build(groupId));
  }

  Future<void> loadMore(String groupId) async {
    if (!_hasMore || _isLoadingMore) return;
    final currentMessages = state.valueOrNull;
    if (currentMessages == null || currentMessages.isEmpty) return;

    _loadError = null;
    _isLoadingMore = true;
    try {
      final oldest = currentMessages.first;
      final res = await ref
          .read(groupApiProvider)
          .getGroupMessages(groupId, before: oldest.createdAt);
      final data = res.data;
      final messagesList = data['messages'] as List<dynamic>? ?? [];
      _hasMore = data['hasMore'] as bool? ?? false;
      final olderMessages = messagesList
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
      state = AsyncValue.data([...olderMessages, ...currentMessages]);
    } catch (_) {
      _loadError = '加载历史消息失败，点击重试';
    } finally {
      _isLoadingMore = false;
    }
  }

  void addMessage(Map<String, dynamic> json) {
    final current = state.valueOrNull ?? [];
    final message = Message.fromJson(json);
    if (current.any((item) => item.id == message.id)) return;
    state = AsyncValue.data([...current, message]);
  }

  void appendMessageContent(String messageId, String content) {
    if (content.isEmpty) return;
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data(current.map((message) {
      if (message.id != messageId) return message;
      return Message(
        id: message.id,
        sender: message.sender,
        receiver: message.receiver,
        groupId: message.groupId,
        content: '${message.content}$content',
        type: message.type,
        createdAt: message.createdAt,
        mentionAssistant: message.mentionAssistant,
        images: message.images,
      );
    }).toList());
  }

  void replaceMessage(String messageId, Map<String, dynamic> json) {
    final current = state.valueOrNull ?? [];
    final message = Message.fromJson(json);
    var replaced = false;
    final updated = current.map((item) {
      if (item.id == messageId) {
        replaced = true;
        return message;
      }
      return item;
    }).toList();

    if (!replaced && !updated.any((item) => item.id == message.id)) {
      updated.add(message);
    }

    state = AsyncValue.data([
      for (final item in updated)
        if (updated.indexWhere((candidate) => candidate.id == item.id) ==
            updated.indexOf(item))
          item,
    ]);
  }
}

// 群知识库文档
final groupKBDocumentsProvider = AsyncNotifierProvider.autoDispose
    .family<GroupKBDocumentsNotifier, List<KBDocument>, String>(() {
  return GroupKBDocumentsNotifier();
});

class GroupKBDocumentsNotifier
    extends AutoDisposeFamilyAsyncNotifier<List<KBDocument>, String> {
  @override
  Future<List<KBDocument>> build(String groupId) async {
    final res = await ref.read(groupApiProvider).getGroupKBDocuments(groupId);
    return (res.data['documents'] as List<dynamic>? ?? [])
        .map((e) => KBDocument.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh(String groupId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build(groupId));
  }

  Future<void> deleteDocument(String groupId, int documentId) async {
    await ref.read(groupApiProvider).deleteGroupKBDocument(groupId, documentId);
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data(current.where((d) => d.id != documentId).toList());
  }
}
