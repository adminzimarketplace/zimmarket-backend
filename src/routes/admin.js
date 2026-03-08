const r=require('express').Router(), c=require('../controllers/adminController'), {authenticate,requireAdmin}=require('../middleware/auth');
r.use(authenticate,requireAdmin); r.get('/dashboard',c.getDashboard); r.get('/sellers',c.getSellers); r.patch('/sellers/:id',c.updateSeller); r.get('/products/pending',c.getPendingProducts); r.patch('/products/:id/review',c.reviewProduct); r.get('/reports/financials',c.getFinancialReport); r.patch('/payouts/:id',c.markPayoutSent); r.get('/users',c.getUsers); r.patch('/users/:id',c.updateUser);
module.exports=r;
