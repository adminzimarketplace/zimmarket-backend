const prisma = require('../config/prisma');
const { sendSMS } = require('../utils/sms');
const { createNotification } = require('../utils/notifications');
const getDashboard = async (req,res) => {
  try {
    const [totalOrders,pendingOrders,totalSellers,totalCustomers,recentOrders,fin] = await Promise.all([prisma.order.count(),prisma.order.count({where:{status:{in:['RECEIVED','UNDER_REVIEW']}}}),prisma.seller.count({where:{isApproved:true}}),prisma.user.count({where:{role:'CUSTOMER'}}),prisma.order.findMany({take:10,orderBy:{createdAt:'desc'},include:{customer:{select:{name:true,phone:true}},items:{include:{product:{select:{name:true}}}}}}),prisma.payment.aggregate({where:{status:'PAID'},_sum:{amount:true}})]);
    const pp = await prisma.payout.aggregate({where:{status:'PENDING'},_sum:{netAmount:true}});
    res.json({stats:{totalOrders,pendingOrders,totalSellers,totalCustomers,totalRevenue:fin._sum.amount||0,pendingPayouts:pp._sum.netAmount||0},recentOrders});
  } catch(e) { res.status(500).json({error:'Dashboard failed'}); }
};
const getSellers = async (req,res) => {
  const {approved,page=1,limit=20} = req.query; const where = approved!==undefined ? {isApproved:approved==='true'} : {};
  const [sellers,total] = await Promise.all([prisma.seller.findMany({where,include:{user:{select:{name:true,phone:true,email:true,isActive:true,createdAt:true}}},skip:(page-1)*limit,take:Number(limit),orderBy:{createdAt:'desc'}}),prisma.seller.count({where})]);
  res.json({sellers,total});
};
const updateSeller = async (req,res) => {
  const {isApproved,commissionRate} = req.body;
  const seller = await prisma.seller.update({where:{id:req.params.id},data:{...(isApproved!==undefined&&{isApproved}),...(commissionRate!==undefined&&{commissionRate:parseFloat(commissionRate)})},include:{user:true}});
  if (isApproved===true) { await sendSMS(seller.user.phone,'ZimMarket: Your seller account is approved! Start listing products.'); await createNotification(seller.user.id,'SELLER_APPROVED','Approved!','You can now add products.'); }
  res.json({message:'Updated',seller});
};
const getPendingProducts = async (req,res) => { const products = await prisma.product.findMany({where:{isApproved:false,isActive:true},include:{seller:{select:{businessName:true}},category:true},orderBy:{createdAt:'desc'}}); res.json(products); };
const reviewProduct = async (req,res) => {
  const {isApproved,rejectionReason} = req.body;
  const p = await prisma.product.update({where:{id:req.params.id},data:{isApproved,...(!isApproved&&rejectionReason&&{isActive:false})},include:{seller:{include:{user:true}}}});
  const msg = isApproved ? 'Your product "'+p.name+'" is approved and live!' : 'Product "'+p.name+'" not approved. Reason: '+(rejectionReason||'Does not meet guidelines');
  await sendSMS(p.seller.user.phone,'ZimMarket: '+msg); await createNotification(p.seller.user.id,isApproved?'PRODUCT_APPROVED':'PRODUCT_REJECTED','Product Review',msg);
  res.json({message:'Reviewed',product:p});
};
const getFinancialReport = async (req,res) => {
  try {
    const {from,to} = req.query; const df = {}; if (from) df.gte = new Date(from); if (to) df.lte = new Date(to); const dw = Object.keys(df).length ? {createdAt:df} : {};
    const [ts,tc,pp,sp,ps] = await Promise.all([prisma.payment.aggregate({where:{status:'PAID',...dw},_sum:{amount:true}}),prisma.payout.aggregate({where:dw,_sum:{commission:true}}),prisma.payout.aggregate({where:{status:'PENDING'},_sum:{netAmount:true}}),prisma.payout.aggregate({where:{status:'SENT'},_sum:{netAmount:true}}),prisma.payout.groupBy({by:['sellerId'],_sum:{grossAmount:true,commission:true,netAmount:true},where:{status:'PENDING',...dw}})]);
    const sellers = await prisma.seller.findMany({where:{id:{in:ps.map(p=>p.sellerId)}},select:{id:true,businessName:true}});
    const sm = Object.fromEntries(sellers.map(s=>[s.id,s.businessName]));
    res.json({totalSales:ts._sum.amount||0,totalCommission:tc._sum.commission||0,pendingPayouts:pp._sum.netAmount||0,sentPayouts:sp._sum.netAmount||0,sellerBreakdown:ps.map(p=>({sellerId:p.sellerId,businessName:sm[p.sellerId]||'Unknown',grossSales:p._sum.grossAmount,commission:p._sum.commission,netOwed:p._sum.netAmount}))});
  } catch(e) { res.status(500).json({error:'Report failed'}); }
};
const markPayoutSent = async (req,res) => {
  const {reference} = req.body;
  const p = await prisma.payout.update({where:{id:req.params.id},data:{status:'SENT',reference,paidAt:new Date()},include:{seller:{include:{user:true}}}});
  await sendSMS(p.seller.user.phone,'ZimMarket: Payout $'+p.netAmount.toFixed(2)+' sent! Ref: '+reference);
  res.json({message:'Payout marked sent',payout:p});
};
const getUsers = async (req,res) => {
  const {role,search,page=1,limit=20} = req.query; const where = {}; if (role) where.role = role; if (search) where.OR = [{name:{contains:search,mode:'insensitive'}},{phone:{contains:search}}];
  const [users,total] = await Promise.all([prisma.user.findMany({where,select:{id:true,name:true,phone:true,email:true,role:true,isActive:true,otpVerified:true,createdAt:true},skip:(page-1)*limit,take:Number(limit),orderBy:{createdAt:'desc'}}),prisma.user.count({where})]);
  res.json({users,total});
};
const updateUser = async (req,res) => { const u = await prisma.user.update({where:{id:req.params.id},data:{isActive:req.body.isActive},select:{id:true,name:true,phone:true,isActive:true}}); res.json({message:'Updated',user:u}); };
module.exports = {getDashboard,getSellers,updateSeller,getPendingProducts,reviewProduct,getFinancialReport,markPayoutSent,getUsers,updateUser};
