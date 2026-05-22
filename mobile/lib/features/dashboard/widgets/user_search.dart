import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/chat_provider.dart';
import '../../../data/api/user_api.dart';
import '../../../data/models/user.dart';
import '../../../shared/utils/error_utils.dart';
import '../../../shared/utils/toast_utils.dart';

class UserSearch extends ConsumerStatefulWidget {
  const UserSearch({super.key});

  @override
  ConsumerState<UserSearch> createState() => _UserSearchState();
}

class _UserSearchState extends ConsumerState<UserSearch> {
  final _searchController = TextEditingController();
  List<User> _results = [];
  bool _isSearching = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) return;
    setState(() => _isSearching = true);
    try {
      final userApi = UserApi(ref.read(apiClientProvider));
      final res = await userApi.searchUsers(query.trim());
      setState(() {
        _results = (res.data as List<dynamic>)
            .map((e) => User.fromJson(e as Map<String, dynamic>))
            .toList();
      });
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, fallback: '搜索失败'));
      }
    } finally {
      setState(() => _isSearching = false);
    }
  }

  Future<void> _sendRequest(String userId) async {
    try {
      await ref.read(friendsProvider.notifier).sendRequest(userId);
      if (mounted) {
        showSuccessToast(context, '好友请求已发送');
      }
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, fallback: '发送失败'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  decoration: const InputDecoration(
                    hintText: '搜索用户名或邮箱...',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onSubmitted: _search,
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () => _search(_searchController.text),
                child: const Text('搜索'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_isSearching)
            const Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(),
            )
          else if (_results.isEmpty && _searchController.text.isNotEmpty)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Text('未找到用户'),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 300),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _results.length,
                itemBuilder: (context, index) {
                  final user = _results[index];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppTheme.primary.withAlpha(25),
                      child: Text(
                        user.username[0].toUpperCase(),
                        style: const TextStyle(
                            color: AppTheme.primary,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                    title: Text(user.username),
                    subtitle: Text(user.email,
                        style: const TextStyle(fontSize: 12)),
                    trailing: OutlinedButton(
                      onPressed: () => _sendRequest(user.id),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        textStyle: const TextStyle(fontSize: 12),
                      ),
                      child: const Text('添加'),
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
