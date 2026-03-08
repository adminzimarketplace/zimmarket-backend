const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const authenticate = async (req,res,next) => {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return res.status(401).json({error:'No token'});
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where:{id:decoded.userId}, include:{seller:true} });
    if (!user || !user.isActive) return res.status(401).json({error:'Account not found'});
    req.user = user; next();
  } catch { return res.status(401).json({error:'Invalid token'}); }
};
const requireRole = (...roles) => (req,res,next) => roles.includes(req.user.role) ? next() : res.status(403).json({error:'Access denied'});
const requireAdmin  = requireRole('ADMIN');
const requireSeller = requireRole('SELLER','ADMIN');
module.exports = { authenticate, requireAdmin, requireSeller };
