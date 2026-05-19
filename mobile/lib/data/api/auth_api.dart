import 'package:dio/dio.dart';
import 'api_client.dart';

class AuthApi {
  final ApiClient _client;

  AuthApi(this._client);

  Future<Response> login(String email, String password) {
    return _client.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
  }

  Future<Response> loginPhone(String phone, String code) {
    return _client.dio.post('/auth/login-phone', data: {
      'phone': phone,
      'code': code,
    });
  }

  Future<Response> loginByEmailCode(String email, String code) {
    return _client.dio.post('/auth/login-email-code', data: {
      'email': email,
      'code': code,
    });
  }

  Future<Response> register(String username, String email, String password, String code) {
    return _client.dio.post('/auth/register', data: {
      'username': username,
      'email': email,
      'password': password,
      'code': code,
    });
  }

  Future<Response> sendVerificationEmail(String email, String type) {
    return _client.dio.post('/auth/send-verification', data: {
      'email': email,
      'type': type,
    });
  }

  Future<Response> registerPhone(String username, String phone, String code, {String? email, String? password}) {
    return _client.dio.post('/auth/register-phone', data: {
      'username': username,
      'phone': phone,
      'code': code,
      if (email != null && email.isNotEmpty) 'email': email,
      if (password != null && password.isNotEmpty) 'password': password,
    });
  }

  Future<Response> sendCode(String phone, String type) {
    return _client.dio.post('/auth/send-code', data: {
      'phone': phone,
      'type': type,
    });
  }

  Future<Response> resetPasswordPhone(String phone, String code, String newPassword) {
    return _client.dio.post('/auth/reset-password-phone', data: {
      'phone': phone,
      'code': code,
      'newPassword': newPassword,
    });
  }

  Future<Response> getMe() {
    return _client.dio.get('/auth/me');
  }
}
