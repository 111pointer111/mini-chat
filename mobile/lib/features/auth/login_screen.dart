import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.chat_bubble_rounded,
                        size: 64, color: Colors.white),
                    const SizedBox(height: 16),
                    const Text(
                      'Mini-Chat',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '连接你我，畅聊无限',
                      style: TextStyle(fontSize: 16, color: Colors.white70),
                    ),
                    const SizedBox(height: 40),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          children: [
                            TabBar(
                              controller: _tabController,
                              labelColor: AppTheme.primary,
                              unselectedLabelColor: AppTheme.textSecondary,
                              indicatorColor: AppTheme.primary,
                              tabs: const [
                                Tab(text: '密码登录'),
                                Tab(text: '邮箱验证码'),
                                Tab(text: '手机号'),
                              ],
                            ),
                            const SizedBox(height: 20),
                            SizedBox(
                              height: 220,
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
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => context.go('/register'),
                      child: const Text('没有账号？立即注册',
                          style: TextStyle(color: Colors.white)),
                    ),
                    TextButton(
                      onPressed: () => context.go('/reset-password'),
                      child: const Text('忘记密码？',
                          style: TextStyle(color: Colors.white70)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPasswordTab() {
    return Column(
      children: [
        TextField(
          controller: _emailController,
          decoration: const InputDecoration(
            hintText: '邮箱地址',
            prefixIcon: Icon(Icons.email_outlined),
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _passwordController,
          decoration: const InputDecoration(
            hintText: '密码',
            prefixIcon: Icon(Icons.lock_outlined),
          ),
          obscureText: true,
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _loginWithEmail,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('登录'),
          ),
        ),
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
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _loginWithEmailCode,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('登录'),
          ),
        ),
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
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _loginWithPhone,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('登录'),
          ),
        ),
      ],
    );
  }
}
