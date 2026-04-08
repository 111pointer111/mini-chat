import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import smsService from '../services/smsService';

const generateToken = (user: IUser) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    );
};

export const register = async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required' });
        }

        // Validate lengths
        if (username.length < 2 || username.length > 30) {
            return res.status(400).json({ message: 'Username must be between 2 and 30 characters' });
        }
        if (password.length < 6 || password.length > 100) {
            return res.status(400).json({ message: 'Password must be between 6 and 100 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email or username already exists' });
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password, // Hashed by pre-save hook
            provider: 'local'
        });

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                _id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user (select password as it's excluded by default)
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            token,
            user: {
                _id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        // req.user is set by auth middleware
        const user = await User.findById(req.user!.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            user: {
                _id: user._id.toString(),
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Send SMS verification code
export const sendSmsCode = async (req: Request, res: Response) => {
    try {
        const { phone, type } = req.body;

        if (!phone || !type) {
            return res.status(400).json({ message: '手机号和类型不能为空' });
        }

        // Validate type
        if (!['register', 'login', 'bind', 'reset'].includes(type)) {
            return res.status(400).json({ message: '非法参数' });
        }

        // Validate phone format (China mobile)
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ message: '手机号格式不正确' });
        }

        // Check if phone exists for register type
        if (type === 'register') {
            const existingUser = await User.findOne({ phone });
            if (existingUser) {
                return res.status(400).json({ message: '该手机号已注册' });
            }
        }

        // Check if phone exists for login type
        if (type === 'login') {
            const existingUser = await User.findOne({ phone });
            if (!existingUser) {
                return res.status(400).json({ message: '该手机号未注册' });
            }
        }

        const result = await smsService.sendVerificationCode(phone, type);
        if (result.success) {
            res.json({ message: result.message });
        } else {
            res.status(400).json({ message: result.message });
        }
    } catch (error) {
        console.error('SendSmsCode error:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// Register by phone
export const registerByPhone = async (req: Request, res: Response) => {
    try {
        const { phone, code, username, email, password } = req.body;

        if (!phone || !code || !username) {
            return res.status(400).json({ message: '手机号、验证码和用户名不能为空' });
        }

        if (username.length < 2 || username.length > 30) {
            return res.status(400).json({ message: '用户名长度需要在2-30个字符之间' });
        }

        // Verify code
        const isValid = await smsService.verifyCode(phone, code, 'register');
        if (!isValid) {
            return res.status(400).json({ message: '验证码错误或已过期' });
        }

        // Check if username exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: '用户名已存在' });
        }

        // Check if email exists (if provided)
        if (email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ message: '该邮箱已被注册' });
            }
        }

        // Create user
        const user = await User.create({
            username,
            phone,
            email: email || undefined,
            password: password || undefined,
            provider: 'phone',
            isPhoneVerified: true
        });

        const token = generateToken(user);

        res.status(201).json({
            message: '注册成功',
            token,
            user: {
                _id: user._id.toString(),
                username: user.username,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('RegisterByPhone error:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// Login by phone
export const loginByPhone = async (req: Request, res: Response) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ message: '手机号和验证码不能为空' });
        }

        // Verify code
        const isValid = await smsService.verifyCode(phone, code, 'login');
        if (!isValid) {
            return res.status(400).json({ message: '验证码错误或已过期' });
        }

        // Find user
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(400).json({ message: '用户不存在' });
        }

        const token = generateToken(user);

        res.json({
            message: '登录成功',
            token,
            user: {
                _id: user._id.toString(),
                username: user.username,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('LoginByPhone error:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// Bind phone to existing account
export const bindPhone = async (req: Request, res: Response) => {
    try {
        const { phone, code } = req.body;
        const userId = req.user!.id;

        if (!phone || !code) {
            return res.status(400).json({ message: '手机号和验证码不能为空' });
        }

        // Verify code
        const isValid = await smsService.verifyCode(phone, code, 'bind');
        if (!isValid) {
            return res.status(400).json({ message: '验证码错误或已过期' });
        }

        // Check if phone already bound
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ message: '该手机号已被其他账号绑定' });
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            userId,
            { phone, isPhoneVerified: true },
            { new: true }
        );

        res.json({
            message: '绑定成功',
            user: {
                _id: user?._id?.toString(),
                username: user?.username,
                phone: user?.phone,
                role: user?.role,
                avatar: user?.avatar
            }
        });
    } catch (error) {
        console.error('BindPhone error:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// Reset password by phone
export const resetPasswordByPhone = async (req: Request, res: Response) => {
    try {
        const { phone, code, newPassword } = req.body;

        if (!phone || !code || !newPassword) {
            return res.status(400).json({ message: '手机号、验证码和新密码不能为空' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: '密码长度至少6位' });
        }

        // Verify code
        const isValid = await smsService.verifyCode(phone, code, 'reset');
        if (!isValid) {
            return res.status(400).json({ message: '验证码错误或已过期' });
        }

        // Find user by phone
        const user = await User.findOne({ phone }).select('+password');
        if (!user) {
            return res.status(400).json({ message: '该手机号未注册' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: '密码重置成功' });
    } catch (error) {
        console.error('ResetPasswordByPhone error:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};
