import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';

import '../../core/theme.dart';
import '../../data/models/kb_document.dart';
import '../../providers/group_provider.dart';
import '../../providers/chat_provider.dart';
import '../../shared/utils/toast_utils.dart';

class GroupKBScreen extends ConsumerStatefulWidget {
  final String groupId;

  const GroupKBScreen({super.key, required this.groupId});

  @override
  ConsumerState<GroupKBScreen> createState() => _GroupKBScreenState();
}

class _GroupKBScreenState extends ConsumerState<GroupKBScreen> {
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    ref
        .read(groupKBDocumentsProvider(widget.groupId).notifier)
        .refresh(widget.groupId);
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
      await ref
          .read(groupApiProvider)
          .uploadGroupKBDocument(widget.groupId, formData);
      if (mounted) {
        showSuccessToast(context, '上传成功');
        ref
            .read(groupKBDocumentsProvider(widget.groupId).notifier)
            .refresh(widget.groupId);
      }
    } catch (e) {
      if (mounted) showErrorToast(context, '上传失败');
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
        await ref.read(groupApiProvider).importGroupKBFromUrl(
              widget.groupId,
              url,
              title: titleController.text.trim().isEmpty
                  ? null
                  : titleController.text.trim(),
            );
        if (mounted) {
          showSuccessToast(context, '导入任务已提交');
          ref
              .read(groupKBDocumentsProvider(widget.groupId).notifier)
              .refresh(widget.groupId);
        }
      } catch (e) {
        if (mounted) showErrorToast(context, '导入失败');
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
        await ref
            .read(groupKBDocumentsProvider(widget.groupId).notifier)
            .deleteDocument(widget.groupId, doc.id);
        if (mounted) showSuccessToast(context, '已删除');
      } catch (e) {
        if (mounted) showErrorToast(context, '删除失败');
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
    final docsAsync =
        ref.watch(groupKBDocumentsProvider(widget.groupId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('群知识库'),
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
      body: Stack(
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
                    onPressed: () => ref
                        .read(groupKBDocumentsProvider(widget.groupId)
                            .notifier)
                        .refresh(widget.groupId),
                    icon: const Icon(Icons.refresh),
                    label: const Text('重试'),
                  ),
                ],
              ),
            ),
            data: (docs) {
              if (docs.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.library_books_outlined,
                          size: 64, color: Colors.grey[300]),
                      const SizedBox(height: 16),
                      Text('暂无文档',
                          style: TextStyle(
                              fontSize: 16, color: Colors.grey[500])),
                      const SizedBox(height: 8),
                      Text('点击右上角按钮上传文件或导入 URL',
                          style: TextStyle(
                              fontSize: 13, color: Colors.grey[400])),
                    ],
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () => ref
                    .read(
                        groupKBDocumentsProvider(widget.groupId).notifier)
                    .refresh(widget.groupId),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) =>
                      _buildDocCard(docs[index]),
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
