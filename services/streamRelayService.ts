import { Request, Response } from 'express';
import axios from 'axios';
import { URL } from 'url';

/**
 * A robust stream proxy for bridging IPTV sources (MPEG-TS & HLS/m3u8).
 * Features:
 * - Solves provider connection limits (1 request upstream to N clients downstream)
 * - Basic caching for TS segments to optimize HLS requests
 * - Graceful timeouts and source-down error handling
 */

// Simple in-memory cache for HLS segments
interface CacheItem {
  data: Buffer;
  contentType: string;
  expiresAt: number;
}
const segmentCache = new Map<string, CacheItem>();

// Clean up expired segments every 10 seconds to save memory
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of segmentCache.entries()) {
    if (now > item.expiresAt) {
      segmentCache.delete(key);
    }
  }
}, 10000);

interface ActiveTsStream {
  url: string;
  clients: Response[];
  abortController: AbortController;
  contentType: string;
}

// Store active upstream MPEG-TS broadcast streams
const activeTsStreams = new Map<string, ActiveTsStream>();

/**
 * Proxy an MPEG-TS stream (.ts).
 * This establishes 1 upstream connection and broadcasts to N clients.
 */
export const handleMpegTsRelay = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing 'url' parameter");

  let activeStream = activeTsStreams.get(targetUrl);

  if (activeStream) {
    // Add client to existing broadcast! Upstream bandwidth saved!
    res.setHeader('Content-Type', activeStream.contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'keep-alive');
    activeStream.clients.push(res);
  } else {
    // No existing broadcast. Create one.
    const abortController = new AbortController();
    
    try {
      const sourceResponse = await axios({
        url: targetUrl,
        method: 'GET',
        responseType: 'stream',
        signal: abortController.signal,
        timeout: 15000, // Handle connection timeout gracefully
        headers: {
            "User-Agent": "IPTVSmartersPlayer" // Some providers block standard UA
        }
      });

      const contentType = sourceResponse.headers['content-type'] || 'video/mp2t';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Connection', 'keep-alive');

      activeStream = {
        url: targetUrl,
        clients: [res],
        abortController,
        contentType
      };
      
      activeTsStreams.set(targetUrl, activeStream);

      sourceResponse.data.on('data', (chunk: Buffer) => {
        const stream = activeTsStreams.get(targetUrl);
        if (stream) {
          // Push to all connected clients concurrently
          stream.clients.forEach(client => {
            if (client.writable && !client.headersSent) {
              // Ignore if headers aren't ready (which shouldn't happen here)
              client.write(chunk);
            } else if (client.writable) {
                client.write(chunk);
            }
          });
        }
      });

      sourceResponse.data.on('end', () => {
        // Source ended. Terminate all clients.
        const stream = activeTsStreams.get(targetUrl);
        if (stream) {
          stream.clients.forEach(c => c.end());
          activeTsStreams.delete(targetUrl);
        }
      });

      sourceResponse.data.on('error', (err: any) => {
        console.error(`[Stream Relay] Upstream stream error for ${targetUrl}:`, err.message);
        const stream = activeTsStreams.get(targetUrl);
        if (stream) {
          stream.clients.forEach(c => c.end());
          activeTsStreams.delete(targetUrl);
        }
      });

    } catch (error: any) {
      console.error(`[Stream Relay] Failed to connect to TS source ${targetUrl}:`, error.message);
      return res.status(502).send("Source Down or Connection Timeout");
    }
  }

  // Handle client disconnect
  req.on('close', () => {
    const stream = activeTsStreams.get(targetUrl);
    if (stream) {
      // Remove this client
      stream.clients = stream.clients.filter((c: Response) => c !== res);
      
      // If no clients left, gracefully terminate the upstream connection to save provider limits
      if (stream.clients.length === 0) {
        console.log(`[Stream Relay] 0 clients remaining for ${targetUrl}. Disconnecting upstream.`);
        stream.abortController.abort();
        activeTsStreams.delete(targetUrl);
      }
    }
  });
};

/**
 * Proxy an HLS Playlist (.m3u8).
 * Scrapes it and rewrites URIs so they pass through the proxy segment cache.
 */
export const handleHlsManifest = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing 'url' parameter");

  try {
    const sourceResponse = await axios({
      url: targetUrl,
      method: 'GET',
      responseType: 'text',
      timeout: 10000,
    });

    const manifestData = sourceResponse.data;
    const lines = manifestData.split('\n');
    let baseUrl: URL;
    
    try {
        baseUrl = new URL(targetUrl);
    } catch {
       return res.status(400).send("Invalid target URL");
    }

    const rewrittenLines = lines.map((line: string) => {
      const trimmedLine = line.trim();
      
      // If it's a metadata tag with inline URI attributes (e.g. #EXT-X-MEDIA:URI="...")
      if (trimmedLine.startsWith('#EXT')) {
        return line.replace(/URI="([^"]+)"/g, (match, uri) => {
          try {
            const absoluteUrl = new URL(uri, baseUrl).href;
            if (absoluteUrl.includes('.m3u8')) {
              return `URI="/api/relay/stream/m3u8?url=${encodeURIComponent(absoluteUrl)}"`;
            } else {
              return `URI="/api/relay/stream/segment?url=${encodeURIComponent(absoluteUrl)}"`;
            }
          } catch (e) {
            return match; // Fallback to avoid breaking regex parsing
          }
        });
      }

      // If it's a regular tag (e.g., #EXTINF) or an empty line, don't modify it
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        return line;
      }
      
      // Otherwise, it's a direct resource URI (e.g., "stream_1080p.m3u8" or "segment001.ts")
      try {
        const absoluteUrl = new URL(trimmedLine, baseUrl).href;
        if (absoluteUrl.includes('.m3u8')) {
           return `/api/relay/stream/m3u8?url=${encodeURIComponent(absoluteUrl)}`;
        } else {
           return `/api/relay/stream/segment?url=${encodeURIComponent(absoluteUrl)}`;
        }
      } catch (e) {
        return line; // Fallback
      }
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    // Prevent client-side caching of the dynamic manifest to ensure players always fetch the latest live segments
    res.setHeader('Cache-Control', 'no-cache'); 
    res.send(rewrittenLines.join('\n'));

  } catch (error: any) {
    console.error(`[Stream Relay] Failed to fetch HLS manifest ${targetUrl}:`, error.message);
    res.status(502).send("Source Down or Connection Timeout");
  }
};

/**
 * Proxy an HLS Segment (.ts).
 * This endpoint caches retrieved segments to efficiently broadcast live segments to multiple viewers.
 */
export const handleHlsSegment = async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("Missing 'url' parameter");

  // Retrieve segment from local multiplex cache
  const cachedSegment = segmentCache.get(targetUrl);
  if (cachedSegment) {
    res.setHeader('Content-Type', cachedSegment.contentType);
    res.setHeader('Cache-Control', 'public, max-age=60'); // Encourage client caching
    return res.end(cachedSegment.data);
  }

  // Not in cache, fetch from upstream provider
  try {
    const sourceResponse = await axios({
      url: targetUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    const contentType = sourceResponse.headers['content-type'] || 'video/MP2T';
    const data = Buffer.from(sourceResponse.data);

    // Cache the segment for 60 seconds (HLS segments usually last 2-10s, 60s is plenty)
    segmentCache.set(targetUrl, {
      data,
      contentType,
      expiresAt: Date.now() + 60000,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.end(data);

  } catch (error: any) {
    console.error(`[Stream Relay] Failed to fetch segment ${targetUrl}:`, error.message);
    res.status(502).send("Source Down or Segment Timeout");
  }
};
