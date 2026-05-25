import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../data/api/upload_api.dart';
import '../../data/models/user.dart';
import '../../features/dashboard/widgets/app_update_prompt.dart';
import '../../providers/auth_provider.dart';
import '../../shared/utils/error_utils.dart';

class ProfileSettingsScreen extends ConsumerStatefulWidget {
  const ProfileSettingsScreen({super.key});

  @override
  ConsumerState<ProfileSettingsScreen> createState() =>
      _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends ConsumerState<ProfileSettingsScreen> {
  final _usernameController = TextEditingController();
  final _picker = ImagePicker();

  bool _initialized = false;
  bool _isSaving = false;
  bool _isUploadingAvatar = false;
  String _avatar = '';
  PackageInfo? _packageInfo;

  @override
  void initState() {
    super.initState();
    _loadPackageInfo();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _loadPackageInfo() async {
    final info = await PackageInfo.fromPlatform();
    if (!mounted) return;
    setState(() {
      _packageInfo = info;
    });
  }

  void _initializeFromUser(User? user) {
    if (_initialized || user == null) return;
    _initialized = true;
    _usernameController.text = user.username;
    _avatar = user.avatar;
  }

  Future<void> _pickAvatar() async {
    final image = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1024,
    );
    if (image == null) return;

    setState(() {
      _isUploadingAvatar = true;
    });

    try {
      final file = await MultipartFile.fromFile(
        image.path,
        filename: image.name,
      );
      final uploadApi = UploadApi(ref.read(apiClientProvider));
      final uploadedImage = await uploadApi.uploadImageFile(file);

      if (!mounted) return;
      setState(() {
        _avatar = uploadedImage.url;
      });
      _showMessage('头像已上传，保存后生效');
    } catch (error) {
      if (mounted) {
        _showMessage(extractErrorMessage(error, fallback: '头像上传失败，请稍后重试'));
      }
      final statusCode =
          error is DioException ? error.response?.statusCode : null;
      final responseBody = error is DioException ? error.response?.data : null;
      debugPrint(
        '[Profile] avatar upload failed: '
        'statusCode=$statusCode response=$responseBody '
        'path=${image.path} name=${image.name} error=$error',
      );
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingAvatar = false;
        });
      }
    }
  }

  Future<void> _saveProfile() async {
    final username = _usernameController.text.trim();
    if (username.length < 2 || username.length > 30) {
      _showMessage('姓名长度必须在 2 到 30 个字符之间');
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final response = await ref.read(userApiProvider).updateMe(
            username: username,
            avatar: _avatar,
          );
      final user = User.fromJson(response.data['user'] as Map<String, dynamic>);
      ref.read(authStateProvider.notifier).setCurrentUser(user);

      if (!mounted) return;
      _showMessage('个人信息已更新');
      context.pop();
    } on DioException catch (error) {
      final data = error.response?.data;
      final message =
          data is Map<String, dynamic> ? data['message'] as String? : null;
      if (mounted) {
        _showMessage(message ?? '保存失败，请稍后重试');
      }
      debugPrint('[Profile] save failed: $error');
    } catch (error) {
      if (mounted) {
        _showMessage('保存失败，请稍后重试');
      }
      debugPrint('[Profile] save failed: $error');
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).valueOrNull;
    _initializeFromUser(user);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          '个人信息',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
      ),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                _buildProfileCard(user),
                const SizedBox(height: AppSpacing.lg),
                _buildVersionCard(),
              ],
            ),
    );
  }

  Widget _buildProfileCard(User user) {
    final avatarUrl = AppConstants.resolveFileUrl(_avatar);

    return Card(
      elevation: 0,
      color: AppThemeHelper.card(context),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: AppThemeHelper.border(context)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                CircleAvatar(
                  radius: 44,
                  backgroundColor: AppColors.primary.withAlpha(20),
                  backgroundImage:
                      avatarUrl.isEmpty ? null : NetworkImage(avatarUrl),
                  child: avatarUrl.isEmpty
                      ? Text(
                          _avatarInitial(user),
                          style: GoogleFonts.inter(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                            fontSize: 28,
                          ),
                        )
                      : null,
                ),
                if (_isUploadingAvatar)
                  const SizedBox(
                    width: 88,
                    height: 88,
                    child: CircularProgressIndicator(strokeWidth: 3),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              alignment: WrapAlignment.center,
              children: [
                OutlinedButton.icon(
                  onPressed: _isUploadingAvatar ? null : _pickAvatar,
                  icon: const Icon(Icons.photo_camera_outlined, size: 18),
                  label: const Text('更换头像'),
                ),
                if (_avatar.isNotEmpty)
                  TextButton.icon(
                    onPressed: _isUploadingAvatar
                        ? null
                        : () {
                            setState(() {
                              _avatar = '';
                            });
                          },
                    icon: const Icon(Icons.close, size: 18),
                    label: const Text('移除头像'),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _usernameController,
              maxLength: 30,
              decoration: const InputDecoration(
                labelText: '姓名',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _buildReadOnlyTile(
              icon: Icons.mail_outline,
              label: '邮箱',
              value: user.email.isEmpty ? '未绑定' : user.email,
            ),
            _buildReadOnlyTile(
              icon: Icons.phone_outlined,
              label: '手机号',
              value: user.phone.isEmpty ? '未绑定' : user.phone,
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed:
                    _isSaving || _isUploadingAvatar ? null : _saveProfile,
                icon: _isSaving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(_isSaving ? '保存中...' : '保存'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVersionCard() {
    final versionText = _packageInfo == null
        ? '读取中...'
        : '${_packageInfo!.version}+${_packageInfo!.buildNumber}';

    return Card(
      elevation: 0,
      color: AppThemeHelper.card(context),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: AppThemeHelper.border(context)),
      ),
      child: ListTile(
        leading: const Icon(Icons.system_update_alt_outlined),
        title: Text(
          '当前版本',
          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(versionText),
        trailing: TextButton(
          onPressed: () => AppUpdatePrompt.check(context, ref, manual: true),
          child: const Text('检查更新'),
        ),
      ),
    );
  }

  Widget _buildReadOnlyTile({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: AppColors.primary),
      title: Text(
        label,
        style: GoogleFonts.inter(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(value),
    );
  }

  String _avatarInitial(User user) {
    final username = user.username.trim();
    if (username.isEmpty) return 'U';
    return username.substring(0, 1).toUpperCase();
  }
}
