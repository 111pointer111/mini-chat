import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/ai_provider.dart';
import '../../providers/ai_provider_provider.dart';
import '../../shared/utils/toast_utils.dart';
import '../../shared/utils/error_utils.dart';

class AdminAIProvidersScreen extends ConsumerStatefulWidget {
  const AdminAIProvidersScreen({super.key});

  @override
  ConsumerState<AdminAIProvidersScreen> createState() =>
      _AdminAIProvidersScreenState();
}

class _AdminAIProvidersScreenState
    extends ConsumerState<AdminAIProvidersScreen> {
  Future<void> _showProviderDialog({AIProvider? existing}) async {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final baseUrlCtrl = TextEditingController(text: existing?.baseURL ?? '');
    final apiKeyCtrl = TextEditingController();
    final modelNameCtrl =
        TextEditingController(text: existing?.modelName ?? '');
    final embBaseUrlCtrl =
        TextEditingController(text: existing?.embeddingBaseURL ?? '');
    final embApiKeyCtrl =
        TextEditingController(text: existing?.embeddingApiKey ?? '');
    final embModelCtrl =
        TextEditingController(text: existing?.embeddingModel ?? '');
    final embDimCtrl = TextEditingController(
        text: existing?.embeddingDimensions?.toString() ?? '');
    final groupIdCtrl =
        TextEditingController(text: existing?.groupId ?? '');
    bool enabled = existing?.enabled ?? true;
    bool isDefault = existing?.isDefault ?? false;
    bool showEmbedding = existing?.embeddingModel != null;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text(existing != null ? '编辑 Provider' : '添加 Provider'),
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
                      controller: baseUrlCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Base URL *',
                        hintText: 'https://api.openai.com/v1',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: apiKeyCtrl,
                      decoration: InputDecoration(
                        labelText: existing != null ? 'API Key（留空不修改）' : 'API Key *',
                        hintText: 'sk-...',
                      ),
                      obscureText: true,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: modelNameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Model Name *',
                        hintText: 'gpt-4o',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: groupIdCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Group ID（可选）',
                        hintText: '用于分组筛选',
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('启用',
                                style: TextStyle(fontSize: 14)),
                            value: enabled,
                            activeColor: AppTheme.primary,
                            onChanged: (v) =>
                                setDialogState(() => enabled = v),
                          ),
                        ),
                        Expanded(
                          child: SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('默认',
                                style: TextStyle(fontSize: 14)),
                            value: isDefault,
                            activeColor: AppTheme.primary,
                            onChanged: (v) =>
                                setDialogState(() => isDefault = v),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      children: [
                        const Text('Embedding 配置',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        const Spacer(),
                        TextButton(
                          onPressed: () => setDialogState(
                              () => showEmbedding = !showEmbedding),
                          child: Text(showEmbedding ? '收起' : '展开'),
                        ),
                      ],
                    ),
                    if (showEmbedding) ...[
                      const SizedBox(height: 8),
                      TextField(
                        controller: embBaseUrlCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Embedding Base URL',
                          hintText: '留空则使用主 Base URL',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: embApiKeyCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Embedding API Key',
                          hintText: '留空则使用主 API Key',
                        ),
                        obscureText: true,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: embModelCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Embedding Model',
                          hintText: 'text-embedding-3-small',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: embDimCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Embedding Dimensions',
                          hintText: '1536',
                        ),
                        keyboardType: TextInputType.number,
                      ),
                    ],
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
      final baseUrl = baseUrlCtrl.text.trim();
      final modelName = modelNameCtrl.text.trim();
      if (name.isEmpty || baseUrl.isEmpty || modelName.isEmpty) {
        showErrorToast(context, '名称、Base URL 和 Model Name 不能为空');
        return;
      }

      final data = <String, dynamic>{
        'name': name,
        'baseURL': baseUrl,
        'modelName': modelName,
        'enabled': enabled,
        'isDefault': isDefault,
      };

      final apiKey = apiKeyCtrl.text.trim();
      if (apiKey.isNotEmpty) data['apiKey'] = apiKey;

      final groupId = groupIdCtrl.text.trim();
      if (groupId.isNotEmpty) data['groupId'] = groupId;

      if (showEmbedding) {
        final embBaseUrl = embBaseUrlCtrl.text.trim();
        final embApiKey = embApiKeyCtrl.text.trim();
        final embModel = embModelCtrl.text.trim();
        final embDim = int.tryParse(embDimCtrl.text.trim());
        if (embBaseUrl.isNotEmpty) data['embeddingBaseURL'] = embBaseUrl;
        if (embApiKey.isNotEmpty) data['embeddingApiKey'] = embApiKey;
        if (embModel.isNotEmpty) data['embeddingModel'] = embModel;
        if (embDim != null) data['embeddingDimensions'] = embDim;
      }

      try {
        if (existing != null) {
          await ref
              .read(adminProvidersProvider.notifier)
              .updateProvider(existing.id, data);
        } else {
          await ref.read(adminProvidersProvider.notifier).create(data);
        }
        if (mounted) {
          showSuccessToast(context, existing != null ? '已更新' : '已创建');
        }
      } catch (e) {
        if (mounted) showErrorToast(context, extractErrorMessage(e, fallback: '保存失败'));
      }
    }
  }

  Future<void> _deleteProvider(AIProvider provider) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: Text('确定要删除「${provider.name}」吗？'),
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
        await ref
            .read(adminProvidersProvider.notifier)
            .delete(provider.id);
        if (mounted) showSuccessToast(context, '已删除');
      } catch (e) {
        if (mounted) showErrorToast(context, extractErrorMessage(e, fallback: '删除失败'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(adminProvidersProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
        title: const Text('AI Provider 管理'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: '添加 Provider',
            onPressed: () => _showProviderDialog(),
          ),
        ],
      ),
      body: providersAsync.when(
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
                    ref.read(adminProvidersProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh),
                label: const Text('重试'),
              ),
            ],
          ),
        ),
        data: (providers) {
          if (providers.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.smart_toy_outlined,
                      size: 64, color: Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text('暂无 Provider',
                      style: TextStyle(
                          fontSize: 16, color: Colors.grey[500])),
                  const SizedBox(height: 8),
                  Text('点击右上角 + 添加',
                      style: TextStyle(
                          fontSize: 13, color: Colors.grey[400])),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () =>
                ref.read(adminProvidersProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: providers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) =>
                  _buildProviderCard(providers[index]),
            ),
          );
        },
      ),
    );
  }

  Widget _buildProviderCard(AIProvider provider) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: provider.enabled
                    ? AppTheme.primary.withAlpha(20)
                    : Colors.grey.withAlpha(20),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.smart_toy,
                size: 24,
                color: provider.enabled ? AppTheme.primary : Colors.grey,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          provider.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 15),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (provider.isDefault)
                        _badge('默认', AppTheme.primary),
                      if (!provider.enabled)
                        _badge('已禁用', Colors.grey),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    provider.baseURL,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    provider.modelName,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert,
                  size: 20, color: AppTheme.textSecondary),
              padding: EdgeInsets.zero,
              onSelected: (value) {
                switch (value) {
                  case 'edit':
                    _showProviderDialog(existing: provider);
                    break;
                  case 'delete':
                    _deleteProvider(provider);
                    break;
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'edit',
                  child: Row(
                    children: [
                      Icon(Icons.edit_outlined, size: 18),
                      SizedBox(width: 8),
                      Text('编辑'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline,
                          size: 18, color: Colors.red),
                      SizedBox(width: 8),
                      Text('删除', style: TextStyle(color: Colors.red)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(String label, Color color) {
    return Container(
      margin: const EdgeInsets.only(left: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
