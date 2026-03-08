const prisma = require('../config/prisma');
const { createNotification } = require('../utils/notifications');
const listProducts = async (req,res) => {
  try {
    const {search,categoryId,minPrice,maxPrice,page=1,limit=20} = req.query;
    const where = {isActive:true,isApproved:true,stockQty:{gt:0}};
    if (search) where.OR = [{name:{contains:search,mode:'insensitive'}},{description:{contains:search,mode:'insensitive'}}];
    if (categoryId) where.categoryId = categoryId;
    if (minPrice||maxPrice) { where.price={}; if(minPrice) where.price.gte=parseFloat(minPrice); if(maxPrice) where.price.lte=parseFloat(maxPrice); }
    const [products,total] = await Promise.all([prisma.product.findMany({where,include:{seller:{select:{businessName:true,location:true}},category:{select:{name:true}}},orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:Number(limit)}),prisma.product.count({where})]);
    res.json({products,total,page:Number(page),pages:Math.ceil(total/limit)});
  } catch(e) { res.status(500).json({error:'Failed to fetch products'}); }
};
const getProduct = async (req,res) => {
  const p = await prisma.product.findUnique({where:{id:req.params.id},include:{seller:{select:{businessName:true,location:true,contactPhone:true}},category:true}});
  if (!p) return res.status(404).json({error:'Not found'}); res.json(p);
};
const createProduct = async (req,res) => {
  try {
    const {name,description,price,stockQty,categoryId,images=[],variants} = req.body;
    const sellerId = req.user.seller?.id;
    if (!sellerId) return res.status(403).json({error:'Seller profile not found'});
    if (!req.user.seller.isApproved) return res.status(403).json({error:'Seller pending approval'});
    const product = await prisma.product.create({data:{sellerId,name,description,price:parseFloat(price),stockQty:parseInt(stockQty),categoryId:categoryId||null,images,variants:variants||null,isApproved:false}});
    const admins = await prisma.user.findMany({where:{role:'ADMIN'}});
    for (const a of admins) await createNotification(a.id,'PRODUCT_REVIEW','New Product for Review','"'+name+'" by '+req.user.seller.businessName);
    res.status(201).json({message:'Submitted for approval',product});
  } catch(e) { console.error(e); res.status(500).json({error:'Failed'}); }
};
const updateProduct = async (req,res) => {
  try {
    const p = await prisma.product.findUnique({where:{id:req.params.id}});
    if (!p) return res.status(404).json({error:'Not found'});
    if (p.sellerId!==req.user.seller?.id && req.user.role!=='ADMIN') return res.status(403).json({error:'Access denied'});
    const {name,description,price,stockQty,categoryId,images,variants,isActive} = req.body;
    const updated = await prisma.product.update({where:{id:req.params.id},data:{...(name&&{name}),...(description&&{description}),...(price&&{price:parseFloat(price)}),...(stockQty!==undefined&&{stockQty:parseInt(stockQty)}),...(categoryId&&{categoryId}),...(images&&{images}),...(variants&&{variants}),...(isActive!==undefined&&{isActive})}});
    res.json({message:'Updated',product:updated});
  } catch(e) { res.status(500).json({error:'Failed'}); }
};
const deleteProduct = async (req,res) => {
  const p = await prisma.product.findUnique({where:{id:req.params.id}});
  if (!p) return res.status(404).json({error:'Not found'});
  if (p.sellerId!==req.user.seller?.id && req.user.role!=='ADMIN') return res.status(403).json({error:'Access denied'});
  await prisma.product.update({where:{id:req.params.id},data:{isActive:false}}); res.json({message:'Removed'});
};
const getCategories = async (req,res) => { const cats = await prisma.category.findMany({orderBy:{name:'asc'}}); res.json(cats); };
module.exports = {listProducts,getProduct,createProduct,updateProduct,deleteProduct,getCategories};
