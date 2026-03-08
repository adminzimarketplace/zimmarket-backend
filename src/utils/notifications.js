const prisma = require('../config/prisma');
const createNotification = async (userId, type, title, body) => {
  try { return await prisma.notification.create({ data:{ userId, type, title, body } }); }
  catch(e) { console.error('Notification error:', e.message); }
};
module.exports = { createNotification };
