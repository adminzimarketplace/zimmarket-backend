const r=require('express').Router(), multer=require('multer'), cloudinary=require('cloudinary').v2, {authenticate}=require('../middleware/auth');
cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>file.mimetype.startsWith('image/')?cb(null,true):cb(new Error('Images only'))});
r.post('/image',authenticate,upload.single('image'),async(req,res)=>{ if(!req.file) return res.status(400).json({error:'No file'}); const result=await new Promise((resolve,reject)=>cloudinary.uploader.upload_stream({folder:'zimmarket/products'},(e,r)=>e?reject(e):resolve(r)).end(req.file.buffer)); res.json({url:result.secure_url,publicId:result.public_id}); });
module.exports=r;
