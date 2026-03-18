const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { sendSMS } = require('../utils/sms');
const { sendEmail } = require('../utils/email');

const otpStore = new Map();

const tokens = (id) => ({
  accessToken:  jwt.sign({ userId: id }, process.env.JWT_SECRET,         { expiresIn: '15m'  }),
  refreshToken: jwt.sign({ userId: id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d'  }),
});

const register = async (req, res) => {
  try {
    const { name, phone, email, password, role = 'CUSTOMER', businessName, location } = req.body;

    if (await prisma.user.findUnique({ where: { phone } }))
      return res.status(400).json({ error: 'Phone already registered' });

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ error: 'Email already registered' });
    }

    const user = await prisma.user.create({
      data: { name, phone, email, passwordHash: await bcrypt.hash(password, 12), role }
    });

    if (role === 'SELLER' && businessName) {
      await prisma.seller.create({
        data: { userId: user.id, businessName, location: location || '', contactPhone: phone }
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phone, { otp, expires: Date.now() + 600000 });

    // Send OTP via email for CUSTOMER if email provided, otherwise SMS
    if (role === 'CUSTOMER' && email) {
      await sendEmail(email, 'Your ZimMarket OTP Code', `
        <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px">
          <h2 style="color:#15803d;margin-bottom:8px">🛒 ZimMarket</h2>
          <p style="color:#374151">Hi ${name}, welcome to ZimMarket!</p>
          <p style="color:#374151">Your verification code is:</p>
          <div style="background:#fff;border:2px solid #15803d;border-radius:12px;padding:16px;text-align:center;margin:16px 0">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#15803d">${otp}</span>
          </div>
          <p style="color:#6b7280;font-size:13px">This code expires in 10 minutes. Do not share it with anyone.</p>
          <p style="color:#6b7280;font-size:13px">If you did not request this, ignore this email.</p>
        </div>
      `);
    } else {
      await sendSMS(phone, `ZimMarket: Your verification code is ${otp}. Valid 10 minutes.`);
    }

    res.status(201).json({
      message: role === 'CUSTOMER' && email
        ? 'Registered! Check your email for OTP.'
        : 'Registered! Check SMS for OTP.',
      userId: user.id,
      phone,
      otpChannel: role === 'CUSTOMER' && email ? 'email' : 'sms',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const s = otpStore.get(phone);
    if (!s || s.otp !== otp || Date.now() > s.expires)
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    otpStore.delete(phone);
    const user = await prisma.user.update({ where: { phone }, data: { otpVerified: true }, include: { seller: true } });
    const { accessToken, refreshToken } = tokens(user.id);
    res.json({
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, seller: user.seller }
    });
  } catch (e) {
    res.status(500).json({ error: 'Verification failed' });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phone, { otp, expires: Date.now() + 600000 });

    if (user.role === 'CUSTOMER' && user.email) {
      await sendEmail(user.email, 'Your ZimMarket OTP Code', `
        <div style="font-family:sans-serif;padding:24px">
          <h2 style="color:#15803d">ZimMarket OTP</h2>
          <p>Your new verification code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
          <p style="color:#6b7280;font-size:13px">Expires in 10 minutes.</p>
        </div>
      `);
    } else {
      await sendSMS(phone, `ZimMarket: Your new code is ${otp}.`);
    }
    res.json({ message: 'OTP sent' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await prisma.user.findUnique({ where: { phone }, include: { seller: true } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ error: 'Account blocked' });
    if (!await bcrypt.compare(password, user.passwordHash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const { accessToken, refreshToken } = tokens(user.id);
    res.json({
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, otpVerified: user.otpVerified, seller: user.seller }
    });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
};

const refresh = async (req, res) => {
  try {
    const decoded = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
    res.json(tokens(decoded.userId));
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

const updateFcmToken = async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken: req.body.fcmToken } });
  res.json({ message: 'Updated' });
};

module.exports = { register, verifyOtp, resendOtp, login, refresh, updateFcmToken };
