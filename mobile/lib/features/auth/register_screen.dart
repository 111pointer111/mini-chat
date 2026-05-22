import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      '创建账号',
                      style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.white),
                  ),
                  const SizedBox(height: 32),
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
                              Tab(text: '邮箱注册'),
                              Tab(text: '手机注册'),
                            ],
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            height: _tabController.index == 0 ? 420 : 480,
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
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('已有账号？立即登录',
                        style: TextStyle(color: Colors.white)),
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

  Widget _buildEmailTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          TextField(
            controller: _usernameController,
            decoration: const InputDecoration(
              hintText: '用户名',
              prefixIcon: Icon(Icons.person_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            decoration: const InputDecoration(
              hintText: '邮箱地址',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _emailCodeController,
                  decoration: const InputDecoration(
                    hintText: '邮箱验证码',
                    prefixIcon: Icon(Icons.mark_email_read_outlined),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 120,
                child: OutlinedButton(
                  onPressed: _emailCountdown > 0 ? null : _sendEmailCode,
                  child: Text(
                    _emailCountdown > 0 ? '${_emailCountdown}s' : '发送验证码',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordController,
            decoration: const InputDecoration(
              hintText: '密码（至少6位）',
              prefixIcon: Icon(Icons.lock_outlined),
            ),
            obscureText: true,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _confirmPasswordController,
            decoration: const InputDecoration(
              hintText: '确认密码',
              prefixIcon: Icon(Icons.lock_outlined),
            ),
            obscureText: true,
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _registerWithEmail,
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('注册'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhoneTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          TextField(
            controller: _usernameController,
            decoration: const InputDecoration(
              hintText: '用户名',
              prefixIcon: Icon(Icons.person_outlined),
            ),
          ),
          const SizedBox(height: 12),
          PhoneCodeInput(
            phoneController: _phoneController,
            codeController: _codeController,
            codeType: 'register',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phoneEmailController,
            decoration: const InputDecoration(
              hintText: '邮箱（可选）',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phonePasswordController,
            decoration: const InputDecoration(
              hintText: '密码（可选，至少6位）',
              prefixIcon: Icon(Icons.lock_outlined),
            ),
            obscureText: true,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phoneConfirmPasswordController,
            decoration: const InputDecoration(
              hintText: '确认密码',
              prefixIcon: Icon(Icons.lock_outlined),
            ),
            obscureText: true,
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _registerWithPhone,
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('注册'),
            ),
          ),
        ],
      ),
    );
  }
}
