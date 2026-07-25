import express from "express";
import cors from "cors";
import axios from "axios";
import nodemailer from "nodemailer";
import midtransClient from "midtrans-client";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Load Firebase Config safely
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
console.log(`[FIREBASE-CONFIG] Loading from: ${configPath}`);
let firebaseConfig: any = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID,
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const jsonConfig = JSON.parse(raw);
    firebaseConfig = { ...firebaseConfig, ...jsonConfig };
    console.log(`[FIREBASE-CONFIG] Loaded Project from JSON: ${firebaseConfig.projectId}`);
  } catch (err) {
    console.error("Failed to parse firebase-applet-config.json:", err);
  }
} else {
  console.warn(`[FIREBASE-CONFIG] File NOT FOUND at ${configPath}. Using ambient environment: ${firebaseConfig.projectId}`);
}

// Initialize Firebase Admin with maximum resilience
let db: any = null;

function getAdminDB() {
  if (db) return db;
  
  try {
    const apps = getApps();
    let adminApp: any = null;
    
    // EXPLICIT initialization with projectId is usually more predictable in multi-project environments
    const configProject = firebaseConfig.projectId;
    const targetDatabaseId = firebaseConfig.firestoreDatabaseId || "(default)";

    if (apps.length === 0) {
      if (configProject) {
        adminApp = initializeApp({
          projectId: configProject
        });
        console.log(`[FIREBASE-ADMIN] Initialized with config Project: ${configProject}`);
      } else {
        adminApp = initializeApp();
        console.log(`[FIREBASE-ADMIN] Initialized with ambient defaults.`);
      }
    } else {
      adminApp = apps[0];
    }
    
    try {
      if (targetDatabaseId === "(default)") {
        db = getFirestore(adminApp);
      } else {
        // v13+ supports passing databaseId as the second argument
        db = getFirestore(adminApp, targetDatabaseId);
      }
    } catch (dbErr: any) {
      console.warn(`[FIREBASE-ADMIN] Firestore specifically for ${targetDatabaseId} failed, trying default...`, dbErr.message);
      db = getFirestore(adminApp);
    }
    
    console.log(`[FIREBASE-ADMIN] Firestore initialized for DB: ${targetDatabaseId}`);
    return db;
  } catch (err: any) {
    console.error("[FIREBASE-ADMIN] Setup failed:", err.message);
    return null;
  }
}

// Initial attempt to warm up the DB connection
getAdminDB();

