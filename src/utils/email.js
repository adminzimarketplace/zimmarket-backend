const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  try {
    // If no email config, just log it
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'placeholder') {
      console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
      return { success: true, mock: true };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
      },
    });

    await transporter.sendMail({
      from: `"ZimMarket" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    return { success: true };
  } catch (e) {
    console.error('Email error:', e.message);
    return { success: false };
  }
};

module.exports = { sendEmail };
