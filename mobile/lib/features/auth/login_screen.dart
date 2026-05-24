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

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loginWithEmail() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty) {
      showErrorToast(context, '请输入邮箱');
      return;
    }
    if (password.isEmpty) {
      showErrorToast(context, '请输入密码');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(authApiProvider).login(email, password);
      final data = res.data;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;
      await ref.read(authStateProvider.notifier).login(user, token);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        showErrorToast(
          context,
          extractErrorMessage(e, context: 'login', fallback: '登录失败'),
        );
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
                    _buildLoginCard(),
                    const SizedBox(height: AppSpacing.xl),
                    _buildFooterLinks(),
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
            Icons.chat_bubble_rounded,
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
          '登录后继续聊天、AI 对话和任务提醒',
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

  Widget _buildLoginCard() {
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
                  '登录账号',
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppThemeHelper.textPrimary(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '使用已注册的邮箱和密码进入。',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppThemeHelper.textSecondary(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                _buildLoginForm(),
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
          Expanded(child: _buildModeButton('登录', selected: true)),
          const SizedBox(width: 4),
          Expanded(
            child: _buildModeButton(
              '注册',
              selected: false,
              onTap: () => context.go('/register'),
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

  Widget _buildLoginForm() {
    return Column(
      children: [
        _buildTextField(
          controller: _emailController,
          hintText: '邮箱',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: AppSpacing.lg),
        _buildTextField(
          controller: _passwordController,
          hintText: '密码',
          icon: Icons.lock_outlined,
          obscureText: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _loginWithEmail(),
        ),
        const SizedBox(height: AppSpacing.xl),
        _buildLoginButton(onPressed: _loginWithEmail),
      ],
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

  Widget _buildLoginButton({required VoidCallback onPressed}) {
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
                  '登录',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildFooterLinks() {
    return Column(
      children: [
        TextButton(
          onPressed: () => context.go('/register'),
          child: Text(
            '还没有账号？去注册',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
        ),
        TextButton(
          onPressed: () => context.go('/reset-password'),
          child: Text(
            '忘记密码？',
            style: GoogleFonts.inter(
              color: Colors.white70,
              fontWeight: FontWeight.w500,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }
}
