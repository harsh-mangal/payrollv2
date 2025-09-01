import axios from 'axios';

export async function sendWhatsAppDocument({ fileUrl, filename, to }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error('WhatsApp API not configured');

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: { link: fileUrl, filename }
  };
  const headers = { Authorization: `Bearer ${token}` };
  const { data } = await axios.post(url, payload, { headers });
  return data;
}
