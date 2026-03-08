const prisma = require('../config/prisma');
const fetch = require('node-fetch');
const crypto = require('crypto');
const hash = (vals,key) => crypto.createHash('md5').update(Object.values(vals).join('')+key).digest('hex').toUpperCase();
const initiatePayment = async (req,res) => {
  try {
    const {orderId,method} = req.body;
    const order = await prisma.order.findUnique({where:{id:orderId},include:{customer:true,items:{include:{product:true}}}});
    if (!order) return res.status(404).json({error:'Order not found'});
    const id=process.env.PAYNOW_INTEGRATION_ID, key=process.env.PAYNOW_INTEGRATION_KEY;
    const ref='ZIMMARKET-'+order.id.slice(0,8).toUpperCase(), items=order.items.map(i=>i.product.name+' x'+i.qty).join(', '), amount=order.totalAmount.toFixed(2);
    if (['ecocash','onemoney','telecash'].includes(method)) {
      const p={id,reference:ref,amount,additionalinfo:items.substring(0,100),returnurl:process.env.PAYNOW_RETURN_URL,resulturl:process.env.PAYNOW_RESULT_URL,authemail:order.customer.email||'',phone:order.customer.phone,method,status:'Message'};
      p.hash=hash(p,key);
      const r=await fetch('https://www.paynow.co.zw/interface/remotetransaction',{method:'POST',body:new URLSearchParams(p),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
      const params=new URLSearchParams(await r.text());
      if (params.get('status')==='Ok') { await prisma.payment.update({where:{orderId},data:{gatewayRef:params.get('pollurl'),method}}); return res.json({success:true,message:'Check your '+method.toUpperCase()+' for a payment prompt'}); }
      return res.status(400).json({error:params.get('error')||'Payment failed'});
    }
    const p={id,reference:ref,amount,additionalinfo:items.substring(0,100),returnurl:process.env.PAYNOW_RETURN_URL,resulturl:process.env.PAYNOW_RESULT_URL,authemail:order.customer.email||'',status:'Message'};
    p.hash=hash(p,key);
    const r=await fetch('https://www.paynow.co.zw/interface/initiatetransaction',{method:'POST',body:new URLSearchParams(p),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
    const params=new URLSearchParams(await r.text());
    if (params.get('status')==='Ok') { await prisma.payment.update({where:{orderId},data:{gatewayRef:params.get('pollurl'),method:'card'}}); return res.json({success:true,redirectUrl:params.get('browserurl')}); }
    res.status(400).json({error:'Payment initiation failed'});
  } catch(e) { console.error(e); res.status(500).json({error:'Payment failed'}); }
};
const webhook = async (req,res) => {
  try {
    const params=req.body, received=params.hash, fields={...params}; delete fields.hash;
    if (received!==hash(fields,process.env.PAYNOW_INTEGRATION_KEY)) return res.status(400).send('Invalid hash');
    const status=params.status?.toLowerCase(), ref=params.reference?.replace('ZIMMARKET-','').toLowerCase();
    const payment=await prisma.payment.findFirst({where:{order:{id:{startsWith:ref}}},include:{order:true}});
    if (!payment) return res.status(404).send('Not found');
    if (status==='paid'||status==='awaiting delivery') { await prisma.payment.update({where:{id:payment.id},data:{status:'PAID',gatewayRef:params.paynowreference}}); await prisma.order.update({where:{id:payment.orderId},data:{paymentRef:params.paynowreference}}); }
    res.send('OK');
  } catch(e) { res.status(500).send('Error'); }
};
const getPaymentStatus = async (req,res) => { const p=await prisma.payment.findUnique({where:{orderId:req.params.orderId}}); if (!p) return res.status(404).json({error:'Not found'}); res.json(p); };
module.exports = {initiatePayment,webhook,getPaymentStatus};
