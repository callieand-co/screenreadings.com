export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const results = { supabase: null, flodesk: null };

  // 1. Save to Supabase
  try {
    const supabaseRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/waitlist`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ name: name || null, email }),
      }
    );

    if (!supabaseRes.ok) {
      const errText = await supabaseRes.text();
      console.error('Supabase error:', errText);
      results.supabase = 'error';
    } else {
      results.supabase = 'ok';
    }
  } catch (err) {
    console.error('Supabase exception:', err);
    results.supabase = 'error';
  }

  // 2. Add to Flodesk
  try {
    const flodeskRes = await fetch('https://api.flodesk.com/v1/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(process.env.FLODESK_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        email,
        first_name: name || undefined,
        segment_ids: [process.env.FLODESK_SEGMENT_ID],
      }),
    });

    if (!flodeskRes.ok) {
      const errText = await flodeskRes.text();
      console.error('Flodesk error:', errText);
      results.flodesk = 'error';
    } else {
      results.flodesk = 'ok';
    }
  } catch (err) {
    console.error('Flodesk exception:', err);
    results.flodesk = 'error';
  }

  // Return success if at least one worked
  if (results.supabase === 'ok' || results.flodesk === 'ok') {
    return res.status(200).json({ success: true, results });
  }

  return res.status(500).json({ success: false, error: 'Failed to save subscriber', results });
}
