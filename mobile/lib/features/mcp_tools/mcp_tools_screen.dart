import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/mcp_server.dart';
import '../../providers/mcp_provider.dart';
import '../../shared/utils/toast_utils.dart';

class MCPToolsScreen extends ConsumerStatefulWidget {
  const MCPToolsScreen({super.key});

  @override
  ConsumerState<MCPToolsScreen> createState() => _MCPToolsScreenState();
}

class _MCPToolsScreenState extends ConsumerState<MCPToolsScreen> {
  MCPServer? _selectedServer;
  String? _actionLoading;

  @override
  void initState() {
    super.initState();
    ref.read(mcpServersProvider.notifier).refresh();
  }

  Future<void> _showServerDialog({MCPServer? existing}) async {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final descCtrl =
        TextEditingController(text: existing?.description ?? '');
    final urlCtrl = TextEditingController(text: existing?.url ?? '');
    String transport = existing?.transport ?? 'http';
    String authMode = 'none';
    final bearerCtrl = TextEditingController();
    final customHeaderKeyCtrl = TextEditingController();
    final customHeaderValueCtrl = TextEditingController();
    bool enabled = existing?.enabled ?? true;

    if (existing?.headers.isNotEmpty == true) {
      final first = existing!.headers.first;
      if (first['key']?.toString().toLowerCase() == 'authorization') {
        authMode = 'bearer';
        bearerCtrl.text = first['value']?.toString() ?? '';
      } else {
        authMode = 'custom';
        customHeaderKeyCtrl.text = first['key']?.toString() ?? '';
        customHeaderValueCtrl.text = first['value']?.toString() ?? '';
      }
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title:
                Text(existing != null ? '编辑 MCP 服务' : '添加 MCP 服务'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: '名称 *'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: descCtrl,
                    decoration:
                        const InputDecoration(labelText: '描述'),
                    maxLines: 2,
                    minLines: 1,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: transport,
                    decoration:
                        const InputDecoration(labelText: '传输方式'),
                    items: const [
                      DropdownMenuItem(
                          value: 'http', child: Text('Streamable HTTP')),
                      DropdownMenuItem(value: 'sse', child: Text('SSE')),
                    ],
                    onChanged: (v) {
                      if (v != null) setDialogState(() => transport = v);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: urlCtrl,
                    decoration: const InputDecoration(
                      labelText: 'MCP Server URL *',
                      hintText: 'https://example.com/mcp',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: authMode,
                    decoration:
                        const InputDecoration(labelText: '认证方式'),
                    items: const [
                      DropdownMenuItem(
                          value: 'none', child: Text('无认证')),
                      DropdownMenuItem(
                          value: 'bearer',
                          child: Text('Bearer Token')),
                      DropdownMenuItem(
                          value: 'custom',
                          child: Text('自定义 Header')),
                    ],
                    onChanged: (v) {
                      if (v != null) setDialogState(() => authMode = v);
                    },
                  ),
                  if (authMode == 'bearer') ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: bearerCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Bearer Token',
                        hintText: 'your-token-here',
                      ),
                      obscureText: true,
                    ),
                  ],
                  if (authMode == 'custom') ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: customHeaderKeyCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Header 名称',
                        hintText: 'X-Custom-Auth',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: customHeaderValueCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Header 值',
                        hintText: 'your-value',
                      ),
                      obscureText: true,
                    ),
                  ],
                  const SizedBox(height: 16),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('启用',
                        style: TextStyle(fontSize: 14)),
                    subtitle: const Text('启用后，AI 对话会加载这个服务的工具',
                        style: TextStyle(fontSize: 12)),
                    value: enabled,
                    activeColor: AppTheme.primary,
                    onChanged: (v) =>
                        setDialogState(() => enabled = v),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('取消'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('保存'),
              ),
            ],
          ),
        );
      },
    );

    if (confirmed == true && mounted) {
      final name = nameCtrl.text.trim();
      final url = urlCtrl.text.trim();
      if (name.isEmpty || url.isEmpty) {
        showErrorToast(context, '名称和 URL 不能为空');
        return;
      }

      List<Map<String, dynamic>> headers = [];
      if (authMode == 'bearer' && bearerCtrl.text.trim().isNotEmpty) {
        headers = [
          {
            'key': 'Authorization',
            'value': 'Bearer ${bearerCtrl.text.trim()}'
          }
        ];
      } else if (authMode == 'custom') {
        final key = customHeaderKeyCtrl.text.trim();
        final value = customHeaderValueCtrl.text.trim();
        if (key.isNotEmpty && value.isNotEmpty) {
          headers = [
            {'key': key, 'value': value}
          ];
        }
      }

      final data = {
        'name': name,
        'description': descCtrl.text.trim(),
        'transport': transport,
        'url': url,
        'headers': headers,
        'enabled': enabled,
      };

      try {
        if (existing != null) {
          await ref
              .read(mcpServersProvider.notifier)
              .updateServer(existing.id, data);
        } else {
          await ref.read(mcpServersProvider.notifier).createServer(data);
        }
        if (mounted) {
          showSuccessToast(context, existing != null ? '已更新' : '已添加');
        }
      } catch (e) {
        if (mounted) showErrorToast(context, '操作失败');
      }
    }
  }

  Future<void> _testConnection(MCPServer server) async {
    setState(() => _actionLoading = 'test:${server.id}');
    try {
      final result = await ref
          .read(mcpServersProvider.notifier)
          .testServer(server.id);
      if (mounted) {
        final success = result['success'] == true;
        final toolCount = result['toolCount'] ?? 0;
        showSuccessToast(
            context,
            success
                ? '连接成功，发现 $toolCount 个工具'
                : '连接失败');
      }
    } catch (e) {
      if (mounted) showErrorToast(context, '测试失败');
    } finally {
      if (mounted) setState(() => _actionLoading = null);
    }
  }

  Future<void> _refreshTools(MCPServer server) async {
    setState(() => _actionLoading = 'refresh:${server.id}');
    try {
      await ref.read(mcpServersProvider.notifier).refreshTools(server.id);
      if (mounted) showSuccessToast(context, '工具列表已刷新');
    } catch (e) {
      if (mounted) showErrorToast(context, '刷新失败');
    } finally {
      if (mounted) setState(() => _actionLoading = null);
    }
  }

  Future<void> _toggleServer(MCPServer server, bool value) async {
    try {
      await ref.read(mcpServersProvider.notifier).updateServer(
            server.id,
            {'enabled': value},
          );
      if (_selectedServer?.id == server.id) {
        final servers =
            ref.read(mcpServersProvider).valueOrNull ?? [];
        final updated = servers.where((s) => s.id == server.id);
        if (updated.isNotEmpty) {
          setState(() => _selectedServer = updated.first);
        }
      }
    } catch (e) {
      if (mounted) showErrorToast(context, '更新失败');
    }
  }

  Future<void> _deleteServer(MCPServer server) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除 MCP 服务'),
        content: Text(
            '确定删除「${server.name}」吗？删除后 AI 将无法再调用它的工具。'),
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
    if (confirm == true && mounted) {
      try {
        await ref.read(mcpServersProvider.notifier).deleteServer(server.id);
        if (_selectedServer?.id == server.id) {
          setState(() => _selectedServer = null);
        }
        if (mounted) showSuccessToast(context, '已删除');
      } catch (e) {
        if (mounted) showErrorToast(context, '删除失败');
      }
    }
  }

  void _selectServer(MCPServer server) {
    setState(() => _selectedServer = server);
  }

  void _backToList() {
    setState(() => _selectedServer = null);
  }

  @override
  Widget build(BuildContext context) {
    final serversAsync = ref.watch(mcpServersProvider);

    return Scaffold(
      appBar: _selectedServer != null
          ? _buildDetailAppBar()
          : _buildListAppBar(),
      body: _selectedServer != null
          ? _buildDetailPanel()
          : _buildServerList(serversAsync),
    );
  }

  AppBar _buildListAppBar() {
    final serversAsync = ref.watch(mcpServersProvider);
    final servers = serversAsync.valueOrNull ?? [];
    final enabledCount = servers.where((s) => s.enabled).length;
    final toolCount =
        servers.fold<int>(0, (sum, s) => sum + s.cachedTools.length);

    return AppBar(
      leading: IconButton(
        icon: const Icon(Icons.arrow_back),
        onPressed: () => context.go('/'),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('MCP 工具', style: TextStyle(fontSize: 16)),
          if (servers.isNotEmpty)
            Text(
              '管理当前账号可用的外部工具服务',
              style: TextStyle(
                  fontSize: 11, color: AppTheme.textSecondary),
            ),
        ],
      ),
      actions: [
        if (servers.isNotEmpty) ...[
          Chip(
            avatar: const Icon(Icons.power_settings_new,
                size: 14, color: AppTheme.primary),
            label: Text('$enabledCount 个已启用',
                style: const TextStyle(fontSize: 11)),
            backgroundColor: AppTheme.primary.withAlpha(20),
            padding: EdgeInsets.zero,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          const SizedBox(width: 4),
          Chip(
            avatar: const Icon(Icons.extension,
                size: 14, color: AppTheme.secondary),
            label: Text('$toolCount 个工具',
                style: const TextStyle(fontSize: 11)),
            backgroundColor: AppTheme.secondary.withAlpha(20),
            padding: EdgeInsets.zero,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          const SizedBox(width: 4),
        ],
        IconButton(
          icon: const Icon(Icons.add),
          tooltip: '添加服务',
          onPressed: () => _showServerDialog(),
        ),
      ],
    );
  }

  AppBar _buildDetailAppBar() {
    final server = _selectedServer!;
    return AppBar(
      leading: IconButton(
        icon: const Icon(Icons.arrow_back),
        onPressed: _backToList,
      ),
      title: Text(server.name),
      actions: [
        Switch(
          value: server.enabled,
          activeColor: AppTheme.primary,
          onChanged: (v) => _toggleServer(server, v),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildServerList(AsyncValue<List<MCPServer>> serversAsync) {
    return serversAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
            const SizedBox(height: 12),
            Text('加载失败', style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () =>
                  ref.read(mcpServersProvider.notifier).refresh(),
              icon: const Icon(Icons.refresh),
              label: const Text('重试'),
            ),
          ],
        ),
      ),
      data: (servers) {
        if (servers.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.dns_outlined,
                    size: 64, color: Colors.grey[300]),
                const SizedBox(height: 16),
                Text('暂无 MCP 服务器',
                    style: TextStyle(
                        fontSize: 16, color: Colors.grey[500])),
                const SizedBox(height: 8),
                Text('AI 只会加载已启用服务中的缓存工具',
                    style: TextStyle(
                        fontSize: 13, color: Colors.grey[400])),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => _showServerDialog(),
                  icon: const Icon(Icons.add),
                  label: const Text('添加服务'),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(mcpServersProvider.notifier).refresh(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text(
                  '已注册服务 (${servers.length})',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'AI 只会加载已启用服务中的缓存工具',
                  style: TextStyle(
                      fontSize: 11, color: AppTheme.textSecondary),
                ),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: servers.length,
                  itemBuilder: (context, index) =>
                      _buildServerTile(servers[index]),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildServerTile(MCPServer server) {
    final hasError = server.lastError != null &&
        server.lastError!.isNotEmpty;
    final toolCount = server.cachedTools.length;

    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: server.enabled
              ? AppTheme.primary.withAlpha(25)
              : Colors.grey.withAlpha(25),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(
          Icons.dns,
          size: 22,
          color: server.enabled ? AppTheme.primary : Colors.grey,
        ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              server.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontWeight: FontWeight.w500, fontSize: 14),
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: server.enabled
                  ? const Color(0xFF4CAF50).withAlpha(25)
                  : Colors.grey.withAlpha(25),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              server.enabled ? '启用' : '停用',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: server.enabled
                    ? const Color(0xFF4CAF50)
                    : Colors.grey,
              ),
            ),
          ),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 2),
          Text(
            server.url,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                fontSize: 11, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  border: Border.all(
                      color: AppTheme.primary.withAlpha(60)),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  server.transport.toUpperCase(),
                  style: const TextStyle(
                      fontSize: 10,
                      color: AppTheme.primary,
                      fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  border: Border.all(
                      color: AppTheme.secondary.withAlpha(60)),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '$toolCount 个工具',
                  style: const TextStyle(
                      fontSize: 10,
                      color: AppTheme.secondary,
                      fontWeight: FontWeight.w500),
                ),
              ),
              if (hasError) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.red.withAlpha(20),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber,
                          size: 10, color: Colors.red),
                      SizedBox(width: 2),
                      Text('连接异常',
                          style: TextStyle(
                              fontSize: 10,
                              color: Colors.red,
                              fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
      trailing:
          const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
      onTap: () => _selectServer(server),
    );
  }

  Widget _buildDetailPanel() {
    final server = _selectedServer!;
    final hasError =
        server.lastError != null && server.lastError!.isNotEmpty;
    final hasHeaders = server.headers.isNotEmpty;
    final isTesting = _actionLoading == 'test:${server.id}';
    final isRefreshing = _actionLoading == 'refresh:${server.id}';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with avatar and name
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: hasError
                      ? Colors.red.withAlpha(25)
                      : (server.enabled
                          ? const Color(0xFF4CAF50).withAlpha(25)
                          : Colors.grey.withAlpha(25)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  hasError ? Icons.warning_amber : Icons.check_circle,
                  size: 26,
                  color: hasError
                      ? Colors.red
                      : (server.enabled
                          ? const Color(0xFF4CAF50)
                          : Colors.grey),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      server.name,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            border: Border.all(
                                color: AppTheme.primary.withAlpha(60)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            server.transport.toUpperCase(),
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.primary),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: server.enabled
                                ? const Color(0xFF4CAF50).withAlpha(25)
                                : Colors.grey.withAlpha(25),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            server.enabled
                                ? 'AI 对话中可用'
                                : '已停用',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: server.enabled
                                    ? const Color(0xFF4CAF50)
                                    : Colors.grey),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Description
          if (server.description != null &&
              server.description!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              server.description!,
              style: const TextStyle(
                  fontSize: 13, color: AppTheme.textSecondary),
            ),
          ],

          const SizedBox(height: 16),

          // Status info box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                // Connection status
                Row(
                  children: [
                    Icon(
                      hasError
                          ? Icons.warning_amber
                          : (server.lastConnectedAt != null
                              ? Icons.check_circle
                              : Icons.help_outline),
                      size: 16,
                      color: hasError
                          ? Colors.red
                          : (server.lastConnectedAt != null
                              ? const Color(0xFF4CAF50)
                              : Colors.grey),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        hasError
                            ? '最近连接失败'
                            : (server.lastConnectedAt != null
                                ? '最近连接: ${server.lastConnectedAt!.substring(0, 16).replaceFirst("T", " ")}'
                                : '尚未测试连接'),
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
                if (hasHeaders) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.key,
                          size: 16, color: AppTheme.primary),
                      const SizedBox(width: 8),
                      const Text(
                        '已配置认证 Header',
                        style: TextStyle(
                            fontSize: 12, color: AppTheme.primary),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.link,
                        size: 16, color: AppTheme.textSecondary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        server.url,
                        style: const TextStyle(fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 2,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if (hasError) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.red.withAlpha(15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber,
                      size: 16, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      server.lastError!,
                      style: const TextStyle(
                          fontSize: 12, color: Colors.red),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: isTesting
                      ? null
                      : () => _testConnection(server),
                  icon: isTesting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2))
                      : const Icon(Icons.science, size: 16),
                  label: Text(isTesting ? '测试中...' : '测试连接'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: isRefreshing
                      ? null
                      : () => _refreshTools(server),
                  icon: isRefreshing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.refresh, size: 16),
                  label: Text(isRefreshing ? '刷新中...' : '刷新工具'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () =>
                      _showServerDialog(existing: server),
                  icon: const Icon(Icons.edit_outlined, size: 16),
                  label: const Text('编辑'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _deleteServer(server),
                  icon: const Icon(Icons.delete_outline,
                      size: 16, color: Colors.red),
                  label: const Text('删除',
                      style: TextStyle(color: Colors.red)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Tools list
          Text(
            '工具清单 (${server.cachedTools.length})',
            style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          if (server.cachedTools.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              alignment: Alignment.center,
              child: Column(
                children: [
                  Icon(Icons.extension,
                      size: 40, color: Colors.grey[300]),
                  const SizedBox(height: 12),
                  Text(
                    '测试连接或刷新工具后，AI 才能在对话中看到这些工具。',
                    style: TextStyle(
                        color: Colors.grey[400], fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          else
            ...server.cachedTools.map((tool) => _buildToolCard(tool)),
        ],
      ),
    );
  }

  Widget _buildToolCard(MCPTool tool) {
    final paramCount = tool.inputSchema != null
        ? (tool.inputSchema!['properties'] as Map<String, dynamic>?)
                ?.length ??
            0
        : 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppTheme.secondary.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.build,
                  size: 18, color: AppTheme.secondary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tool.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  Text(
                    tool.description ?? '没有工具描述',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: tool.description != null &&
                              tool.description!.isNotEmpty
                          ? AppTheme.textSecondary
                          : Colors.grey[400],
                      fontStyle: tool.description == null ||
                              tool.description!.isEmpty
                          ? FontStyle.italic
                          : null,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                border: Border.all(
                    color: AppTheme.secondary.withAlpha(60)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '$paramCount 个参数',
                style: const TextStyle(
                    fontSize: 10, color: AppTheme.secondary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
