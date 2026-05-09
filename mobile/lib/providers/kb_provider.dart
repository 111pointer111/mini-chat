import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/kb_api.dart';
import '../data/models/kb_document.dart';
import 'auth_provider.dart';

final kbApiProvider = Provider<KBApi>((ref) {
  return KBApi(ref.watch(apiClientProvider));
});

// 分页信息
class KBPagination {
  final int page;
  final int total;
  final int totalPages;

  const KBPagination({required this.page, required this.total, required this.totalPages});

  factory KBPagination.fromJson(Map<String, dynamic> json) {
    return KBPagination(
      page: json['page'] as int? ?? 1,
      total: json['total'] as int? ?? 0,
      totalPages: json['totalPages'] as int? ?? 0,
    );
  }
}

// 文档列表状态
class KBDocumentState {
  final List<KBDocument> documents;
  final KBPagination? pagination;

  const KBDocumentState({required this.documents, this.pagination});
}

final kbDocumentsProvider =
    AsyncNotifierProvider.autoDispose<KBDocumentsNotifier, KBDocumentState>(() {
  return KBDocumentsNotifier();
});

// 搜索状态
final kbSearchQueryProvider = StateProvider.autoDispose<String>((ref) => '');

final kbSearchResultsProvider =
    AsyncNotifierProvider.autoDispose<KBSearchNotifier, List<KBDocument>>(() {
  return KBSearchNotifier();
});

class KBDocumentsNotifier extends AutoDisposeAsyncNotifier<KBDocumentState> {
  int _page = 1;

  @override
  Future<KBDocumentState> build() async {
    _page = 1;
    final res = await ref.read(kbApiProvider).getDocuments(page: _page);
    final docs = (res.data['documents'] as List<dynamic>? ?? [])
        .map((e) => KBDocument.fromJson(e as Map<String, dynamic>))
        .toList();
    final pagination = res.data['pagination'] != null
        ? KBPagination.fromJson(res.data['pagination'] as Map<String, dynamic>)
        : null;
    return KBDocumentState(documents: docs, pagination: pagination);
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<void> goToPage(int page) async {
    state = const AsyncValue.loading();
    _page = page;
    final res = await ref.read(kbApiProvider).getDocuments(page: _page);
    final docs = (res.data['documents'] as List<dynamic>? ?? [])
        .map((e) => KBDocument.fromJson(e as Map<String, dynamic>))
        .toList();
    final pagination = res.data['pagination'] != null
        ? KBPagination.fromJson(res.data['pagination'] as Map<String, dynamic>)
        : null;
    state = AsyncValue.data(KBDocumentState(documents: docs, pagination: pagination));
  }

  Future<void> deleteDocument(int id) async {
    await ref.read(kbApiProvider).deleteDocument(id);
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(KBDocumentState(
        documents: current.documents.where((d) => d.id != id).toList(),
        pagination: current.pagination,
      ));
    }
  }
}

class KBSearchNotifier extends AutoDisposeAsyncNotifier<List<KBDocument>> {
  @override
  Future<List<KBDocument>> build() async {
    return [];
  }

  Future<void> search(String keyword) async {
    if (keyword.trim().isEmpty) {
      state = const AsyncValue.data([]);
      return;
    }
    state = const AsyncValue.loading();
    try {
      final res = await ref.read(kbApiProvider).search(keyword);
      final docs = (res.data['documents'] as List<dynamic>? ?? [])
          .map((e) => KBDocument.fromJson(e as Map<String, dynamic>))
          .toList();
      state = AsyncValue.data(docs);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  void clear() {
    state = const AsyncValue.data([]);
  }
}
