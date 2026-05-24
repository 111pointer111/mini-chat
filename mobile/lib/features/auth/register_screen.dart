import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme.dart';
import '../../data/models/user.dart';
import '../../providers/auth_provider.dart';
import '../../shared/utils/error_utils.dart';
import '../../shared/utils/toast_utils.dart';
import '../../shared/widgets/email_code_input.dart';
import '../../shared/widgets/phone_code_input.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _emailCodeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _phoneCodeController = TextEditingController();
  final _phoneEmailController = TextEditingController();
  final _phonePasswordController = TextEditingController();

  int _registerTabIndex = 0;
  bool _isLoading = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _emailCodeController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _phoneCodeController.dispose();
    _phoneEmailController.dispose();
    _phonePasswordController.dispose();
    super.dispose();
  }

  bool _isValidPhone(String phone) {
    return RegExp(r'^1[3-9]\d{9}$').hasMatch(phone);
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w\-.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  void _showError(String message) {
    showErrorToast(context, message);
  }

  bool _validateEmailForm() {
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim();
    final code = _emailCodeController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty) {
      _showError('请输入用户名');
      return false;
    }
    if (email.isEmpty) {
      _showError('请输入邮箱');
      return false;
    }
    if (!_isValidEmail(email)) {
      _showError('请输入正确的邮箱地址');
      return false;
    }
    if (code.isEmpty) {
      _showError('请输入邮箱验证码');
      return false;
    }
    if (password.isEmpty) {
      _showError('请输入密码');
      return false;
    }
    if (password.length < 6) {
      _showError('密码长度不能少于6位');
      return false;
    }
    return true;
  }

  bool _validatePhoneForm() {
    final username = _usernameController.text.trim();
    final phone = _phoneController.text.trim();
    final code = _phoneCodeController.text.trim();
    final optionalEmail = _phoneEmailController.text.trim();
    final optionalPassword = _phonePasswordController.text;

    if (username.isEmpty) {
      _showError('请输入用户名');
      return false;
    }
    if (!_isValidPhone(phone)) {
      _showError('请输入正确的手机号');
      return false;
    }
    if (code.isEmpty) {
      _showError('请输入验证码');
      return false;
    }
    if (optionalEmail.isNotEmpty && !_isValidEmail(optionalEmail)) {
      _showError('请输入正确的邮箱地址');
      return false;
    }
    if (optionalPassword.isNotEmpty && optionalPassword.length < 6) {
      _showError('密码长度不能少于6位');
      return false;
    }
    return true;
  }

  Future<void> _registerWithEmail() async {
    if (!_validateEmailForm()) return;

    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(authApiProvider).register(
            _usernameController.text.trim(),
            _emailController.text.trim(),
            _passwordController.text,
            _emailCodeController.text.trim(),
          );
      final data = res.data;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;
      await ref.read(authStateProvider.notifier).login(user, token);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        _showError(extractErrorMessage(e, fallback: '注册失败，请稍后重试'));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _registerWithPhone() async {
    if (!_validatePhoneForm()) return;

    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(authApiProvider).registerPhone(
            _usernameController.text.trim(),
            _phoneController.text.trim(),
            _phoneCodeController.text.trim(),
            email: _phoneEmailController.text.trim().isNotEmpty
                ? _phoneEmailController.text.trim()
                : null,
            password: _phonePasswordController.text.isNotEmpty
                ? _phonePasswordController.text
                : null,
          );
      final data = res.data;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;
      await ref.read(authStateProvider.notifier).login(user, token);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        _showError(extractErrorMessage(e, fallback: '注册失败，请稍后重试'));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: Container(
          decoration:
              const BoxDecoration(gradient: AppTheme.backgroundGradient),
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: AppSpacing.xl),
                    _buildRegisterCard(),
                    const SizedBox(height: AppSpacing.xl),
                    _buildFooterLink(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(51),
            borderRadius: AppRadius.xxlAll,
            border: Border.all(color: Colors.white.withAlpha(77)),
          ),
          child: const Icon(
            Icons.person_add_rounded,
            size: 52,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          'Mini Chat',
          style: GoogleFonts.poppins(
            fontSize: 34,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '选择一种方式创建新账号',
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(
            fontSize: 15,
            color: Colors.white70,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterCard() {
    return ClipRRect(
      borderRadius: AppRadius.xxlAll,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: AppThemeHelper.isDark(context)
                ? AppColors.surfaceDark.withAlpha(230)
                : Colors.white.withAlpha(204),
            borderRadius: AppRadius.xxlAll,
            border: Border.all(
              color: AppThemeHelper.isDark(context)
                  ? AppColors.borderDark
                  : Colors.white.withAlpha(128),
            ),
            boxShadow: AppShadows.lg,
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xxl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildAuthModeSwitch(),
                const SizedBox(height: AppSpacing.xl),
                Text(
                  '注册账号',
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppThemeHelper.textPrimary(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '邮箱注册和手机号注册任选一种。',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppThemeHelper.textSecondary(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                _buildRegisterTabs(),
                const SizedBox(height: AppSpacing.xl),
                if (_registerTabIndex == 0)
                  _buildEmailTab()
                else
                  _buildPhoneTab(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAuthModeSwitch() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppThemeHelper.isDark(context)
            ? AppColors.primary.withAlpha(26)
            : AppColors.primary.withAlpha(13),
        borderRadius: AppRadius.mdAll,
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildModeButton(
              '登录',
              selected: false,
              onTap: () => context.go('/login'),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(child: _buildModeButton('注册', selected: true)),
        ],
      ),
    );
  }

  Widget _buildRegisterTabs() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppThemeHelper.isDark(context)
            ? AppColors.primary.withAlpha(18)
            : AppColors.primary.withAlpha(10),
        borderRadius: AppRadius.mdAll,
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildModeButton(
              '邮箱注册',
              selected: _registerTabIndex == 0,
              onTap: () => setState(() => _registerTabIndex = 0),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: _buildModeButton(
              '手机号注册',
              selected: _registerTabIndex == 1,
              onTap: () => setState(() => _registerTabIndex = 1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeButton(
    String label, {
    required bool selected,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.smAll,
      child: Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(
                  colors: [AppColors.primary, AppColors.accent])
              : null,
          borderRadius: AppRadius.smAll,
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withAlpha(77),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            color:
                selected ? Colors.white : AppThemeHelper.textPrimary(context),
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _buildEmailTab() {
    return Column(
      children: [
        _buildTextField(
          controller: _usernameController,
          hintText: '用户名',
          icon: Icons.person_outlined,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.lg),
        EmailCodeInput(
          emailController: _emailController,
          codeController: _emailCodeController,
          codeType: 'register',
        ),
        const SizedBox(height: AppSpacing.lg),
        _buildTextField(
          controller: _passwordController,
          hintText: '密码（至少6位）',
          icon: Icons.lock_outlined,
          obscureText: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _registerWithEmail(),
        ),
        const SizedBox(height: AppSpacing.xl),
        _buildRegisterButton(onPressed: _registerWithEmail),
      ],
    );
  }

  Widget _buildPhoneTab() {
    return Column(
      children: [
        _buildTextField(
          controller: _usernameController,
          hintText: '用户名',
          icon: Icons.person_outlined,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.lg),
        PhoneCodeInput(
          phoneController: _phoneController,
          codeController: _phoneCodeController,
          codeType: 'register',
        ),
        const SizedBox(height: AppSpacing.lg),
        _buildOptionalInfoPanel(),
        const SizedBox(height: AppSpacing.xl),
        _buildRegisterButton(onPressed: _registerWithPhone),
      ],
    );
  }

  Widget _buildOptionalInfoPanel() {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: Container(
        decoration: BoxDecoration(
          color: AppThemeHelper.isDark(context)
              ? AppColors.primary.withAlpha(18)
              : Colors.white.withAlpha(128),
          borderRadius: AppRadius.mdAll,
          border:
              Border.all(color: AppThemeHelper.border(context).withAlpha(90)),
        ),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          childrenPadding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            0,
            AppSpacing.lg,
            AppSpacing.lg,
          ),
          iconColor: AppColors.primary,
          collapsedIconColor: AppThemeHelper.textSecondary(context),
          title: Text(
            '可选信息：邮箱和密码',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppThemeHelper.textPrimary(context),
            ),
          ),
          children: [
            _buildTextField(
              controller: _phoneEmailController,
              hintText: '邮箱（可选）',
              icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppSpacing.lg),
            _buildTextField(
              controller: _phonePasswordController,
              hintText: '密码（可选，至少6位）',
              icon: Icons.lock_outlined,
              obscureText: true,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _registerWithPhone(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    TextInputType? keyboardType,
    bool obscureText = false,
    TextInputAction? textInputAction,
    ValueChanged<String>? onSubmitted,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppThemeHelper.isDark(context)
            ? AppColors.surfaceDark
            : Colors.white,
        borderRadius: AppRadius.mdAll,
        boxShadow: AppShadows.sm,
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        obscureText: obscureText,
        textInputAction: textInputAction,
        onSubmitted: onSubmitted,
        style: GoogleFonts.inter(
          fontSize: 15,
          color: AppThemeHelper.textPrimary(context),
        ),
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: GoogleFonts.inter(
            color: AppThemeHelper.textSecondary(context),
          ),
          prefixIcon: Icon(icon, color: AppColors.primary),
          border: OutlineInputBorder(
            borderRadius: AppRadius.mdAll,
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: AppThemeHelper.isDark(context)
              ? AppColors.surfaceDark
              : Colors.white,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.lg,
          ),
        ),
      ),
    );
  }

  Widget _buildRegisterButton({required VoidCallback onPressed}) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.primary, AppColors.accent],
          ),
          borderRadius: AppRadius.mdAll,
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withAlpha(102),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ElevatedButton(
          onPressed: _isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.mdAll,
            ),
          ),
          child: _isLoading
              ? const SizedBox(
                  height: 24,
                  width: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              : Text(
                  '注册',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildFooterLink() {
    return TextButton(
      onPressed: () => context.go('/login'),
      child: Text(
        '已有账号？返回登录',
        style: GoogleFonts.inter(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 15,
        ),
      ),
    );
  }
}
