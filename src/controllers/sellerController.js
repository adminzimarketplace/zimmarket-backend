const prisma = require('../config/prisma');
const getDashboard = async (req,res) => {
  const sid = req.user.seller?.id; if (!sid) return res.status(403).json({error:'Not a seller'});
  const [tp,ap,pp,orders,earn] = await Promise.all([prisma.product.count({where:{sellerId:sid}}),prisma.product.count({where:{sellerId:sid,isActive:true,isApproved:true}}),prisma.product.count({where:{sellerId:sid,isApproved:false,isActive:true}}),prisma.orderItem.findMany({where:{sellerId:sid},include:{order:{select:{id:true,status:true,createdAt:true}},product:{select:{name:true,images:true}}},orderBy:{order:{createdAt:'desc'}},take:10}),prisma.payout.aggregate({where:{sellerId:sid},_sum:{grossAmount:true,commission:true,netAmount:true}})]);
  const [ppend,psent] = await Promise.all([prisma.payout.aggregate({where:{sellerId:sid,status:'PENDING'},_sum:{netAmount:true}}),prisma.payout.aggregate({where:{sellerId:sid,status:'SENT'},_sum:{netAmount:true}})]);
  res.json({stats:{totalProducts:tp,activeProducts:ap,pendingProducts:pp,totalEarnings:earn._sum.grossAmount||0,totalCommission:earn._sum.commission||0,netEarnings:earn._sum.netAmount||0,pendingPayouts:ppend._sum.netAmount||0,sentPayouts:psent._sum.netAmount||0},recentOrders:orders});
};
const getMyProducts = async (req,res) => { const products = await prisma.product.findMany({where:{sellerId:req.user.seller?.id},include:{category:true},orderBy:{createdAt:'desc'}}); res.json(products); };
const getMyOrders = async (req,res) => { const items = await prisma.orderItem.findMany({where:{sellerId:req.user.seller?.id},include:{order:{include:{customer:{select:{name:true,phone:true}},delivery:true}},product:{select:{name:true,images:true}}},orderBy:{order:{createdAt:'desc'}}}); res.json(items); };
const getMyPayouts = async (req,res) => { const p = await prisma.payout.findMany({where:{sellerId:req.user.seller?.id},include:{order:{select:{id:true,createdAt:true}}},orderBy:{createdAt:'desc'}}); res.json(p); };
const updateProfile = async (req,res) => { const s = await prisma.seller.update({where:{id:req.user.seller?.id},data:{businessName:req.body.businessName,location:req.body.location,contactPhone:req.body.contactPhone}}); res.json({message:'Updated',seller:s}); };
module.exports = {getDashboard,getMyProducts,getMyOrders,getMyPayouts,updateProfile};
