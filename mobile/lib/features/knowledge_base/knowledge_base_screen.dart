import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';

import '../../core/theme.dart';
import '../../data/models/kb_document.dart';
import '../../providers/kb_provider.dart';
import '../../shared/utils/error_utils.dart';
import '../../shared/utils/toast_utils.dart';

class KnowledgeBaseScreen extends ConsumerStatefulWidget {
  const KnowledgeBaseScreen({super.key});

  @override
  ConsumerState<KnowledgeBaseScreen> createState() =>
      _KnowledgeBaseScreenState();
}

class _KnowledgeBaseScreenState extends ConsumerState<KnowledgeBaseScreen> {
  bool _uploading = false;
  final _searchController = TextEditingController();
  bool _isSearching = false;
  Timer? _searchDebounce;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _searchDebounce?.cancel();
    if (query.trim().isEmpty) {
      setState(() => _isSearching = false);
      ref.read(kbSearchResultsProvider.notifier).clear();
      ref.read(kbDocumentsProvider.notifier).refresh();
    } else {
      setState(() => _isSearching = true);
      _searchDebounce = Timer(const Duration(milliseconds: 400), () {
        ref.read(kbSearchResultsProvider.notifier).search(query);
      });
    }
  }

  void _clearSearch() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() => _isSearching = false);
    ref.read(kbSearchResultsProvider.notifier).clear();
    ref.read(kbDocumentsProvider.notifier).refresh();
  }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'pdf', 'docx', 'txt', 'md', 'csv', 'xlsx', 'pptx', 'html'
      ],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.bytes == null) return;

    setState(() => _uploading = true);
    try {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          file.bytes!,
          filename: file.name,
        ),
        'title': file.name,
      });
      await ref.read(kbApiProvider).uploadDocument(formData);
      if (mounted) {
        showSuccessToast(context, '上传成功');
        ref.read(kbDocumentsProvider.notifier).refresh();
      }
    } catch (e) {
      if (mounted) showErrorToast(context, extractErrorMessage(e, fallback: '上传失败'));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _showImportUrlDialog() async {
    final urlController = TextEditingController();
    final titleController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('导入 URL'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: urlController,
              decoration: const InputDecoration(
                labelText: 'URL',
                hintText: 'https://example.com/article',
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: titleController,
              decoration: const InputDecoration(
                labelText: '标题（可选）',
                hintText: '自定义文档标题',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('导入'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final url = urlController.text.trim();
      if (url.isEmpty) {
        showErrorToast(context, '请输入 URL');
        return;
      }
      try {
        await ref.read(kbApiProvider).importFromUrl(
              url,
              title: titleController.text.trim().isEmpty
                  ? null
                  : titleController.text.trim(),
            );
        if (mounted) {
          showSuccessToast(context, '导入任务已提交');
          ref.read(kbDocumentsProvider.notifier).refresh();
        }
      } catch (e) {
        if (mounted) showErrorToast(context, extractErrorMessage(e, fallback: '导入失败'));
      }
    }
  }

  Future<void> _deleteDocument(KBDocument doc) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: Text('确定要删除「${doc.title}」吗？此操作不可撤销。'),
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
        await ref.read(kbDocumentsProvider.notifier).deleteDocument(doc.id);
        if (mounted) showSuccessToast(context, '已删除');
      } catch (e) {
        if (mounted) showErrorToast(context, extractErrorMessage(e, fallback: '删除失败'));
      }
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'ready':
        return const Color(0xFF4CAF50);
      case 'processing':
        return const Color(0xFFFF9800);
      case 'failed':
        return const Color(0xFFe53935);
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'ready':
        return '就绪';
      case 'processing':
        return '处理中';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  }

  IconData _sourceIcon(String source) {
    switch (source) {
      case 'url':
        return Icons.link;
      default:
        return Icons.insert_drive_file;
    }
  }

  @override
  Widget build(BuildContext context) {
    final docsAsync = _isSearching
        ? ref.watch(kbSearchResultsProvider)
        : ref.watch(kbDocumentsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
        title: const Text('知识库'),
        actions: [
          IconButton(
            icon: const Icon(Icons.upload_file),
            tooltip: '上传文件',
            onPressed: _uploading ? null : _pickAndUpload,
          ),
          IconButton(
            icon: const Icon(Icons.link),
            tooltip: '导入 URL',
            onPressed: _showImportUrlDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // 搜索栏
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: '搜索文档...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _isSearching
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 20),
                        onPressed: _clearSearch,
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey[300]!),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                filled: true,
                fillColor: Colors.grey[50],
              ),
              onChanged: _onSearchChanged,
            ),
          ),
          // 文档列表
          Expanded(
            child: Stack(
              children: [
                docsAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline,
                            size: 48, color: Colors.red[300]),
                        const SizedBox(height: 12),
                        Text('加载失败',
                            style: TextStyle(color: Colors.grey[600])),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _isSearching
                              ? () => ref
                                  .read(kbSearchResultsProvider.notifier)
                                  .search(_searchController.text)
                              : () => ref
                                  .read(kbDocumentsProvider.notifier)
                                  .refresh(),
                          icon: const Icon(Icons.refresh),
                          label: const Text('重试'),
                        ),
                      ],
                    ),
                  ),
                  data: (data) {
                    final docs = _isSearching
                        ? data as List<KBDocument>
                        : (data as KBDocumentState).documents;
                    final pagination =
                        _isSearching ? null : (data as KBDocumentState).pagination;

                    if (docs.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.library_books_outlined,
                                size: 64, color: Colors.grey[300]),
                            const SizedBox(height: 16),
                            Text(
                                _isSearching ? '未找到匹配的文档' : '暂无文档',
                                style: TextStyle(
                                    fontSize: 16,
                                    color: Colors.grey[500])),
                            const SizedBox(height: 8),
                            if (!_isSearching)
                              Text('点击右上角按钮上传文件或导入 URL',
                                  style: TextStyle(
                                      fontSize: 13,
                                      color: Colors.grey[400])),
                          ],
                        ),
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: () => _isSearching
                          ? ref
                              .read(kbSearchResultsProvider.notifier)
                              .search(_searchController.text)
                          : ref
                              .read(kbDocumentsProvider.notifier)
                              .refresh(),
                      child: Column(
                        children: [
                          Expanded(
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 8, 16, 8),
                              itemCount: docs.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, index) =>
                                  _buildDocCard(docs[index]),
                            ),
                          ),
                          // 分页控件
                          if (!_isSearching &&
                              pagination != null &&
                              pagination.totalPages > 1)
                            _buildPagination(pagination),
                        ],
                      ),
                    );
                  },
                ),
                if (_uploading)
                  Container(
                    color: Colors.black.withAlpha(80),
                    child: const Center(
                      child: Card(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircularProgressIndicator(),
                              SizedBox(height: 16),
                              Text('正在上传...'),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPagination(KBPagination pagination) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: AppThemeHelper.isDark(context)
            ? AppColors.surfaceDark
            : Colors.white,
        border: Border(
          top: BorderSide(color: AppThemeHelper.divider(context)),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: pagination.page > 1
                ? () => ref
                    .read(kbDocumentsProvider.notifier)
                    .goToPage(pagination.page - 1)
                : null,
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              '${pagination.page} / ${pagination.totalPages}',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: pagination.page < pagination.totalPages
                ? () => ref
                    .read(kbDocumentsProvider.notifier)
                    .goToPage(pagination.page + 1)
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildDocCard(KBDocument doc) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppTheme.primary.withAlpha(20),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_sourceIcon(doc.source),
                  color: AppTheme.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doc.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _statusColor(doc.status).withAlpha(25),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _statusLabel(doc.status),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: _statusColor(doc.status),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${doc.chunkCount} 个分块',
                        style: const TextStyle(
                            fontSize: 12, color: AppTheme.textSecondary),
                      ),
                      if (doc.fileType != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          doc.fileType!.toUpperCase(),
                          style: const TextStyle(
                              fontSize: 11, color: AppTheme.textSecondary),
                        ),
                      ],
                    ],
                  ),
                  if (doc.status == 'failed' && doc.errorMsg != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      doc.errorMsg!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFFe53935)),
                    ),
                  ],
                ],
              ),
            ),
            IconButton(
              icon: Icon(Icons.delete_outline,
                  size: 20, color: Colors.red[400]),
              tooltip: '删除',
              onPressed: () => _deleteDocument(doc),
            ),
          ],
        ),
      ),
    );
  }
}
