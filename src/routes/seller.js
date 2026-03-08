const r=require('express').Router(), c=require('../controllers/sellerController'), {authenticate,requireSeller}=require('../middleware/auth');
r.use(authenticate,requireSeller); r.get('/dashboard',c.getDashboard); r.get('/products',c.getMyProducts); r.get('/orders',c.getMyOrders); r.get('/payouts',c.getMyPayouts); r.patch('/profile',c.updateProfile);
module.exports=r;
