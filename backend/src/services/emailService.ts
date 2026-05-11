import nodemailer from 'nodemailer';
import redis from '../utils/redis';
import { generateVerificationCode } from '../utils/verificationCode';

// Key 前缀
const VERIFY_CODE_PREFIX = 'email:verify:';
const RATE_LIMIT_EMAIL_PREFIX = 'rate:email:';

// 过期时间（秒）
const CODE_EXPIRE = 300; // 验证码 5 分钟
const EMAIL_RATE_LIMIT = 60; // 同一邮箱 60 秒内只能发一次

class EmailService {
    private transporter: nodemailer.Transporter | null = null;

    private getTransporter(): nodemailer.Transporter {
        if (!this.transporter) {
            this.transporter = nodemailer.createTransport({
                host: process.env.ALIYUN_SMTP_HOST,
                port: parseInt(process.env.ALIYUN_SMTP_PORT || '465'),
                secure: true,
                auth: {
                    user: process.env.ALIYUN_SMTP_USER,
                    pass: process.env.ALIYUN_SMTP_PASS
                }
            });
        }
        return this.transporter;
    }

    async checkRateLimit(email: string): Promise<{ allowed: boolean; message: string }> {
        const emailKey = `${RATE_LIMIT_EMAIL_PREFIX}${email}`;
        if (await redis.exists(emailKey)) {
            const ttl = await redis.ttl(emailKey);
            return { allowed: false, message: `请 ${ttl} 秒后再试` };
        }
        return { allowed: true, message: '' };
    }

    async setRateLimit(email: string): Promise<void> {
        const emailKey = `${RATE_LIMIT_EMAIL_PREFIX}${email}`;
        await redis.setex(emailKey, EMAIL_RATE_LIMIT, '1');
    }

    async saveVerifyCode(email: string, code: string): Promise<void> {
        const key = `${VERIFY_CODE_PREFIX}${email}`;
        await redis.setex(key, CODE_EXPIRE, code);
    }

    async verifyCode(email: string, code: string, deleteOnSuccess: boolean = true): Promise<boolean> {
        const key = `${VERIFY_CODE_PREFIX}${email}`;
        const stored = await redis.get(key);
        if (stored && stored === code) {
            if (deleteOnSuccess) {
                await redis.del(key);
            }
            return true;
        }
        return false;
    }

    async deleteVerifyCode(email: string): Promise<void> {
        const key = `${VERIFY_CODE_PREFIX}${email}`;
        await redis.del(key);
    }

    async sendEmail(toEmail: string, code: string): Promise<boolean> {
        const subject = 'Mini Chat - 邮箱验证码';

        const htmlBody = `
            <div style="max-width: 480px; margin: 0 auto; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; background: #2c2c2c; color: #fff; border-radius: 14px; font-size: 24px; font-weight: bold;">MC</div>
                </div>
                <h2 style="text-align: center; color: #2c2c2c; margin-bottom: 8px;">邮箱验证码</h2>
                <p style="text-align: center; color: #666; margin-bottom: 24px;">您正在注册 Mini Chat 账号</p>
                <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c2c2c;">${code}</span>
                </div>
                <p style="text-align: center; color: #999; font-size: 14px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
            </div>
        `;

        const mailOptions = {
            from: `"${process.env.ALIYUN_SMTP_SENDER_NAME || 'Mini Chat'}" <${process.env.ALIYUN_SMTP_USER}>`,
            to: toEmail,
            subject: subject,
            html: htmlBody
        };

        try {
            await this.getTransporter().sendMail(mailOptions);
            return true;
        } catch (e) {
            console.error('Email send failed:', e);
            return false;
        }
    }

    async sendVerifyEmail(email: string): Promise<{ success: boolean; message: string }> {
        // 检查频率限制
        const { allowed, message } = await this.checkRateLimit(email);
        if (!allowed) {
            return { success: false, message };
        }

        // 生成验证码
        const code = generateVerificationCode();

        // 先发送邮件，成功后再保存验证码和设置频率限制
        const success = await this.sendEmail(email, code);
        if (!success) {
            return { success: false, message: '邮件发送失败，请稍后再试' };
        }

        // 邮件发送成功后才保存验证码和设置频率限制
        await this.saveVerifyCode(email, code);
        await this.setRateLimit(email);

        return { success: true, message: '验证码已发送' };
    }

    async verifyEmail(email: string, code: string): Promise<boolean> {
        return this.verifyCode(email, code);
    }
}

export default new EmailService();