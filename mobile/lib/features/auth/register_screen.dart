import 'dart:async';
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
import '../../shared/widgets/phone_code_input.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _emailCodeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _phoneEmailController = TextEditingController();
  final _phonePasswordController = TextEditingController();
  final _phoneConfirmPasswordController = TextEditingController();
  bool _isLoading = false;
  int _emailCountdown = 0;
  Timer? _emailTimer;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _emailCodeController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
    _phoneEmailController.dispose();
    _phonePasswordController.dispose();
    _phoneConfirmPasswordController.dispose();
    _emailTimer?.cancel();
    super.dispose();
  }

  bool _isValidPhone(String phone) {
    return RegExp(r'^1[3-9]\d{9}$').hasMatch(phone);
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  bool _validateEmailForm() {
    if (_usernameController.text.trim().isEmpty) {
      _showError('请输入用户名');
      return false;
    }
    if (_emailController.text.trim().isEmpty) {
      _showError('请输入邮箱');
      return false;
    }
    if (!_isValidEmail(_emailController.text.trim())) {
      _showError('请输入正确的邮箱地址');
      return false;
    }
    if (_emailCodeController.text.trim().isEmpty) {
      _showError('请输入邮箱验证码');
      return false;
    }
    if (_passwordController.text.isEmpty) {
      _showError('请输入密码');
      return false;
    }
    if (_passwordController.text.length < 6) {
      _showError('密码长度不能少于6位');
      return false;
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      _showError('两次密码不一致');
      return false;
    }
    return true;
  }

  bool _validatePhoneForm() {
    if (_usernameController.text.trim().isEmpty) {
      _showError('请输入用户名');
      return false;
    }
    if (!_isValidPhone(_phoneController.text.trim())) {
      _showError('请输入正确的手机号');
      return false;
    }
    if (_codeController.text.trim().isEmpty) {
      _showError('请输入验证码');
      return false;
    }
    if (_phonePasswordController.text.isNotEmpty) {
      if (_phonePasswordController.text.length < 6) {
        _showError('密码长度不能少于6位');
        return false;
      }
      if (_phonePasswordController.text != _phoneConfirmPasswordController.text) {
        _showError('两次密码不一致');
        return false;
      }
    }
    return true;
  }

  void _showError(String message) {
    showErrorToast(context, message);
  }

  void _startEmailCountdown() {
    setState(() => _emailCountdown = 60);
    _emailTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_emailCountdown <= 1) {
        timer.cancel();
        setState(() => _emailCountdown = 0);
      } else {
        setState(() => _emailCountdown--);
      }
    });
  }

  Future<void> _sendEmailCode() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showError('请先输入邮箱');
      return;
    }
    if (!_isValidEmail(email)) {
      _showError('请输入正确的邮箱地址');
      return;
    }
    try {
      await ref.read(authApiProvider).sendVerificationEmail(email, 'register');
      _startEmailCountdown();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('验证码已发送')),
        );
      }
    } catch (e) {
      if (mounted) {
        _showError(extractErrorMessage(e, fallback: '发送验证码失败'));
      }
    }
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
            _codeController.text.trim(),
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
            size: 56,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          '创建账号',
          style: GoogleFonts.poppins(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '加入 Mini-Chat，开始畅聊',
          style: GoogleFonts.inter(
            fontSize: 16,
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
              children: [
                _buildTabBar(),
                const SizedBox(height: AppSpacing.xl),
                SizedBox(
                  height: _tabController.index == 0 ? 440 : 500,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildEmailTab(),
                      _buildPhoneTab(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppThemeHelper.isDark(context)
            ? AppColors.primary.withAlpha(26)
            : AppColors.primary.withAlpha(13),
        borderRadius: AppRadius.mdAll,
      ),
      child: TabBar(
        controller: _tabController,
        labelColor: Colors.white,
        unselectedLabelColor: AppThemeHelper.textPrimary(context),
        indicator: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.primary, AppColors.accent],
          ),
          borderRadius: AppRadius.smAll,
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withAlpha(102),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        dividerColor: Colors.transparent,
        labelStyle: GoogleFonts.inter(
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
        unselectedLabelStyle: GoogleFonts.inter(
          fontWeight: FontWeight.w500,
          fontSize: 14,
        ),
        tabs: const [
          Tab(text: '邮箱注册'),
          Tab(text: '手机注册'),
        ],
      ),
    );
  }

  Widget _buildEmailTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          _buildTextField(
            controller: _usernameController,
            hintText: '用户名',
            icon: Icons.person_outlined,
          ),
          const SizedBox(height: AppSpacing.lg),
          _buildTextField(
            controller: _emailController,
            hintText: '邮箱地址',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: AppSpacing.lg),
          _buildCodeRow(),
          const SizedBox(height: AppSpacing.lg),
          _buildTextField(
            controller: _passwordController,
            hintText: '密码（至少6位）',
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
          _buildRegisterButton(onPressed: _registerWithEmail),
        ],
      ),
    );
  }

  Widget _buildPhoneTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          _buildTextField(
            controller: _usernameController,
            hintText: '用户名',
            icon: Icons.person_outlined,
          ),
          const SizedBox(height: AppSpacing.lg),
          PhoneCodeInput(
            phoneController: _phoneController,
            codeController: _codeController,
            codeType: 'register',
          ),
          const SizedBox(height: AppSpacing.lg),
          _buildTextField(
            controller: _phoneEmailController,
            hintText: '邮箱（可选）',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: AppSpacing.lg),
          _buildTextField(
            controller: _phonePasswordController,
            hintText: '密码（可选，至少6位）',
            icon: Icons.lock_outlined,
            obscureText: true,
          ),
          const SizedBox(height: AppSpacing.lg),
          _buildTextField(
            controller: _phoneConfirmPasswordController,
            hintText: '确认密码',
            icon: Icons.lock_outlined,
            obscureText: true,
          ),
          const SizedBox(height: AppSpacing.xl),
          _buildRegisterButton(onPressed: _registerWithPhone),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    TextInputType? keyboardType,
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
        keyboardType: keyboardType,
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

  Widget _buildCodeRow() {
    return Row(
      children: [
        Expanded(
          child: _buildTextField(
            controller: _emailCodeController,
            hintText: '邮箱验证码',
            icon: Icons.mark_email_read_outlined,
            keyboardType: TextInputType.number,
          ),
        ),
        const SizedBox(width: AppSpacing.lg),
        SizedBox(
          width: 120,
          child: Container(
            decoration: BoxDecoration(
              gradient: _emailCountdown > 0
                  ? null
                  : const LinearGradient(
                      colors: [AppColors.primary, AppColors.accent],
                    ),
              borderRadius: AppRadius.mdAll,
              boxShadow: _emailCountdown > 0
                  ? null
                  : [
                      BoxShadow(
                        color: AppColors.primary.withAlpha(77),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
            ),
            child: OutlinedButton(
              onPressed: _emailCountdown > 0 ? null : _sendEmailCode,
              style: OutlinedButton.styleFrom(
                backgroundColor: _emailCountdown > 0 ? Colors.grey.shade100 : Colors.transparent,
                side: BorderSide.none,
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.mdAll,
                ),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: Text(
                _emailCountdown > 0 ? '${_emailCountdown}s' : '发送验证码',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _emailCountdown > 0 ? AppColors.textSecondaryLight : Colors.white,
                ),
              ),
            ),
          ),
        ),
      ],
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
        '已有账号？立即登录',
        style: GoogleFonts.inter(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 15,
        ),
      ),
    );
  }
}
