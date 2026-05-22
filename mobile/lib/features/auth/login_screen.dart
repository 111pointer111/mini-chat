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
import '../../shared/widgets/email_code_input.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailCodeEmailController = TextEditingController();
  final _emailCodeController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _emailCodeEmailController.dispose();
    _emailCodeController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
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
        showErrorToast(context, extractErrorMessage(e, context: 'login', fallback: '登录失败'));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loginWithEmailCode() async {
    final email = _emailCodeEmailController.text.trim();
    final code = _emailCodeController.text.trim();
    if (email.isEmpty || code.isEmpty) {
      showErrorToast(context, '请输入邮箱和验证码');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(authApiProvider).loginByEmailCode(email, code);
      final data = res.data;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;
      await ref.read(authStateProvider.notifier).login(user, token);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, context: 'login', fallback: '登录失败'));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loginWithPhone() async {
    final phone = _phoneController.text.trim();
    final code = _codeController.text.trim();
    if (phone.isEmpty) {
      showErrorToast(context, '请输入手机号');
      return;
    }
    if (!RegExp(r'^1[3-9]\d{9}$').hasMatch(phone)) {
      showErrorToast(context, '请输入正确的手机号');
      return;
    }
    if (code.isEmpty) {
      showErrorToast(context, '请输入验证码');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(authApiProvider).loginPhone(phone, code);
      final data = res.data;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;
      await ref.read(authStateProvider.notifier).login(user, token);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        showErrorToast(context, extractErrorMessage(e, context: 'login', fallback: '登录失败'));
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
          decoration: const BoxDecoration(
            gradient: AppTheme.backgroundGradient,
          ),
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: AppSpacing.xxxl),
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
            size: 56,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          'Mini-Chat',
          style: GoogleFonts.poppins(
            fontSize: 36,
            fontWeight: FontWeight.bold,
            color: Colors.white,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '连接你我，畅聊无限',
          style: GoogleFonts.inter(
            fontSize: 16,
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
              children: [
                _buildTabBar(),
                const SizedBox(height: AppSpacing.xl),
                SizedBox(
                  height: 240,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildPasswordTab(),
                      _buildEmailCodeTab(),
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
          fontSize: 13,
        ),
        unselectedLabelStyle: GoogleFonts.inter(
          fontWeight: FontWeight.w500,
          fontSize: 13,
        ),
        tabs: const [
          Tab(text: '密码登录'),
          Tab(text: '邮箱验证码'),
          Tab(text: '手机号'),
        ],
      ),
    );
  }

  Widget _buildPasswordTab() {
    return Column(
      children: [
        _buildTextField(
          controller: _emailController,
          hintText: '邮箱地址',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: AppSpacing.lg),
        _buildTextField(
          controller: _passwordController,
          hintText: '密码',
          icon: Icons.lock_outlined,
          obscureText: true,
        ),
        const SizedBox(height: AppSpacing.xl),
        _buildLoginButton(onPressed: _loginWithEmail),
      ],
    );
  }

  Widget _buildEmailCodeTab() {
    return Column(
      children: [
        EmailCodeInput(
          emailController: _emailCodeEmailController,
          codeController: _emailCodeController,
          codeType: 'login',
        ),
        const SizedBox(height: AppSpacing.xl),
        _buildLoginButton(onPressed: _loginWithEmailCode),
      ],
    );
  }

  Widget _buildPhoneTab() {
    return Column(
      children: [
        PhoneCodeInput(
          phoneController: _phoneController,
          codeController: _codeController,
          codeType: 'login',
        ),
        const SizedBox(height: AppSpacing.xl),
        _buildLoginButton(onPressed: _loginWithPhone),
      ],
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
          fillColor: Colors.white,
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
            '没有账号？立即注册',
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
