const r=require('express').Router(), c=require('../controllers/paymentController'), {authenticate}=require('../middleware/auth');
r.post('/initiate',authenticate,c.initiatePayment); r.post('/webhook',c.webhook); r.get('/status/:orderId',authenticate,c.getPaymentStatus);
module.exports=r;
