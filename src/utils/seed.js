require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
async function main() {
  console.log('Seeding database...');
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'AdminZim123!', 12);
  const admin = await prisma.user.upsert({ where: { phone: process.env.ADMIN_PHONE || '+263771234567' }, update: {}, create: { name:'ZimMarket Admin', phone: process.env.ADMIN_PHONE||'+263771234567', email: process.env.ADMIN_EMAIL||'admin@zimmarket.co.zw', passwordHash: adminHash, role:'ADMIN', otpVerified:true, isActive:true } });
  console.log('Admin created:', admin.phone);
  const cats = ['Electronics','Clothing & Fashion','Food & Groceries','Home & Garden','Health & Beauty','Phones & Accessories','Furniture','Sports & Outdoors','Books & Stationery','Other'];
  for (const name of cats) await prisma.category.upsert({ where:{name}, update:{}, create:{name} });
  console.log('Categories created');
  const sh = await bcrypt.hash('Seller123!', 12);
  const su = await prisma.user.upsert({ where:{phone:'+263772000001'}, update:{}, create:{name:'Demo Seller',phone:'+263772000001',email:'seller@demo.co.zw',passwordHash:sh,role:'SELLER',otpVerified:true,isActive:true} });
  await prisma.seller.upsert({ where:{userId:su.id}, update:{}, create:{userId:su.id,businessName:'Demo Shop Zimbabwe',location:'Harare CBD',contactPhone:'+263772000001',isApproved:true,commissionRate:10} });
  console.log('Demo seller: +263772000001 / Seller123!');
  const ch = await bcrypt.hash('Customer123!', 12);
  await prisma.user.upsert({ where:{phone:'+263773000001'}, update:{}, create:{name:'Demo Customer',phone:'+263773000001',email:'customer@demo.co.zw',passwordHash:ch,role:'CUSTOMER',otpVerified:true,isActive:true} });
  console.log('Done! Seeding complete.');
}
main().catch(console.error).finally(()=>prisma.$disconnect());
