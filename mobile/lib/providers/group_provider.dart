import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/group_api.dart';
import '../data/models/group.dart';
import '../data/models/user.dart';
import '../data/models/kb_document.dart';
import 'auth_provider.dart';
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

// 群成员
final groupMembersProvider = AsyncNotifierProvider.autoDispose.family<
    GroupMembersNotifier, List<User>, String>(() {
  return GroupMembersNotifier();
});

class GroupMembersNotifier extends AutoDisposeFamilyAsyncNotifier<List<User>, String> {
  @override
  Future<List<User>> build(String groupId) async {
    final res = await ref.read(groupApiProvider).getGroupMembers(groupId);
    return (res.data as List<dynamic>)
        .map((e) => User.fromJson(e as Map<String, dynamic>))
        .toList();
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
final groupMessagesProvider = AsyncNotifierProvider.autoDispose.family<
    GroupMessagesNotifier, List<dynamic>, String>(() {
  return GroupMessagesNotifier();
});

class GroupMessagesNotifier
    extends AutoDisposeFamilyAsyncNotifier<List<dynamic>, String> {
  @override
  Future<List<dynamic>> build(String groupId) async {
    final res = await ref.read(groupApiProvider).getGroupMessages(groupId);
    return res.data as List<dynamic>? ?? [];
  }

  Future<void> refresh(String groupId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build(groupId));
  }

  void addMessage(Map<String, dynamic> message) {
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data([...current, message]);
  }
}

// 群知识库文档
final groupKBDocumentsProvider = AsyncNotifierProvider.autoDispose.family<
    GroupKBDocumentsNotifier, List<KBDocument>, String>(() {
  return GroupKBDocumentsNotifier();
});

class GroupKBDocumentsNotifier
    extends AutoDisposeFamilyAsyncNotifier<List<KBDocument>, String> {
  @override
  Future<List<KBDocument>> build(String groupId) async {
    final res =
        await ref.read(groupApiProvider).getGroupKBDocuments(groupId);
    return (res.data['documents'] as List<dynamic>? ?? [])
        .map((e) => KBDocument.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh(String groupId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build(groupId));
  }

  Future<void> deleteDocument(String groupId, int documentId) async {
    await ref
        .read(groupApiProvider)
        .deleteGroupKBDocument(groupId, documentId);
    final current = state.valueOrNull ?? [];
    state =
        AsyncValue.data(current.where((d) => d.id != documentId).toList());
  }
}