// Transformation helper for Firestore REST API
function transformRestFields(fields: any) {
  const result: any = {};
  if (!fields) return result;
  
  for (const [key, val] of Object.entries(fields)) {
    const value = val as any;
    if (value.stringValue !== undefined) result[key] = value.stringValue;
    else if (value.integerValue !== undefined) result[key] = parseInt(value.integerValue);
    else if (value.doubleValue !== undefined) result[key] = parseFloat(value.doubleValue);
    else if (value.booleanValue !== undefined) result[key] = value.booleanValue;
    else if (value.timestampValue !== undefined) result[key] = value.timestampValue;
    else if (value.mapValue !== undefined) result[key] = transformRestFields(value.mapValue.fields);
    else if (value.arrayValue !== undefined) {
      result[key] = (value.arrayValue.values || []).map((v: any) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.integerValue !== undefined) return parseInt(v.integerValue);
        if (v.mapValue !== undefined) return transformRestFields(v.mapValue.fields);
        return v;
      });
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Hard Fallback Data removed to ensure only real user data is shown.
const HARD_FALLBACK_API_RESPONSE: any[] = [];

// Internal Caching for Global Settings
let cachedGlobalSettings: any = null;
let lastGlobalSettingsUpdate = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 60 seconds

// Helper to get global settings from Firestore
const getGlobalSettings = async () => {
  const now = Date.now();
  if (cachedGlobalSettings && (now - lastGlobalSettingsUpdate < SETTINGS_CACHE_TTL)) {
    return cachedGlobalSettings;
  }

  const currentDb = getAdminDB();
  let settings = null;

  // 1. Try fetching via Admin SDK
  if (currentDb) {
    try {
      const docRef = currentDb.collection('systemConfigs').doc('global');
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        settings = data?.data || data;
      }
    } catch (sdkErr: any) {
      console.warn("[FIREBASE-ADMIN] SDK failed to fetch global settings, trying REST fallback:", sdkErr.message);
    }
  }

  // 2. Fallback to REST API if Firestore SDK returned nothing or failed
  if (!settings) {
    const pid = firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/${dbId}/documents/systemConfigs/global?key=${firebaseConfig.apiKey}`;
    try {
      const response = await axios.get(url, { timeout: 4000 });
      if (response.data && response.data.fields) {
        const transformed = transformRestFields(response.data.fields);
        settings = transformed.data || transformed;
      }
    } catch (restErr: any) {
      console.warn("[REST-API] Settings fetch error:", restErr.response?.data || restErr.message);
    }
  }

  if (settings) {
    cachedGlobalSettings = settings;
    lastGlobalSettingsUpdate = now;
    return settings;
  }

  return cachedGlobalSettings || null;
};

// Initialize Midtrans Snap with dynamic keys
const getSnapInstance = async () => {
  const settings = await getGlobalSettings();
  
  let serverKey = (settings?.paymentGatewayServerKey || process.env.MIDTRANS_SERVER_KEY || "").trim();
  let clientKey = (settings?.paymentGatewayClientKey || process.env.MIDTRANS_CLIENT_KEY || "").trim();
  let isProduction = settings?.paymentGatewayIsProduction === true || settings?.paymentGatewayIsProduction === "true" || process.env.MIDTRANS_IS_PRODUCTION === "true";

  // Dynamic fallback to the correct Sandbox credentials obtained from poedji.sugianto@gmail.com
  if (!serverKey || serverKey === "YOUR_MIDTRANS_SERVER_KEY" || serverKey === "" || !serverKey.startsWith("Mid-server")) {
    console.log("[FIREBASE/PAYMENT] Using verified sandbox server keys fallback");
    serverKey = "Mid-server-7mVgq0OHQSBIBVUm8Z-N9P55";
    clientKey = "Mid-client-dZqaZ7wEUS4n0Cxc";
    isProduction = false;
  }

  // Double check: if it is poedji's sandbox key, we MUST enforce isProduction = false
  if (serverKey === "Mid-server-7mVgq0OHQSBIBVUm8Z-N9P55") {
    isProduction = false;
    clientKey = "Mid-client-dZqaZ7wEUS4n0Cxc";
  }

  console.log(`[MIDTRANS-RESOLVE] ServerKey: ${serverKey ? serverKey.slice(0, 15) + "..." : "empty"}, ClientKey: ${clientKey ? clientKey.slice(0, 15) + "..." : "empty"}, IsProduction: ${isProduction}`);

  try {
    return new midtransClient.Snap({
      isProduction,
      serverKey,
      clientKey
    });
  } catch (err) {
    console.error("Failed to initialize Midtrans Snap:", err);
    return null;
  }
};

// API Route for sending Email OTP via Nodemailer
// Cache the transporter outside the request handler for serverless efficiency
let cachedTransporter: any = null;

app.post("/api/send-email-otp", async (req, res) => {
  const { email, message, subject } = req.body;
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  
  const startTime = Date.now();

  // 1. If Resend API Key is set, prefer sending via Resend REST API (highly reliable, no IP/port blocks)
  if (resendApiKey) {
    try {
      console.log(`[RESEND-EMAIL] Sending to ${email} using Resend API...`);
      let resendFrom = (process.env.RESEND_FROM || "").trim();
      if (!resendFrom || !resendFrom.includes("@")) {
        // If empty or just a display name without an email address (e.g. "Arcus Archery"), format correctly with the default domain
        const displayName = resendFrom || "ARCUS Archery";
        resendFrom = `${displayName} <onboarding@resend.dev>`;
      }
      
      const response = await axios.post(
        "https://api.resend.com/emails",
        {
          from: resendFrom,
          to: email,
          subject: subject || "Kode OTP Anda",
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #f8fafc; color: #1e293b;">
              <div style="background-color: #0f172a; padding: 20px; border-radius: 20px 20px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-style: italic; letter-spacing: -0.05em;">ARCUS DIGITAL</h1>
              </div>
              <div style="background-color: white; padding: 40px; border-radius: 0 0 20px 20px; border: 1px solid #e2e8f0; border-top: none;">
                <h2 style="color: #0f172a; margin-top: 0;">Verifikasi Akun</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #475569;">${message.replace(/\n/g, '<br>')}</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
                  &copy; ${new Date().getFullYear()} Arcus Digital Archery System. Pesan ini dikirim secara otomatis ke <b>${email}</b>.
                </div>
              </div>
            </div>
          `
        },
        {
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 10000
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[RESEND SUCCESS] Sent of email to ${email} with ID: ${response.data.id} in ${duration}ms`);
      return res.json({ success: true, message: "OTP sent via Resend API", id: response.data.id, duration });
    } catch (resendError: any) {
      console.error("[RESEND ERROR] Failed to send email via Resend API:", resendError.response?.data || resendError.message);
      // Fallback to SMTP if Resend failed due to API Key issues
      console.log("[RESEND FALLBACK] Falling back to SMTP...");
    }
  }

  // 2. SMTP Flow (If Resend API Key is not set or failed)
  const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const smtpUser = (process.env.SMTP_USER || "").trim().replace(/\s/g, "");
  const smtpPass = (process.env.SMTP_PASS || "").trim().replace(/\s/g, "");
  const smtpPortStr = process.env.SMTP_PORT || "587";
  const smtpPort = parseInt(smtpPortStr);
  
  const missingVars = [];
  if (!smtpUser) missingVars.push("SMTP_USER");
  if (!smtpPass) missingVars.push("SMTP_PASS");
  
  if (missingVars.length > 0) {
    console.log(`[SIMULATION] Email OTP: ${email} | Subject: ${subject} | Port: ${smtpPortStr} | Code: ${message.match(/\d{4}/)?.[0] || 'N/A'}`);
    return res.json({ 
      success: true, 
      message: `Email dikirim (SIMULASI - ${missingVars.join(', ')} belum ada)`,
      isSimulated: true,
      otp: message.match(/\d{4}/)?.[0]
    });
  }

  const isGmail = smtpHost.includes("gmail.com");
  const cleanPass = smtpPass.replace(/\s/g, "");

  console.log(`[EMAIL-CONFIG] Host: ${smtpHost}, User: ${smtpUser}, Port: ${smtpPortStr}, PassLen: ${cleanPass.length}`);

  try {
    let transporter;
    
    if (isGmail) {
      const cleanUser = smtpUser.trim().toLowerCase();
      const finalPass = cleanPass.trim();
      
      console.log(`[EMAIL-GMAIL] Attempting with service:gmail, user: ${cleanUser}, passLen: ${finalPass.length}`);
      
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: cleanUser,
          pass: finalPass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
      });
    } else {
      let smtpSecure = process.env.SMTP_SECURE === "true";
      if (!process.env.SMTP_SECURE) {
        smtpSecure = smtpPort === 465;
      }
      
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }
    
    console.log(`[EMAIL-ATTEMPT] Sending to ${email} using ${isGmail ? 'Gmail Service' : smtpHost}`);

    await transporter.sendMail({
      from: `"ARCUS Archery System" <${smtpUser}>`,
      to: email,
      subject: subject || "Kode OTP Anda",
      text: message,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #f8fafc; color: #1e293b;">
          <div style="background-color: #0f172a; padding: 20px; border-radius: 20px 20px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-style: italic; letter-spacing: -0.05em;">ARCUS DIGITAL</h1>
          </div>
          <div style="background-color: white; padding: 40px; border-radius: 0 0 20px 20px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #0f172a; margin-top: 0;">Verifikasi Akun</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #475569;">${message.replace(/\n/g, '<br>')}</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
              &copy; ${new Date().getFullYear()} Arcus Digital Archery System. Pesan ini dikirim secara otomatis ke <b>${email}</b>.
            </div>
          </div>
        </div>
      `,
    });

    const duration = Date.now() - startTime;
    console.log(`[EMAIL SUCCESS] Sent to ${email} in ${duration}ms`);
    return res.json({ success: true, message: "OTP sent to email", duration });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    let errorMessage = error.message;
    
    // Auth failures (535)
    if (errorMessage.includes("535") || errorMessage.includes("authentication failed") || error.code === "EAUTH") {
      if (isGmail) {
        errorMessage = `Autentikasi Gmail Gagal. Password terbaca sebagai ${cleanPass.length} karakter. Jika sudah 16 karakter namun masih gagal, pastikan Anda membuat App Password khusus untuk "Mail" dan jangan ada spasi di antaranya.`;
      }
    }

    console.error(`[EMAIL ERROR] Details:`, {
      code: error.code,
      message: error.message,
      user: smtpUser,
      passLen: cleanPass.length
    });

    return res.status(500).json({ 
      success: false, 
      error: error.message,
      message: errorMessage || "Gagal mengirim email. Silakan cek koneksi atau kredensial SMTP." 
    });
  }
});

