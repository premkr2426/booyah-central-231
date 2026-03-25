import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        // You MUST have these environment variables set in your Vercel project settings:
        // FIREBASE_SERVICE_ACCOUNT: Stringified JSON of yourFirebase Service Account Key
        // FIREBASE_DATABASE_URL: Your database URL (e.g. "https://your-project.firebaseio.com")
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL
            });
        }
    } catch (e) {
        console.error("Firebase admin initialization error:", e);
    }
}

export default async function handler(req, res) {
    // Allow CORS if needed, and accept only POST requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { ffUid, amount, upiId } = req.body;
    
    if (!ffUid || !amount || amount < 50 || !upiId) {
        return res.status(400).json({ error: 'Invalid parameters: Minimum Rs.50 and UPI required.' });
    }

    try {
        // Fallback check if admin isn't properly loaded
        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase Admin not configured correctly on server.' });
        }

        const db = admin.database();
        const userRef = db.ref(`users/${ffUid}`);
        
        // 1. Fetch user data to verify balance
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentCoins = userData.coins || 0;
        
        // 2. Validate sufficient balance
        if (currentCoins < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        const remainingCoins = currentCoins - amount;

        // 3. Prepare the new transaction record
        // This makes sure it shows as an absolute deduction in history
        const newTransaction = {
            type: 'withdrawal',
            desc: `Withdrawal via ${upiId}`,
            amount: -Math.abs(amount), // Negative amount
            date: Date.now()
        };

        // 4. Update the balance and push transaction atomically using updates
        const updates = {};
        updates[`users/${ffUid}/coins`] = remainingCoins;
        
        await db.ref().update(updates);
        
        // Push the new transaction to the user's transaction history array
        await userRef.child('transactions').push(newTransaction);
        
        // Also log this withdrawal to a global pending withdrawals list for the admin panel
        await db.ref('withdrawals').push({
            uid: ffUid,
            amount: amount,
            upiId: upiId,
            date: Date.now(),
            status: 'pending'
        });

        // Return success response to the client
        return res.status(200).json({ 
            success: true, 
            message: 'Withdrawal successful', 
            remainingCoins: remainingCoins 
        });

    } catch (error) {
        console.error("Withdraw Error:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
