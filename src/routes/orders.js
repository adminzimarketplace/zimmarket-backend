const r=require('express').Router(), c=require('../controllers/orderController'), {authenticate,requireAdmin}=require('../middleware/auth');
r.post('/',authenticate,c.createOrder); r.get('/',authenticate,c.getOrders); r.get('/:id',authenticate,c.getOrder); r.patch('/:id/status',authenticate,requireAdmin,c.updateOrderStatus);
module.exports=r;