// API Route for sending WhatsApp OTP via Fonnte
app.post("/api/send-otp", async (req, res) => {
  const { phone, message } = req.body;
  const token = process.env.FONNTE_TOKEN;

  if (!token) {
    return res.status(500).json({ success: false, message: "WhatsApp token missing." });
  }

  try {
    const response = await axios.post(
      "https://api.fonnte.com/send",
      { target: phone, message: message, countryCode: "62" },
      { headers: { Authorization: token } }
    );

    if (response.data.status) {
      res.json({ success: true, data: response.data });
    } else {
      res.status(400).json({ success: false, data: response.data });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to send WhatsApp", error: error.message });
  }
});

// Payment Database (In-memory for simulation)
const simulatedPayments: Record<string, { status: string, amount: number }> = {};

// API Route for creating a payment transaction
app.post("/api/payment/create", async (req, res) => {
  const { amount, method, provider, customerDetails, itemDetails } = req.body;
  const orderId = "ARCUS-" + Date.now() + "-" + Math.random().toString(36).toUpperCase().substr(2, 4);
  
  console.log(`[PAYMENT] Initiating ${amount} via ${method} using provider: ${provider}`);

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
  }

  const snap = await getSnapInstance();

  // If Midtrans is configured, use it
  if (snap) {
    try {
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        credit_card: {
          secure: true
        },
        customer_details: customerDetails,
        item_details: itemDetails
      };

      // @ts-ignore
      const transaction = await snap.createTransaction(parameter);
      
      // Store locally for status tracking if needed
      simulatedPayments[orderId] = { status: "PENDING", amount };

      return res.json({ 
        success: true, 
        transactionId: orderId,
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
        isReal: true
      });
    } catch (error: any) {
      console.error("Midtrans Error:", error);
      // Detailed error for debugging if it's unauthorized
      if (error.message?.includes("401")) {
        return res.status(500).json({ 
          success: false, 
          message: "Midtrans Auth Error: Server Key tidak valid atau salah mode (Sandbox/Production).",
          error: error.message 
        });
      }
      return res.status(500).json({ success: false, message: "Gagal membuat transaksi Midtrans", error: error.message });
    }
  }
  
  // Fallback to simulation
  simulatedPayments[orderId] = { status: "PENDING", amount };
  
  // Simulate automatic success after 10 seconds
  setTimeout(() => {
    if (simulatedPayments[orderId]) {
      simulatedPayments[orderId].status = "PAID";
      console.log(`[SIMULATION] Webhook received for ${orderId}: Status updated to PAID`);
    }
  }, 10000);

  res.json({ 
    success: true, 
    transactionId: orderId,
    qrData: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + orderId,
    message: "Transaction created (SIMULATED). Will auto-confirm in 10s.",
    isReal: false
  });
});

