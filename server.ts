import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

dotenv.config();

let db: any;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let firebaseConfig;
  
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
  }

  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "PLACEHOLDER") {
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  }
} catch (error) {
  console.error("Firebase initialization error in server:", error);
}

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { amount, currency = 'inr', isRecurring = false, allocation = 'General Fund' } = req.body;
      const stripe = getStripe();

      const sessionOptions: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `Donation to Dr. Pushpa Kaul NGO (${allocation})`,
                description: isRecurring ? 'Monthly recurring donation' : 'One-time donation',
              },
              unit_amount: amount * 100, // amount in cents/paise
              recurring: isRecurring ? { interval: 'month' } : undefined,
            },
            quantity: 1,
          },
        ],
        mode: isRecurring ? 'subscription' : 'payment',
        success_url: `${process.env.APP_URL}/?success=true`,
        cancel_url: `${process.env.APP_URL}/?canceled=true`,
        metadata: {
          allocation,
          isRecurring: isRecurring.toString(),
        },
      };

      const session = await stripe.checkout.sessions.create(sessionOptions);

      // Record the donation in Firestore (as pending or just record it)
      // In a real app, you'd use a webhook to confirm payment, but here we'll record it for analytics
      if (db) {
        try {
          const donationRef = collection(db, 'donations');
          await addDoc(donationRef, {
            amount,
            currency,
            allocation,
            isRecurring,
            userId: req.body.userId || 'anonymous',
            userEmail: req.body.userEmail || 'anonymous',
            donatedAt: Timestamp.now(),
            status: 'pending', // In a real app, this would be updated via webhook
            stripeSessionId: session.id
          });
        } catch (error) {
          console.error("Error recording donation:", error);
        }
      }

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      
      // In a real production app, you would use a service like SendGrid, Mailgun, or AWS SES here.
      // Example:
      // await sendEmail({
      //   to: 'admin@sjmglobal.com',
      //   from: 'website@sjmglobal.com',
      //   subject: `New Contact Form Submission: ${subject}`,
      //   text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
      // });

      console.log(`[NGO Contact Form] New submission from ${name} (${email}): ${subject} - ${message}`);
      
      res.json({ success: true, message: "Message received successfully. We will get back to you soon." });
    } catch (error: any) {
      console.error('Contact form error:', error);
      res.status(500).json({ error: "Failed to process contact form submission." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
