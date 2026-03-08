const r=require('express').Router(), c=require('../controllers/authController'), {authenticate}=require('../middleware/auth');
r.post('/register',c.register); r.post('/login',c.login); r.post('/otp/verify',c.verifyOtp); r.post('/otp/resend',c.resendOtp); r.post('/refresh',c.refresh); r.patch('/fcm-token',authenticate,c.updateFcmToken);
module.exports=r;
