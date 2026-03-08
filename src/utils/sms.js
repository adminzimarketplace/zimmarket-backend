const fetch = require('node-fetch');
const sendSMS = async (phone, message) => {
  try {
    let p = phone.replace(/\s+/g,'');
    if (p.startsWith('07') || p.startsWith('08')) p = '+263' + p.slice(1);
    const key = process.env.AT_API_KEY;
    if (!key || key === 'your-africas-talking-api-key') { console.log('[SMS] To: ' + p + ' | ' + message); return { success:true, mock:true }; }
    const base = process.env.AT_USERNAME === 'sandbox' ? 'https://api.sandbox.africastalking.com/version1/messaging' : 'https://api.africastalking.com/version1/messaging';
    const form = new URLSearchParams({ username: process.env.AT_USERNAME, to: p, message, from: process.env.AT_SENDER_ID || 'ZIMMARKET' });
    const r = await fetch(base, { method:'POST', headers:{ apiKey: key, Accept:'application/json', 'Content-Type':'application/x-www-form-urlencoded' }, body: form });
    return { success: true, data: await r.json() };
  } catch(e) { console.error('SMS error:', e.message); return { success: false }; }
};
module.exports = { sendSMS };
