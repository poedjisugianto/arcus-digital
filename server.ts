import fs from "fs";
import express from "express";
import app, { fetchEventForMeta } from "./api/index.ts";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const distPath = path.join(process.cwd(), "dist");

async function injectMetaTags(rawHtml: string, req: express.Request, baseUrl: string): Promise<string> {
  const eventId = (req.query.event as string) || (req.query.eventId as string);
  
  if (!eventId) {
    const fallbackImage = `${baseUrl}/og-banner.jpg`;
    return rawHtml.replace(/content="\/og-banner\.jpg"/g, `content="${fallbackImage}"`);
  }

  try {
    const eventData = await fetchEventForMeta(eventId);
    if (eventData) {
      const base = eventData.data || eventData;
      const settings = base.settings || eventData.settings || {};
      const tournamentName = (settings.tournamentName || base.name || "Turnamen Panahan").trim();
      const location = settings.location ? ` di ${settings.location}` : "";
      const dateStr = settings.eventDate ? ` (${settings.eventDate})` : "";
      
      const customDesc = settings.description 
        ? String(settings.description).substring(0, 160).replace(/["\n\r]/g, ' ') 
        : `Ikuti ${tournamentName}${location}${dateStr}. Pendaftaran online peserta dan pantau live score langsung di ARCUS Digital Archery.`;
      
      const title = `${tournamentName} | ARCUS Digital Archery`;
      const ogImageUrl = `${baseUrl}/api/og-image?event=${encodeURIComponent(eventId)}`;
      const pageUrl = `${baseUrl}${req.originalUrl}`;

      let modifiedHtml = rawHtml;
      
      // Update Title
      modifiedHtml = modifiedHtml.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
      
      // Update Open Graph tags
      modifiedHtml = modifiedHtml.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${title}" />`);
      modifiedHtml = modifiedHtml.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${customDesc}" />`);
      modifiedHtml = modifiedHtml.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${ogImageUrl}" />`);
      modifiedHtml = modifiedHtml.replace(/<meta property="og:image:secure_url" content=".*?" \/>/i, `<meta property="og:image:secure_url" content="${ogImageUrl}" />`);
      
      // Add or replace og:url
      if (modifiedHtml.includes('property="og:url"')) {
        modifiedHtml = modifiedHtml.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${pageUrl}" />`);
      } else {
        modifiedHtml = modifiedHtml.replace(
          /<meta property="og:type" content="website" \/>/i,
          `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${pageUrl}" />`
        );
      }

      // Update Twitter cards
      modifiedHtml = modifiedHtml.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${title}" />`);
      modifiedHtml = modifiedHtml.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${customDesc}" />`);
      modifiedHtml = modifiedHtml.replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${ogImageUrl}" />`);

      return modifiedHtml;
    }
  } catch (err: any) {
    console.warn(`[META-INJECTION] Warning for event ${eventId}:`, err.message);
  }

  const fallbackImage = `${baseUrl}/og-banner.jpg`;
  return rawHtml.replace(/content="\/og-banner\.jpg"/g, `content="${fallbackImage}"`);
}

async function startServer() {
  const PORT = 3000;

  try {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "custom",
      });
      app.use(vite.middlewares);

      // Handle HTML requests with event Open Graph dynamic injection
      app.use("*", async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith("/api") || path.extname(req.path)) {
          return next();
        }

        try {
          const indexPath = path.resolve(process.cwd(), "index.html");
          const rawIndex = fs.readFileSync(indexPath, "utf-8");
          const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
          const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
          const baseUrl = `${protocol}://${hostHeader}`;
          
          const injectedHtml = await injectMetaTags(rawIndex, req, baseUrl);
          const finalHtml = await vite.transformIndexHtml(url, injectedHtml);
          res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
        } catch (e: any) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
    } else {
      // Serve static files in production
      app.use(express.static(distPath, { index: false }));
      app.get("*", async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith("/api") || path.extname(req.path)) {
          return next();
        }

        try {
          const indexPath = path.join(distPath, "index.html");
          const rawIndex = fs.readFileSync(indexPath, "utf-8");
          const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
          const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
          const baseUrl = `${protocol}://${hostHeader}`;

          const finalHtml = await injectMetaTags(rawIndex, req, baseUrl);
          res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
        } catch (e) {
          next(e);
        }
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
