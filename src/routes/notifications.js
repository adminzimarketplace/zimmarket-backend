const r=require('express').Router(), prisma=require('../config/prisma'), {authenticate}=require('../middleware/auth');
r.use(authenticate);
r.get('/',async(req,res)=>{ const n=await prisma.notification.findMany({where:{userId:req.user.id},orderBy:{createdAt:'desc'},take:50}); res.json(n); });
r.patch('/:id/read',async(req,res)=>{ await prisma.notification.update({where:{id:req.params.id},data:{isRead:true}}); res.json({message:'Read'}); });
r.patch('/read-all',async(req,res)=>{ await prisma.notification.updateMany({where:{userId:req.user.id},data:{isRead:true}}); res.json({message:'Done'}); });
module.exports=r;
