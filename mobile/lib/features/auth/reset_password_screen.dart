import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../shared/widgets/phone_code_input.dart';
import '../../shared/utils/error_utils.dart';
import '../../shared/utils/toast_utils.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _isValidPhone(String phone) {
    return RegExp(r'^1[3-9]\d{9}$').hasMatch(phone);
  }

  bool _validateForm() {
    if (!_isValidPhone(_phoneController.text.trim())) {
      _showError('请输入正确的手机号');
      return false;
    }
    if (_codeController.text.trim().isEmpty) {
      _showError('请输入验证码');
      return false;
    }
    if (_newPasswordController.text.isEmpty) {
      _showError('请输入新密码');
      return false;
    }
    if (_newPasswordController.text.length < 6) {
      _showError('密码长度不能少于6位');
      return false;
    }
    if (_newPasswordController.text != _confirmPasswordController.text) {
      _showError('两次密码不一致');
      return false;
    }
    return true;
  }

  void _showError(String message) {
    showErrorToast(context, message);
  }

  Future<void> _resetPassword() async {
    if (!_validateForm()) return;

    setState(() => _isLoading = true);
    try {
      await ref.read(authApiProvider).resetPasswordPhone(
            _phoneController.text.trim(),
            _codeController.text.trim(),
            _newPasswordController.text,
          );
      if (mounted) {
        showSuccessToast(context, '密码重置成功，请重新登录');
        context.go('/login');
      }
    } catch (e) {
      if (mounted) {
        _showError(extractErrorMessage(e, fallback: '重置密码失败'));
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
          decoration: const BoxDecoration(gradient: AppTheme.backgroundGradient),
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: AppSpacing.xxxl),
                    _buildResetCard(),
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
            Icons.lock_reset_rounded,
            size: 56,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          '重置密码',
          style: GoogleFonts.poppins(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '通过手机号验证重置密码',
          style: GoogleFonts.inter(
            fontSize: 16,
            color: Colors.white70,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildResetCard() {
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
              children: [
                PhoneCodeInput(
                  phoneController: _phoneController,
                  codeController: _codeController,
                  codeType: 'reset',
                ),
                const SizedBox(height: AppSpacing.lg),
                _buildTextField(
                  controller: _newPasswordController,
                  hintText: '新密码（至少6位）',
                  icon: Icons.lock_outlined,
                  obscureText: true,
                ),
                const SizedBox(height: AppSpacing.lg),
                _buildTextField(
                  controller: _confirmPasswordController,
                  hintText: '确认密码',
                  icon: Icons.lock_outlined,
                  obscureText: true,
                ),
                const SizedBox(height: AppSpacing.xl),
                _buildResetButton(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    bool obscureText = false,
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
        obscureText: obscureText,
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

  Widget _buildResetButton() {
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
          onPressed: _isLoading ? null : _resetPassword,
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
                  '重置密码',
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
        '返回登录',
        style: GoogleFonts.inter(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 15,
        ),
      ),
    );
  }
}
