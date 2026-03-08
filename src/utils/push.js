const fetch = require('node-fetch');
const sendPushNotification = async (fcmToken, title, body, data={}) => {
  try {
    const key = process.env.FIREBASE_SERVER_KEY;
    if (!key || key === 'placeholder') { console.log('[PUSH] ' + title + ': ' + body); return { success:true, mock:true }; }
    await fetch('https://fcm.googleapis.com/fcm/send', { method:'POST', headers:{ Authorization:'key='+key, 'Content-Type':'application/json' }, body: JSON.stringify({ to: fcmToken, notification:{ title, body }, data }) });
    return { success: true };
  } catch(e) { return { success: false }; }
};
module.exports = { sendPushNotification };
