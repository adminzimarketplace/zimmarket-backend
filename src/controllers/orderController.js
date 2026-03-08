const prisma = require('../config/prisma');
const { sendSMS } = require('../utils/sms');
const { sendPushNotification } = require('../utils/push');
const { createNotification } = require('../utils/notifications');
const createOrder = async (req,res) => {
  try {
    const {items,deliveryAddress,deliveryFee=5,paymentMethod} = req.body;
    let total = deliveryFee; const itemsData = [];
    for (const item of items) {
      const p = await prisma.product.findUnique({where:{id:item.productId},include:{seller:true}});
      if (!p||!p.isActive||!p.isApproved) return res.status(400).json({error:'Product not available'});
      if (p.stockQty < item.qty) return res.status(400).json({error:'Not enough stock for '+p.name});
      const sub = p.price * item.qty; total += sub;
      itemsData.push({productId:p.id,sellerId:p.sellerId,qty:item.qty,unitPrice:p.price,subtotal:sub});
    }
    const order = await prisma.$transaction(async tx => {
      const o = await tx.order.create({data:{customerId:req.user.id,totalAmount:total,deliveryFee,deliveryAddress,paymentMethod,status:'RECEIVED',items:{create:itemsData},payment:{create:{amount:total,method:paymentMethod,status:'PENDING'}}},include:{items:{include:{product:true,seller:true}},customer:true}});
      await tx.orderStatusLog.create({data:{orderId:o.id,toStatus:'RECEIVED',changedById:req.user.id,note:'Order placed'}});
      return o;
    });
    const admins = await prisma.user.findMany({where:{role:'ADMIN'}});
    for (const a of admins) { await createNotification(a.id,'NEW_ORDER','New Order!','Order #'+order.id.slice(0,8).toUpperCase()+' — $'+order.totalAmount.toFixed(2)); if (a.fcmToken) await sendPushNotification(a.fcmToken,'New Order','$'+order.totalAmount.toFixed(2)+' needs review'); }
    await sendSMS(req.user.phone,'ZimMarket: Order #'+order.id.slice(0,8).toUpperCase()+' received! Total $'+order.totalAmount.toFixed(2)+'. We confirm shortly.');
    res.status(201).json({message:'Order placed!',order});
  } catch(e) { console.error(e); res.status(500).json({error:'Failed to place order'}); }
};
const getOrders = async (req,res) => {
  try {
    const {status,page=1,limit=20} = req.query; let where = {};
    if (req.user.role==='CUSTOMER') where.customerId = req.user.id;
    if (req.user.role==='SELLER') where.items = {some:{sellerId:req.user.seller.id}};
    if (status) where.status = status;
    const [orders,total] = await Promise.all([prisma.order.findMany({where,include:{customer:{select:{name:true,phone:true}},items:{include:{product:{select:{name:true,images:true}},seller:{select:{businessName:true}}}},delivery:true,payment:true},orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:Number(limit)}),prisma.order.count({where})]);
    res.json({orders,total,page:Number(page),pages:Math.ceil(total/limit)});
  } catch(e) { res.status(500).json({error:'Failed'}); }
};
const getOrder = async (req,res) => {
  const o = await prisma.order.findUnique({where:{id:req.params.id},include:{customer:{select:{name:true,phone:true,email:true}},items:{include:{product:true,seller:{include:{user:{select:{phone:true}}}}}},delivery:true,payment:true,statusLogs:{orderBy:{createdAt:'asc'}}}});
  if (!o) return res.status(404).json({error:'Not found'});
  if (req.user.role==='CUSTOMER'&&o.customerId!==req.user.id) return res.status(403).json({error:'Access denied'});
  res.json(o);
};
const updateOrderStatus = async (req,res) => {
  try {
    const {status,note,riderName,riderPhone} = req.body;
    const order = await prisma.order.findUnique({where:{id:req.params.id},include:{customer:true,items:{include:{seller:{include:{user:true}},product:true}}}});
    if (!order) return res.status(404).json({error:'Not found'});
    await prisma.$transaction(async tx => {
      await tx.order.update({where:{id:req.params.id},data:{status,adminNote:note}});
      await tx.orderStatusLog.create({data:{orderId:req.params.id,fromStatus:order.status,toStatus:status,changedById:req.user.id,note}});
      if (status==='ASSIGNED'&&riderName) await tx.delivery.upsert({where:{orderId:req.params.id},create:{orderId:req.params.id,riderName,riderPhone,status:'ASSIGNED',assignedAt:new Date()},update:{riderName,riderPhone,status:'ASSIGNED',assignedAt:new Date()}});
      if (status==='DELIVERED') {
        await tx.delivery.upsert({where:{orderId:req.params.id},create:{orderId:req.params.id,status:'DELIVERED',deliveredAt:new Date()},update:{status:'DELIVERED',deliveredAt:new Date()}});
        const sg = {};
        for (const i of order.items) { if(!sg[i.sellerId]) sg[i.sellerId]={seller:i.seller,sub:0}; sg[i.sellerId].sub+=i.subtotal; }
        for (const [sid,d] of Object.entries(sg)) { const comm=(d.sub*d.seller.commissionRate)/100; await tx.payout.create({data:{sellerId:sid,orderId:req.params.id,grossAmount:d.sub,commission:comm,netAmount:d.sub-comm,status:'PENDING'}}); }
      }
    });
    const msgs = {CONFIRMED:'Order #'+req.params.id.slice(0,8).toUpperCase()+' confirmed! Delivery being arranged.',OUT_OF_STOCK:'Sorry, order #'+req.params.id.slice(0,8).toUpperCase()+' is out of stock.',ASSIGNED:'Order assigned to rider '+(riderName||'')+'. Delivery coming!',OUT_FOR_DELIVERY:'Your order is out for delivery!',DELIVERED:'Order delivered! Thank you for shopping with ZimMarket.',CANCELLED:'Order cancelled. '+(note||'')};
    if (msgs[status]) { await sendSMS(order.customer.phone,'ZimMarket: '+msgs[status]); await createNotification(order.customer.id,status,'Order Update',msgs[status]); }
    if (status==='UNDER_REVIEW'||status==='CONFIRMED') { for (const i of order.items) await sendSMS(i.seller.user.phone,'ZimMarket: Order #'+req.params.id.slice(0,8).toUpperCase()+' — confirm stock: '+i.qty+'x '+(i.product?.name||'')); }
    const updated = await prisma.order.findUnique({where:{id:req.params.id},include:{items:true,delivery:true,payment:true}});
    res.json({message:'Updated',order:updated});
  } catch(e) { console.error(e); res.status(500).json({error:'Failed'}); }
};
module.exports = {createOrder,getOrders,getOrder,updateOrderStatus};
