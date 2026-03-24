export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  const REST_API_KEY = "os_v2_app_fk6uq6z435eineyytexzqvmtwwqnkp72wmvuafe6zegwoqvbxxqtchru7ktzjaqo7t2fzkjw4bqmqwmr7c2rfqenj5pqeq6p6yru7oi";
  const APP_ID = "2abd487b-3cdf-4886-9318-992f985593b5";

  const payload = {
    app_id: APP_ID,
    included_segments: ["Subscribed Users"],
    headings: { "en": title },
    contents: { "en": message }
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && data.id) {
      return res.status(200).json({ success: true, data });
    } else {
      return res.status(500).json({ errors: data.errors, details: data });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