// API Route for checking payment status (Polling)
app.get("/api/payment/status/:id", async (req, res) => {
  const orderId = req.params.id;
  
  const snap = await getSnapInstance() as any;
  const serverKey = snap?.apiConfig?.serverKey;

  // If Midtrans is configured, check real status
  if (serverKey) {
    try {
      const statusResponse = await snap.transaction.status(orderId);
      let status = "PENDING";
      
      if (statusResponse.transaction_status === 'settlement' || statusResponse.transaction_status === 'capture') {
        status = "PAID";
      } else if (statusResponse.transaction_status === 'deny' || statusResponse.transaction_status === 'cancel' || statusResponse.transaction_status === 'expire') {
        status = "FAILED";
      }

      return res.json({ success: true, status, midtransStatus: statusResponse.transaction_status });
    } catch (error: any) {
      // If not found in Midtrans, check simulation
      const payment = simulatedPayments[orderId];
      if (payment) {
        return res.json({ success: true, status: payment.status });
      }
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
  }

  const payment = simulatedPayments[orderId];
  if (!payment) {
    return res.status(404).json({ success: false, message: "Transaction not found" });
  }
  
  res.json({ success: true, status: payment.status });
});

// Webhook Endpoint for Midtrans
app.get("/api/payment/webhook", (req, res) => {
  res.send("Webhook Arcus aktif! Gunakan metode POST untuk mengirim notifikasi pembayaran.");
});

app.post("/api/payment/webhook", async (req, res) => {
  const notification = req.body;
  
  // Midtrans validation pings often don't contain order_id or use dummy data
  // We return 200 OK so Midtrans can verify the endpoint is reachable
  if (!notification || !notification.order_id) {
    console.log("[WEBHOOK] Received empty or invalid notification, acknowledging for validation.");
    return res.status(200).json({ success: true, message: "Endpoint reached" });
  }

  console.log(`[WEBHOOK] Received update for ${notification.order_id}: ${notification.transaction_status}`);
  
  const snap = await getSnapInstance() as any;
  const serverKey = snap.apiConfig.serverKey;

  if (!serverKey) {
    console.warn("[WEBHOOK] Midtrans Server Key not configured. Skipping verification.");
    return res.status(200).json({ success: true, message: "Simulated Webhook" });
  }

  try {
    const statusResponse = await snap.transaction.notification(notification);
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    if (transactionStatus == 'capture') {
      if (fraudStatus == 'challenge') {
        // TODO: handle fraud challenge
      } else if (fraudStatus == 'accept') {
        if (simulatedPayments[orderId]) simulatedPayments[orderId].status = "PAID";
      }
    } else if (transactionStatus == 'settlement') {
      if (simulatedPayments[orderId]) simulatedPayments[orderId].status = "PAID";
    } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
      if (simulatedPayments[orderId]) simulatedPayments[orderId].status = "FAILED";
    } else if (transactionStatus == 'pending') {
      if (simulatedPayments[orderId]) simulatedPayments[orderId].status = "PENDING";
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[WEBHOOK ERROR] Critical error during processing:", error);
    // CRITICAL: Always return 200 to Midtrans even on error to stop retry-loop and pass validation
    res.status(200).json({ success: true, message: "Acknowledged with internal log" });
  }
});

app.get("/api/smtp-diagnostic", async (req, res) => {
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  const portStr = process.env.SMTP_PORT || "587";
  const port = parseInt(portStr);
  const isGmail = host.includes("gmail.com");
  const cleanPass = pass.replace(/\s/g, "");
  
  const diagnosticDetails: any = {
    host,
    user: user ? `${user.substring(0, 4)}***@${user.split('@')[1] || 'domain'}` : "NOT SET",
    port: portStr,
    portParsed: port,
    passStatus: pass ? `SET (${pass.length} chars)` : "NOT SET",
    isGmail,
    passLooksLikeAppPassword: isGmail ? cleanPass.length === 16 : null,
    cleanPassLength: cleanPass.length,
    envKeysPresent: Object.keys(process.env).filter(k => k.startsWith('SMTP_') || k === 'FONNTE_TOKEN'),
    whatsappTokenStatus: process.env.FONNTE_TOKEN ? `SET (${process.env.FONNTE_TOKEN.length} chars)` : "NOT SET"
  };

  try {
    let transporter;
    if (isGmail) {
      transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass: cleanPass },
        connectionTimeout: 10000
      });
    } else {
      transporter = nodemailer.createTransport({
        host, port, secure: port === 465,
        auth: { user, pass: cleanPass },
        tls: { rejectUnauthorized: false }
      });
    }

    const verify = await transporter.verify();
    return res.json({
      success: true,
      message: "Koneksi SMTP BERHASIL! Konfigurasi Anda sudah benar.",
      diagnostic: diagnosticDetails,
      verify
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: "Koneksi SMTP GAGAL: " + err.message,
      diagnostic: diagnosticDetails,
      error: {
        code: err.code,
        command: err.command,
        response: err.response
      }
    });
  }
});

