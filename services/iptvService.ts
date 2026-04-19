
import { IptvConfig, Source, EPGData } from "../types";

class IptvService {
  private PROXY_BASE = "/api/iptv-proxy?url=";
  private REGISTRY_KEY = "arena_global_channels";
  private TUNNEL_ACTIVE_KEY = "arena_tunnel_active";
  private PLAYLISTS_KEY = "arena_playlists";
  private registryCache: Source[] | null = null;

  isTunnelActive(): boolean {
    // Default to true now that we have a reliable server proxy
    const val = localStorage.getItem(this.TUNNEL_ACTIVE_KEY);
    return val === null ? true : val === 'true';
  }

  setTunnelActive(active: boolean) {
    localStorage.setItem(this.TUNNEL_ACTIVE_KEY, String(active));
  }

  getPlaylists(): IptvConfig[] {
    const data = localStorage.getItem(this.PLAYLISTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  savePlaylist(config: IptvConfig) {
    const playlists = this.getPlaylists();
    const index = playlists.findIndex(p => p.id === config.id);
    if (index !== -1) {
      playlists[index] = config;
    } else {
      playlists.push(config);
    }
    localStorage.setItem(this.PLAYLISTS_KEY, JSON.stringify(playlists));
  }

  removePlaylist(id: string) {
    const playlists = this.getPlaylists().filter(p => p.id !== id);
    localStorage.setItem(this.PLAYLISTS_KEY, JSON.stringify(playlists));
    
    // Also remove channels associated with this playlist
    const registry = this.getGlobalRegistry().filter(c => c.playlistId !== id);
    localStorage.setItem(this.REGISTRY_KEY, JSON.stringify(registry));
    this.registryCache = registry;
  }

  async fetchChannels(config: IptvConfig): Promise<Source[]> {
    // If tunnel is disabled, try direct browser fetch first
    if (!this.isTunnelActive() && config.m3uUrl) {
      try {
        console.log("Attempting direct browser fetch...");
        const response = await fetch(config.m3uUrl);
        if (response.ok) {
          const content = await response.text();
          return this.parseM3u(content);
        }
      } catch (err) {
        console.warn("Direct fetch failed (likely CORS), falling back to server proxy:", err);
      }
    }

    try {
      const response = await fetch('/api/iptv/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...config,
          tunnel: this.isTunnelActive()
        })
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response received:", text.substring(0, 200));
        const snippet = text.substring(0, 100).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        throw new Error(`Server returned an invalid response (Status: ${response.status}). This often happens with large playlists or server timeouts. Response start: ${snippet}...`);
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Server returned ${response.status}`);
      }

      return data;
    } catch (err: any) {
      console.error("IPTV Sync Error:", err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.includes('Unexpected token')) {
        throw new Error("Arena Signal Interrupted. The server might be restarting or unreachable.");
      }
      throw err;
    }
  }

  private parseM3u(content: string): Source[] {
    const lines = content.split("\n");
    const channels: Source[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#EXTINF:")) {
        const info = line;
        const nameMatch = info.match(/,(.*)$/);
        const name = nameMatch ? nameMatch[1].trim() : "";
        
        if (!name || name.toLowerCase().includes("unknown channel") || name.toLowerCase().includes("unknown_channel")) {
          // Skip unknown channels
          continue;
        }
        
        const logoMatch = info.match(/tvg-logo="([^"]+)"/);
        const logo = logoMatch ? logoMatch[1] : "";
        
        const groupMatch = info.match(/group-title="([^"]+)"/);
        const group = groupMatch ? groupMatch[1] : "General";

        // Look for the URL in the following lines, skipping other tags
        let url = "";
        let groupFromExtGrp = "";
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (!nextLine) continue;
          if (nextLine.startsWith("#")) {
            if (nextLine.startsWith("#EXTGRP:")) {
              groupFromExtGrp = nextLine.replace("#EXTGRP:", "").trim();
            }
            continue;
          }
          url = nextLine;
          i = j; // Advance outer loop to the URL line
          break;
        }

        const finalGroup = (group === "General" && groupFromExtGrp) ? groupFromExtGrp : group;

        if (url) {
          channels.push({ name, url, logo, group: finalGroup });
        }
      }
    }
    return channels;
  }

  async fetchEPG(url: string): Promise<EPGData> {
    try {
      const response = await fetch(`/api/iptv/epg?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error("Failed to fetch EPG");
      return await response.json();
    } catch (err) {
      console.error("EPG Fetch Error:", err);
      return {};
    }
  }

  getGlobalRegistry(): Source[] {
    if (this.registryCache) return this.registryCache;
    const data = localStorage.getItem(this.REGISTRY_KEY);
    this.registryCache = data ? JSON.parse(data) : [];
    return this.registryCache!;
  }

  wrapWithProxy(uri: string): string {
    if (!this.isTunnelActive()) return uri;
    if (uri.startsWith('/api/iptv-proxy')) return uri; // Already wrapped
    return `/api/iptv-proxy?url=${encodeURIComponent(uri)}`;
  }

  saveToRegistry(channel: Source) {
    const registry = this.getGlobalRegistry();
    if (registry.some(c => c.url === channel.url)) return;
    registry.push(channel);
    try {
      const serialized = JSON.stringify(registry);
      if (serialized.length > 4.5 * 1024 * 1024) {
        throw new Error("Registry full. Browser storage limit reached.");
      }
      localStorage.setItem(this.REGISTRY_KEY, serialized);
      this.registryCache = registry;
    } catch (e: any) {
      console.error("Failed to save to registry:", e);
      if (e.name === 'QuotaExceededError' || e.message?.includes('limit')) {
        throw new Error("Storage quota exceeded. Cannot add more channels.");
      }
      throw new Error("Failed to save channel.");
    }
  }

  saveManyToRegistry(channels: Source[]) {
    const registry = this.getGlobalRegistry();
    const seenUrls = new Set(registry.map(c => c.url));
    
    let added = 0;
    channels.forEach(channel => {
      if (!seenUrls.has(channel.url)) {
        registry.push(channel);
        seenUrls.add(channel.url);
        added++;
      }
    });

    if (added > 0) {
      try {
        const serialized = JSON.stringify(registry);
        // Check if serialized size is approaching localStorage limit (usually 5MB)
        if (serialized.length > 4.5 * 1024 * 1024) {
           throw new Error("Playlist too large. Browser storage limit reached.");
        }
        localStorage.setItem(this.REGISTRY_KEY, serialized);
        this.registryCache = registry;
      } catch (e: any) {
        console.error("Failed to save to registry:", e);
        if (e.name === 'QuotaExceededError' || e.message?.includes('limit')) {
          throw new Error("Storage quota exceeded. Your playlist is too large. Try importing fewer channels or clearing your registry.");
        }
        throw new Error("Failed to save channels to local storage.");
      }
    }
  }

  updateInRegistry(url: string, newName: string) {
    const registry = this.getGlobalRegistry();
    const index = registry.findIndex(c => c.url === url);
    if (index !== -1) {
      registry[index].name = newName;
      localStorage.setItem(this.REGISTRY_KEY, JSON.stringify(registry));
      this.registryCache = registry;
    }
  }

  removeFromRegistry(url: string) {
    const registry = this.getGlobalRegistry().filter(c => c.url !== url);
    localStorage.setItem(this.REGISTRY_KEY, JSON.stringify(registry));
    this.registryCache = registry;
  }

  saveMatchMapping(matchId: string, sources: Source[]) {
    localStorage.setItem(`match_src_${matchId}`, JSON.stringify(sources));
  }

  getMatchMapping(matchId: string): Source[] {
    const data = localStorage.getItem(`match_src_${matchId}`);
    return data ? JSON.parse(data) : [];
  }
}

export const iptvService = new IptvService();
