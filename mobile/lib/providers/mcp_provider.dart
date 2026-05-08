import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/mcp_api.dart';
import '../data/models/mcp_server.dart';
import 'auth_provider.dart';

final mcpApiProvider = Provider<MCPApi>((ref) {
  return MCPApi(ref.watch(apiClientProvider));
});

final mcpServersProvider =
    AsyncNotifierProvider<MCPServersNotifier, List<MCPServer>>(() {
  return MCPServersNotifier();
});

class MCPServersNotifier extends AsyncNotifier<List<MCPServer>> {
  @override
  Future<List<MCPServer>> build() async {
    final res = await ref.read(mcpApiProvider).getServers();
    final data = res.data;
    final serversList = data is Map<String, dynamic>
        ? (data['servers'] as List<dynamic>? ?? [])
        : (data as List<dynamic>);
    return serversList
        .map((e) => MCPServer.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }

  Future<void> createServer(Map<String, dynamic> data) async {
    await ref.read(mcpApiProvider).createServer(data);
    refresh();
  }

  Future<void> updateServer(String id, Map<String, dynamic> data) async {
    await ref.read(mcpApiProvider).updateServer(id, data);
    refresh();
  }

  Future<void> deleteServer(String id) async {
    await ref.read(mcpApiProvider).deleteServer(id);
    refresh();
  }

  Future<Map<String, dynamic>> testServer(String id) async {
    final res = await ref.read(mcpApiProvider).testServer(id);
    return res.data as Map<String, dynamic>;
  }

  Future<void> refreshTools(String id) async {
    await ref.read(mcpApiProvider).refreshTools(id);
    refresh();
  }
}
