const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { sendSMS } = require('../utils/sms');
const otpStore = new Map();
const tokens = (id) => ({ accessToken: jwt.sign({userId:id}, process.env.JWT_SECRET, {expiresIn:'15m'}), refreshToken: jwt.sign({userId:id}, process.env.JWT_REFRESH_SECRET, {expiresIn:'30d'}) });
const register = async (req,res) => {
  try {
    const {name,phone,email,password,role='CUSTOMER',businessName,location} = req.body;
    if (await prisma.user.findUnique({where:{phone}})) return res.status(400).json({error:'Phone already registered'});
    const user = await prisma.user.create({ data:{name,phone,email,passwordHash:await bcrypt.hash(password,12),role} });
    if (role==='SELLER' && businessName) await prisma.seller.create({ data:{userId:user.id,businessName,location:location||'',contactPhone:phone} });
    const otp = Math.floor(100000+Math.random()*900000).toString();
    otpStore.set(phone,{otp,expires:Date.now()+600000});
    await sendSMS(phone,'ZimMarket: Your verification code is ' + otp + '. Valid 10 minutes.');
    res.status(201).json({message:'Registered! Check SMS for OTP.',userId:user.id,phone});
  } catch(e) { console.error(e); res.status(500).json({error:'Registration failed'}); }
};
const verifyOtp = async (req,res) => {
  try {
    const {phone,otp} = req.body;
    const s = otpStore.get(phone);
    if (!s||s.otp!==otp||Date.now()>s.expires) return res.status(400).json({error:'Invalid or expired OTP'});
    otpStore.delete(phone);
    const user = await prisma.user.update({where:{phone},data:{otpVerified:true},include:{seller:true}});
    const {accessToken,refreshToken} = tokens(user.id);
    res.json({accessToken,refreshToken,user:{id:user.id,name:user.name,phone:user.phone,email:user.email,role:user.role,seller:user.seller}});
  } catch(e) { res.status(500).json({error:'Verification failed'}); }
};
const resendOtp = async (req,res) => {
  const {phone} = req.body; const otp = Math.floor(100000+Math.random()*900000).toString();
  otpStore.set(phone,{otp,expires:Date.now()+600000});
  await sendSMS(phone,'ZimMarket: Your new code is ' + otp);
  res.json({message:'OTP sent'});
};
const login = async (req,res) => {
  try {
    const {phone,password} = req.body;
    const user = await prisma.user.findUnique({where:{phone},include:{seller:true}});
    if (!user) return res.status(401).json({error:'Invalid credentials'});
    if (!user.isActive) return res.status(403).json({error:'Account blocked'});
    if (!await bcrypt.compare(password,user.passwordHash)) return res.status(401).json({error:'Invalid credentials'});
    const {accessToken,refreshToken} = tokens(user.id);
    res.json({accessToken,refreshToken,user:{id:user.id,name:user.name,phone:user.phone,email:user.email,role:user.role,otpVerified:user.otpVerified,seller:user.seller}});
  } catch(e) { res.status(500).json({error:'Login failed'}); }
};
const refresh = async (req,res) => {
  try { const decoded = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET); res.json(tokens(decoded.userId)); }
  catch { res.status(401).json({error:'Invalid refresh token'}); }
};
const updateFcmToken = async (req,res) => { await prisma.user.update({where:{id:req.user.id},data:{fcmToken:req.body.fcmToken}}); res.json({message:'Updated'}); };
module.exports = {register,verifyOtp,resendOtp,login,refresh,updateFcmToken};