app.post("/api/delete-participant", async (req, res) => {
  const { eventId, participantId, authEmail, authUid } = req.body;

  const currentDb = getAdminDB();
  if (!currentDb) return res.status(500).json({ error: "Database not reachable" });

  try {
    const eventRef = currentDb.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) return res.status(404).json({ error: "Event tidak ditemukan" });

    const eventData = eventSnap.data() || {};
    const ownerId = eventData.ownerId || eventData.data?.ownerId;
    const organizerId = eventData.settings?.organizerId || eventData.data?.settings?.organizerId;

    // Authorization check (Relaxed as requested)
    let isAuthorized = false;
    const isHardcodedAdmin = ["poedji.sugianto@gmail.com", "admin@arcus.id", "arcus.id@gmail.com"].includes(authEmail);
    
    if (isHardcodedAdmin) {
      isAuthorized = true;
    } else {
      const isOwner = (authEmail && (authEmail === ownerId || authEmail === organizerId)) || 
                      (authUid && (authUid === ownerId || authUid === organizerId));
      if (isOwner) {
        isAuthorized = true;
      } else if (authUid) {
        const profileSnap = await currentDb.collection("profiles").doc(authUid).get();
        if (profileSnap.exists) {
          const role = profileSnap.data()?.role;
          if (["SUPERADMIN", "ADMIN", "MASTER_ADMIN"].includes(role)) isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Akses ditolak. Anda tidak memiliki izin untuk menghapus peserta ini." });
    }

    // Delete from submissions
    await eventRef.collection("submissions").doc(participantId).delete();
    
    // 2. Fetch current event to filter main arrays
    const freshSnap = await eventRef.get();
    const freshData = freshSnap.data() || {};
    const hasDataWrapper = typeof freshData.data === 'object' && freshData.data !== null;
    
    const currentArchers = freshData.archers || freshData.data?.archers || [];
    const currentOfficials = freshData.officials || freshData.data?.officials || [];
    
    const filteredArchers = currentArchers.filter((a: any) => a.id !== participantId);
    const filteredOfficials = currentOfficials.filter((o: any) => o.id !== participantId);

    // Update registrationCount and main arrays
    const updatePayload: any = {
      registrationCount: FieldValue.increment(-1),
      archers: filteredArchers,
      officials: filteredOfficials
    };

    if (hasDataWrapper) {
      updatePayload["data.registrationCount"] = FieldValue.increment(-1);
      updatePayload["data.archers"] = filteredArchers;
      updatePayload["data.officials"] = filteredOfficials;
    }

    await eventRef.update(updatePayload);

    res.json({ success: true, message: "Peserta berhasil dihapus." });
  } catch (err: any) {
    console.error("Delete participant error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/delete-event/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { authEmail, authUid } = req.body;

  const currentDb = getAdminDB();
  const pid = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
  const apiKey = firebaseConfig.apiKey || process.env.VITE_FIREBASE_API_KEY;

  console.log(`[API/DELETE] Deletion request for ${eventId} from ${authEmail || authUid}`);

  try {
    // 1. Authorization Check (We still need to verify permissions)
    let isAuthorized = false;
    let ownerId = null;
    let organizerId = null;

    // Try to get data via SDK first
    if (currentDb) {
      try {
        const snap = await currentDb.collection('events').doc(eventId).get();
        if (snap.exists) {
          const data = snap.data() || {};
          ownerId = data.ownerId || data.data?.ownerId;
          organizerId = data.settings?.organizerId || data.data?.settings?.organizerId;
        }
      } catch (sdkErr: any) {
        console.warn(`[API/DELETE] SDK Auth check failed, trying REST...`, sdkErr.message);
      }
    }

    // Fallback to REST for data if SDK failed
    if (!ownerId && apiKey) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/${dbId}/documents/events/${eventId}?key=${apiKey}`;
        const res = await axios.get(url, { timeout: 4000 });
        if (res.data && res.data.fields) {
          const transformed = transformRestFields(res.data.fields);
          ownerId = transformed.ownerId || transformed.data?.ownerId;
          organizerId = transformed.settings?.organizerId || transformed.data?.settings?.organizerId;
        }
      } catch (restErr: any) {
        console.warn(`[API/DELETE] REST Auth check also failed:`, restErr.message);
      }
    }

    // Check against authorized emails
    const cleanAuthEmail = (authEmail || "").toLowerCase();
    const superAdmins = [
      'poedji.sugianto@gmail.com', 
      'poedjisugianto@gmail.com',
      'admin@arcus.id', 
      'arcus.id@gmail.com',
      'user@arcus.id'
    ];
    
    if (superAdmins.includes(cleanAuthEmail)) isAuthorized = true;
    
    if (!isAuthorized) {
      const isOwner = (cleanAuthEmail && (cleanAuthEmail === (ownerId || "").toLowerCase() || cleanAuthEmail === (organizerId || "").toLowerCase()));
      if (isOwner) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Akses ditolak. Anda tidak memiliki izin untuk menghapus event ini." });
    }

    // 2. Perform Deletion
    // If SDK is suffering from PERMISSION_DENIED (7), we'll try to delete the main doc via REST
    // and attempt subcollection cleanup via SDK if it works, or skip if it doesn't (main doc is primary).
    
    let deletionResults: any = { sdk: false, rest: false };

    // SDK attempt (includes subcollections)
    if (currentDb) {
      try {
        const eventRef = currentDb.collection('events').doc(eventId);
        
        // Try deleting subcollections first
        const submissionsSnap = await eventRef.collection('submissions').limit(500).get();
        const batch = currentDb.batch();
        submissionsSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        await eventRef.delete();
        deletionResults.sdk = true;
      } catch (sdkErr: any) {
        console.warn(`[API/DELETE] SDK deletion failed (Permission?): ${sdkErr.message}`);
        deletionResults.sdkError = sdkErr.message;
      }
    }

    // REST Fallback (Primary fallback for main document)
    if (!deletionResults.sdk && apiKey) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/${dbId}/documents/events/${eventId}?key=${apiKey}`;
        await axios.delete(url);
        deletionResults.rest = true;
        console.log(`[API/DELETE] REST Deletion SUCCESS for ${eventId}`);
      } catch (restErr: any) {
        console.error(`[API/DELETE] REST Deletion also failed:`, restErr.message);
        deletionResults.restError = restErr.message;
      }
    }

    if (deletionResults.sdk || deletionResults.rest) {
      if (eventDetailsCache[eventId]) delete eventDetailsCache[eventId];
      return res.json({ 
        success: true, 
        message: "Turnamen berhasil dihapus.",
        method: deletionResults.sdk ? "SDK" : "REST Fallback"
      });
    }

    throw new Error(deletionResults.sdkError || deletionResults.restError || "Gagal menghapus dokumen dari cloud.");

  } catch (err: any) {
    console.error("Delete endpoint caught error:", err);
    res.status(500).json({ 
      error: err.message,
      diagnostic: {
        projectId: pid,
        databaseId: dbId
      }
    });
  }
});

app.post("/api/reset-event/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { authEmail } = req.body;

  const currentDb = getAdminDB();
  if (!currentDb) return res.status(500).json({ error: "DB not ready" });
  
  // Basic sanity check for admin identity
  const isAdmin = authEmail === 'poedji.sugianto@gmail.com' || authEmail === 'admin@arcus.id';
  if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

  try {
    const eventRef = currentDb.collection('events').doc(eventId);
    
    // 1. Delete all submissions
    const submissionsSnap = await eventRef.collection('submissions').get();
    const batch = currentDb.batch();
    submissionsSnap.forEach(doc => batch.delete(doc.ref));
    
    // 2. Reset counters
    batch.update(eventRef, {
      "registrationCount": 0,
      "data.registrationCount": 0,
      "archers": [],
      "officials": [],
      "registrations": [],
      "scores": [],
      "scoreLogs": [],
      "matches": {},
      "lastResetAt": new Date().toISOString()
    });

    await batch.commit();
    
    if (eventDetailsCache[eventId]) delete eventDetailsCache[eventId];

    res.json({ success: true, message: "Event data has been reset to fresh state." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/nuke-database", async (req, res) => {
  const { authEmail } = req.body;
  const hardcodedAdmins = ['poedji.sugianto@gmail.com', 'admin@arcus.id', 'arcus.id@gmail.com', 'user@arcus.id'];
  
  if (!hardcodedAdmins.includes(authEmail)) {
    return res.status(403).json({ error: "Unauthorized: Hanya Master Admin yang boleh melakukan Reset Total." });
  }

  const currentDb = getAdminDB();
  if (!currentDb) return res.status(500).json({ error: "DB not ready" });

  try {
    const collections = ['events', 'profiles', 'systemConfigs', 'test'];
    for (const colName of collections) {
      const snapshot = await currentDb.collection(colName).get();
      const batch = currentDb.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    res.json({ success: true, message: "Database has been nuked (all major collections cleared)." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// Health check and DB Diagnostics
app.get("/api/health", async (req, res) => {
  const currentDb = getAdminDB();
  const dbStatus = currentDb ? "connected" : "not initialized";
  res.json({ 
    status: "ok", 
    message: "ARCUS API is running",
    db: dbStatus,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId || "(default)"
  });
});

app.get("/api/db-test", async (req, res) => {
  const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
  const projectId = firebaseConfig.projectId;
  
  const currentDb = getAdminDB();
  const apps = getApps();
  const adminAppObj = apps.length > 0 ? apps[0] : null;
  
  const results: any = {
    config: { projectId, dbId },
    env: {
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
      GCLOUD_PROJECT: process.env.GCLOUD_PROJECT
    },
    adminApp: adminAppObj ? { name: adminAppObj.name, options: adminAppObj.options } : null,
    db: !!currentDb,
    diagnosis: []
  };

  if (!currentDb) {
    results.diagnosis.push("DB instance is NULL. Admin SDK failed to initialize.");
    return res.status(500).json(results);
  }

  try {
    results.diagnosis.push(`Attempting simple get from 'test/connection' on project ${projectId}, db ${dbId}`);
    const docRef = currentDb.collection('test').doc('connection');
    const docSnap = await docRef.get();
    results.testDoc = { exists: docSnap.exists, path: docRef.path };
    
    results.diagnosis.push("Attempting listCollections...");
    const collections = await currentDb.listCollections();
    results.collections = collections.map(c => c.id);
    
    results.success = true;
    return res.json(results);
  } catch (err: any) {
    console.error("[DB-TEST] Admin SDK Failure:", err);
    results.success = false;
    results.error = {
      message: err.message,
      code: err.code,
      details: err.details,
      stack: err.stack?.split('\n').slice(0, 3)
    };
    
    // Attempt REST fallback check to see if network/auth is the issue
    results.diagnosis.push("Admin SDK failed. Checking REST API connectivity as baseline...");
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/test/connection?key=${firebaseConfig.apiKey}`;
      const restRes = await axios.get(url, { timeout: 3000 });
      results.restBaseline = { success: true, status: restRes.status };
    } catch (restErr: any) {
      results.restBaseline = { success: false, error: restErr.message, status: restErr.response?.status };
    }
    
    return res.status(500).json(results);
  }
});

// --- PRODUCTION API FOR EVENT DISCOVERY ---
let publicEventsCache: { data: any, timestamp: number } | null = null;
const PUBLIC_EVENTS_CACHE_TTL = 30 * 1000; // 30 seconds Cache TTL

app.get("/api/public-events", async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=15'); 
  const now = Date.now();

  if (publicEventsCache && (now - publicEventsCache.timestamp < PUBLIC_EVENTS_CACHE_TTL)) {
    return res.json({ ...publicEventsCache.data, source: 'memory-cache' });
  }

  const currentDb = getAdminDB();
  if (!currentDb) return res.status(503).json({ error: "Initializing", success: false });

  const pid = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || "(default)";

  try {
    const snapshot = await currentDb.collection('events')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const events: any[] = [];
    
    snapshot.forEach((d: any) => {
      const rawData = d.data();
      const eventData = rawData.data || rawData;
      
      const status = (rawData.status || eventData.status || 'DRAFT').toString().toUpperCase();
      
      // Deep merge settings from both sources
      const settings = {
        ...(eventData.settings || eventData || {}),
        ...(rawData.settings || {})
      };

      if (status !== 'DELETED') {
         events.push({
           ...eventData,
           id: d.id,
           status,
           settings,
           registrationCount: rawData.registrationCount || 0,
           createdAt: rawData.createdAt || eventData.createdAt || new Date().toISOString()
         });
       }
    });

    const result = { success: true, events, source: 'admin-sdk' };
    publicEventsCache = { data: result, timestamp: now };
    return res.json(result);
  } catch (err: any) {
    // 2. Try REST API Fallback
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/${dbId}/documents/events?key=${firebaseConfig.apiKey}&pageSize=100`;
      const response = await axios.get(url, { timeout: 5000 });
          
      if (response.data && response.data.documents) {
        const documents = response.data.documents || [];
        const fallbackEvents: any[] = [];
        
        documents.forEach((d: any) => {
          const transformed = transformRestFields(d.fields);
          const rawData = transformed.data || transformed;
          const status = (transformed.status || rawData.status || 'ACTIVE').toString().toUpperCase();
          const docId = d.name.split('/').pop();
          
          if (status !== 'DELETED') {
            fallbackEvents.push({ ...rawData, id: docId, status, createdAt: transformed.createdAt || rawData.createdAt || new Date().toISOString() });
          }
        });

        const resultFallback = { success: true, events: fallbackEvents.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), source: `cloud-rest-fallback` };
        publicEventsCache = { data: resultFallback, timestamp: now };
        return res.json(resultFallback);
      }
      return res.json({ success: true, events: [], source: 'empty' });
    } catch (restErr: any) {
       // SILENT FAIL on public list - client will try direct SDK fetch
       return res.json({ success: true, events: [], source: 'error-silent' });
    }
  }
});

// API Route for registering participants (Online Registration)
app.post("/api/register-participant", async (req, res) => {
  const { eventId, registrations, archers, officials = [] } = req.body;

  const currentDb = getAdminDB();
  if (!currentDb) {
    return res.status(500).json({ success: false, message: "Firestore not initialized on backend" });
  }

  if (!eventId || !registrations || !archers || !Array.isArray(registrations) || !Array.isArray(archers)) {
    return res.status(400).json({ success: false, message: "Missing required registration data or invalid format" });
  }

  try {
    const eventRef = currentDb.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) {
       return res.status(404).json({ success: false, message: "Turnamen tidak ditemukan" });
    }
    
    const eventData = eventSnap.data() || {};
    const hasDataWrapper = typeof eventData.data === 'object' && eventData.data !== null;

    const settings = eventData.settings || eventData.data?.settings || {};

    // 1. Validate Registration Deadline
    const deadline = settings?.registrationDeadline;
    if (deadline) {
      const deadlineDate = new Date(deadline);
      if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
        return res.status(400).json({ success: false, message: "Pendaftaran lomba telah ditutup karena melewati batas tanggal pendaftaran yang ditentukan panitia" });
      }
    }

    // 2. Validate Category Quota
    const categoryConfigs = settings?.categoryConfigs || {};
    const submissionsSnap = await eventRef.collection('submissions').get();
    const existingSubmissions: any[] = [];
    submissionsSnap.forEach((doc) => existingSubmissions.push(doc.data()));

    const categoryActiveCounts: Record<string, number> = {};
    existingSubmissions.forEach((reg: any) => {
      if (reg.status !== 'CANCELLED' && reg.status !== 'REJECTED') {
        const cat = reg.category;
        if (cat) {
          categoryActiveCounts[cat] = (categoryActiveCounts[cat] || 0) + 1;
        }
      }
    });

    const categoryAdditionCounts: Record<string, number> = {};
    (registrations || []).forEach((reg: any) => {
      const cat = reg.category;
      if (cat && cat !== 'OFFICIAL') {
        categoryAdditionCounts[cat] = (categoryAdditionCounts[cat] || 0) + 1;
      }
    });

    for (const cat of Object.keys(categoryAdditionCounts)) {
      const config = categoryConfigs[cat];
      const quota = config?.quota;
      if (quota !== undefined && quota !== null && quota > 0) {
        const existingCount = categoryActiveCounts[cat] || 0;
        const addingCount = categoryAdditionCounts[cat];
        if (existingCount + addingCount > quota) {
          return res.status(400).json({ 
            success: false, 
            message: `Kategori ${cat} sudah penuh. Sisa kuota sedia: ${quota - existingCount} pemanah, Anda mencoba mendaftarkan ${addingCount} pemanah.` 
          });
        }
      }
    }

    const batch = currentDb.batch();
    
    // 1. Write each registration and participant to the subcollection
    (registrations || []).forEach((reg: any, index: number) => {
      const archerData = (archers || []).find((a: any) => a.id === reg.id);
      const officialData = (officials || []).find((o: any) => o.id === reg.id);
      
      const subRef = eventRef.collection('submissions').doc(reg.id || `reg_${Date.now()}_${index}`);
      
      batch.set(subRef, {
        ...reg,
        ...(archerData || {}),
        ...(officialData || {}),
        id: reg.id,
        serverTimestamp: FieldValue.serverTimestamp(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    // 2. Update the main event metadata robustly
    console.log(`[API/REGISTER] Preparing metadata update for event ${eventId}. hasDataWrapper: ${hasDataWrapper}`);
    
    // Prepare arrays for main document update
    const newArchers = (archers || []).map(a => ({
      ...a,
      status: a.status || "PENDING",
      timestamp: a.timestamp || Date.now(),
      registeredVia: 'ONLINE'
    }));

    const newOfficials = (officials || []).map(o => ({
      ...o,
      status: o.status || "PENDING",
      timestamp: o.timestamp || Date.now(),
      registeredVia: 'ONLINE'
    }));

    const updatePayload: any = {
      "registrationCount": FieldValue.increment(registrations.length),
      "lastRegistrationAt": new Date().toISOString(),
      "updatedAt": FieldValue.serverTimestamp()
    };

    if (newArchers.length > 0) {
      updatePayload["archers"] = FieldValue.arrayUnion(...newArchers);
    }
    if (newOfficials.length > 0) {
      updatePayload["officials"] = FieldValue.arrayUnion(...newOfficials);
    }

    if (hasDataWrapper) {
      updatePayload["data.registrationCount"] = FieldValue.increment(registrations.length);
      updatePayload["data.lastRegistrationAt"] = new Date().toISOString();
      if (newArchers.length > 0) {
        updatePayload["data.archers"] = FieldValue.arrayUnion(...newArchers);
      }
      if (newOfficials.length > 0) {
        updatePayload["data.officials"] = FieldValue.arrayUnion(...newOfficials);
      }
    }

    try {
      batch.update(eventRef, updatePayload);
    } catch (updateErr: any) {
      console.warn(`[API/REGISTER] batch.update failed (likely schema mismatch), attempting batch.set merge...`, updateErr.message);
      // Fallback: Use set with merge if update fails (e.g. if field dot path doesn't exist)
      batch.set(eventRef, updatePayload, { merge: true });
    }

    console.log(`[API/REGISTER] Committing batch for ${registrations.length} registrations on event ${eventId}...`);
    try {
      await batch.commit();
      console.log(`[API/REGISTER] Batch commit SUCCESS for event ${eventId}`);
    } catch (commitErr: any) {
      console.error("[API/REGISTER] Batch commit failed:", commitErr);
      // Detailed error reporting
      let detailedError = commitErr.message;
      if (commitErr.code === 8 || detailedError.includes("RESOURCE_EXHAUSTED")) {
        detailedError = "Quota Firestore Terlampaui. Silahkan coba lagi besok.";
      }
      throw new Error(`Cloud Write Failed: ${detailedError} (Code: ${commitErr.code || 'UNKNOWN'})`);
    }

    if (eventDetailsCache[eventId]) {
      delete eventDetailsCache[eventId];
    }

    res.json({ 
      success: true, 
      message: `${registrations.length} participant(s) registered successfully`,
      count: registrations.length
    });
  } catch (error: any) {
    console.error("Batch Registration Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      debug: {
        code: error.code,
        note: "Checking if DB is initialized correctly"
      },
      message: error.message.includes("Cloud Write Failed") 
        ? error.message 
        : "Gagal memproses pendaftaran. Silahkan coba lagi." 
    });
  }
});

// Memory cache for individual event details to save quota on live views
const eventDetailsCache: Record<string, { data: any, timestamp: number }> = {};
const DETAIL_CACHE_TTL = 30 * 1000; // 30 detik (Optimal untuk menghemat kuota Firestore)

app.get("/api/event-details/:id", async (req, res) => {
  const eventId = req.params.id;
  const now = Date.now();
  const bypassCache = req.query.bypassCache === 'true' || req.query.refresh === 'true';

  if (!bypassCache && eventDetailsCache[eventId] && (now - eventDetailsCache[eventId].timestamp < DETAIL_CACHE_TTL)) {
    return res.json({ success: true, data: eventDetailsCache[eventId].data, source: 'cache' });
  }

  const currentDb = getAdminDB();
  if (!currentDb) {
    return res.status(500).json({ error: "Sistem Cloud tidak siap" });
  }

  const pid = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
  console.log(`[API/EVENT-DETAILS] Fetching via Admin SDK for ${eventId} (PID: ${pid}, DB: ${dbId})...`);

  try {
    // 1. Fetch Event Document
    const eventRef = currentDb.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    
    if (!eventSnap.exists) {
      return res.status(404).json({ error: "Event tidak ditemukan" });
    }
    
    const data = eventSnap.data() || {};
    const base = data.data || data;
    const settings = {
      ...(base.settings || base || {}),
      ...(data.settings || {})
    };
    const status = (data.status || base.status || 'DRAFT').toString().toUpperCase();

    // 2. Fetch Submissions
    let submissions: any[] = [];
    try {
      const submissionsSnap = await eventRef.collection('submissions').limit(5000).get();
      submissionsSnap.forEach((d: any) => submissions.push({ id: d.id, ...d.data() }));
    } catch (subErr: any) {
      console.warn(`[API/EVENT-DETAILS] Submissions fetch failed via Admin SDK, trying REST fallback... ${subErr.message}`);
      // REST fallback...
      const subUrl = `https://firestore.googleapis.com/v1/projects/${pid}/databases/${dbId}/documents/events/${eventId}/submissions?key=${firebaseConfig.apiKey}&pageSize=1000`;
      try {
        const subRes = await axios.get(subUrl, { timeout: 4000 });
        if (subRes.data && subRes.data.documents) {
          subRes.data.documents.forEach((d: any) => {
            const transformed = transformRestFields(d.fields);
            const docId = d.name.split('/').pop();
            submissions.push({ ...transformed, id: docId });
          });
          console.log(`[API/EVENT-DETAILS] REST fallback success: fetched ${submissions.length} submissions`);
        }
      } catch (restErr: any) {
        console.error(`[API/EVENT-DETAILS] All submissions fetch methods failed:`, restErr.message);
      }
    }

    // 3. Fetch Scores
    let scores: any[] = [];
    try {
      const scoresSnap = await eventRef.collection('scores').limit(5000).get();
      scoresSnap.forEach((d: any) => scores.push({ id: d.id, ...d.data() }));
    } catch (scoreErr: any) {
      console.warn(`[API/EVENT-DETAILS] Scores fetch failed via Admin SDK: ${scoreErr.message}`);
    }

    // 4. Fetch ScoreLogs
    let scoreLogs: any[] = [];
    try {
      const logsSnap = await eventRef.collection('scoreLogs').limit(2000).get();
      logsSnap.forEach((d: any) => scoreLogs.push({ id: d.id, ...d.data() }));
    } catch (logErr: any) {
      console.warn(`[API/EVENT-DETAILS] ScoreLogs fetch failed via Admin SDK: ${logErr.message}`);
    }

    console.log(`[API/EVENT-DETAILS] Successfully fetched details for ${eventId}: Submissions Count=${submissions.length}, Scores Count=${scores.length}, ScoreLogs Count=${scoreLogs.length}`);

    const responseData = {
      ...base,
      ...data,
      settings,
      status,
      registrations: submissions,
      scores,
      scoreLogs,
      id: eventId
    };

    eventDetailsCache[eventId] = { data: responseData, timestamp: now };
    return res.json({ success: true, data: responseData, source: 'admin-sdk' });
  } catch (error: any) {
    // REST API Fallback for Detail
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/${dbId}/documents/events/${eventId}?key=${firebaseConfig.apiKey}`;
      const response = await axios.get(url, { timeout: 3000 });
      
      if (response.data) {
        const transformedData = transformRestFields(response.data.fields);
        const data = transformedData.data || transformedData;
        
        return res.json({ 
          success: true, 
          data: { ...data, id: eventId, registrations: [] }, 
          source: 'cloud-rest-fallback' 
        });
      }
    } catch (restErr: any) {
      console.warn("[API/EVENT-DETAILS] REST Fallback failed:", restErr.message);
    }

    if (eventDetailsCache[eventId]) {
      return res.json({ success: true, data: eventDetailsCache[eventId].data, source: 'error-fallback' });
    }
    res.status(500).json({ error: "Gagal mengambil detail dari cloud", details: error.message, code: error.code });
  }
});

// Final cleanup: No background preheating
// Global JSON error handler to prevent HTML responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[GLOBAL-ERROR]", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message,
    code: err.code
  });
});

export default app;
