import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/kb_api.dart';
import '../data/models/kb_document.dart';
import 'auth_provider.dart';

final kbApiProvider = Provider<KBApi>((ref) {
  return KBApi(ref.watch(apiClientProvider));
});

final kbDocumentsProvider =
    AsyncNotifierProvider<KBDocumentsNotifier, List<KBDocument>>(() {
  return KBDocumentsNotifier();
});

class KBDocumentsNotifier extends AsyncNotifier<List<KBDocument>> {
  int _page = 1;
  bool _hasMore = true;

  @override
  Future<List<KBDocument>> build() async {
    _page = 1;
    final res = await ref.read(kbApiProvider).getDocuments(page: _page);
    final docs = (res.data['documents'] as List<dynamic>? ?? [])
        .map((e) => KBDocument.fromJson(e as Map<String, dynamic>))
        .toList();
    _hasMore = docs.length >= 20;
    return docs;
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<void> loadMore() async {
    if (!_hasMore) return;
    _page++;
    final res = await ref.read(kbApiProvider).getDocuments(page: _page);
    final docs = (res.data['documents'] as List<dynamic>? ?? [])
        .map((e) => KBDocument.fromJson(e as Map<String, dynamic>))
        .toList();
    _hasMore = docs.length >= 20;
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data([...current, ...docs]);
  }

  Future<void> deleteDocument(int id) async {
    await ref.read(kbApiProvider).deleteDocument(id);
    final current = state.valueOrNull ?? [];
    state = AsyncValue.data(current.where((d) => d.id != id).toList());
  }
}
