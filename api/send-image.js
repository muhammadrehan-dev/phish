export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ 
        success: false,
        error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables' 
      });
    }

    let photoBuffer;
    let caption = `📸 Sent at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })}`;

    // Handle GET request (for cron-job.org)
    if (req.method === 'GET') {
      // Generate a placeholder image with timestamp
      const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Karachi',
        dateStyle: 'full',
        timeStyle: 'long'
      });

      const svgImage = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="800" height="400" fill="url(#grad)"/>
        <text x="400" y="160" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">🤖 Automated Photo</text>
        <text x="400" y="220" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle">${timestamp}</text>
        <text x="400" y="260" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.8)" text-anchor="middle">Sent via Cron-job.org</text>
      </svg>`;

      photoBuffer = Buffer.from(svgImage);
      caption = `🤖 Auto-sent via cron at ${timestamp}`;
    } 
    // Handle POST request (manual upload)
    else if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('multipart/form-data')) {
        // Parse multipart form data
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
          return res.status(400).json({ success: false, error: 'Invalid multipart data' });
        }

        const bodyStr = req.body.toString('binary');
        const parts = bodyStr.split(`--${boundary}`);
        
        for (let part of parts) {
          if (part.includes('filename=')) {
            const dataStart = part.indexOf('\r\n\r\n') + 4;
            const dataEnd = part.lastIndexOf('\r\n');
            if (dataStart > 3 && dataEnd > dataStart) {
              photoBuffer = Buffer.from(part.slice(dataStart, dataEnd), 'binary');
              break;
            }
          }
        }
      } else {
        photoBuffer = req.body;
      }

      if (!photoBuffer || photoBuffer.length === 0) {
        return res.status(400).json({ success: false, error: 'No photo provided' });
      }
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Send to Telegram
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const formParts = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="chat_id"`,
      '',
      CHAT_ID,
      `--${boundary}`,
      `Content-Disposition: form-data; name="photo"; filename="photo.jpg"`,
      `Content-Type: image/jpeg`,
      '',
      photoBuffer.toString('binary'),
      `--${boundary}`,
      `Content-Disposition: form-data; name="caption"`,
      '',
      caption,
      `--${boundary}--`
    ];

    const formData = formParts.join('\r\n');

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(formData, 'binary')
        },
        body: Buffer.from(formData, 'binary')
      }
    );

    const data = await response.json();

    if (data.ok) {
      return res.status(200).json({ 
        success: true, 
        message: 'Photo sent to Telegram successfully',
        telegram_response: data.result
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: data.description || 'Failed to send photo to Telegram'
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error'
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
