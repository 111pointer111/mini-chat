import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../shared/widgets/phone_code_input.dart';

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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('密码重置成功，请重新登录')),
        );
        context.go('/login');
      }
    } catch (e) {
      if (mounted) {
        _showError('重置失败: ${e.toString()}');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.backgroundGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    '重置密码',
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
                          PhoneCodeInput(
                            phoneController: _phoneController,
                            codeController: _codeController,
                            codeType: 'reset',
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _newPasswordController,
                            decoration: const InputDecoration(
                              hintText: '新密码（至少6位）',
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
                              onPressed: _isLoading ? null : _resetPassword,
                              child: _isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white))
                                  : const Text('重置密码'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('返回登录',
                        style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
