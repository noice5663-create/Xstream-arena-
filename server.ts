import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import path from "path";
import { initDatabase, saveFixtures, getAllFixtures } from "./services/databaseService";
import { handleMpegTsRelay, handleHlsManifest, handleHlsSegment } from "./services/streamRelayService";
import { Fixture } from "./types";

// Initialize the database
initDatabase();

interface Match {
  id: string;
  time: string;
  teams: string;
  competition: string;
  channels: string[];
  source: string;
  date?: string;
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const IPTV_USER_AGENT = "IPTVSmartersPlayer";

// Scraper for livesoccertv.com (French version as requested)
async function scrapeLiveSoccerTV(): Promise<Fixture[]> {
  const urls = [
    "https://www.livesoccertv.com/",
    "https://www.livesoccertv.com/fr/",
    "https://www.livesoccertv.com/schedules/", 
    "https://www.livesoccertv.com/schedules/today/",
    "https://www.livesoccertv.com/schedules/tomorrow/",
    "https://www.livesoccertv.com/competitions/italy/serie-a/",
    "https://www.livesoccertv.com/competitions/england/premier-league/",
    "https://www.livesoccertv.com/competitions/spain/la-liga/",
    "https://www.livesoccertv.com/competitions/germany/bundesliga/",
    "https://www.livesoccertv.com/competitions/france/ligue-1/",
    "https://www.livesoccertv.com/competitions/algeria/ligue-1/",
    "https://www.livesoccertv.com/competitions/international/world-cup-qualifying-uefa/",
    "https://www.livesoccertv.com/competitions/international/uefa-champions-league/",
    "https://www.livesoccertv.com/fr/competitions/italy/serie-a/",
    "https://www.livesoccertv.com/fr/schedules/today/",
    "https://www.livesoccertv.com/fr/schedules/tomorrow/"
  ];

  const allFixtures: Fixture[] = [];

  const scrapePage = async (url: string, delay: number = 0) => {
    try {
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      
      const { data } = await axios.get(url, {
        headers: { 
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,fr-FR,fr;q=0.8",
          "Referer": "https://www.google.com/",
          "Cache-Control": "no-cache"
        },
        timeout: 5000,
        validateStatus: (status) => status < 500
      });

      if (typeof data !== 'string' || data.length < 100) return [];

      const $ = cheerio.load(data);
      const fixtures: Fixture[] = [];

      // Improved selectors for match rows
      $(".match_row, tr[id^='match'], .match-row, .match_data, .match-data, .fixture_row, .event_row").each((i, el) => {
        const $el = $(el);
        const time = $el.find(".time, .match_time, .match-time, .m_time, .fixture_time, .event_time").text().trim();
        const home = $el.find(".home, .team_home, .team-home, .m_home, .fixture_home, .event_home").text().trim();
        const away = $el.find(".away, .team_away, .team-away, .m_away, .fixture_away, .event_away").text().trim();
        const competition = $el.find(".comp, .competition_name, .competition-name, .m_comp, .fixture_comp, .event_comp").text().trim();
        
        const broadcasters: string[] = [];
        
        const addBroadcaster = (name: string) => {
            if (!name) return;
            const clean = name
                .replace(/\(geo.*?\)/gi, '')
                .replace(/\(\$.*?\)/gi, '')
                .replace(/\(R\)/gi, '')
                .replace(/HD|SD|4K/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (clean && clean.length > 1 && !broadcasters.includes(clean)) {
                broadcasters.push(clean);
            }
        };

        // 1. Check next row (common in schedules)
        const channelsRow = $el.next(".channels_row, .m_channels, .broadcasters_row, .channels-row, .fixture_channels");
        if (channelsRow.length) {
          channelsRow.find("a, span, li, div, .channel-name").each((j, ch) => {
            const $ch = $(ch);
            if ($ch.children().length === 0 || $ch.is('a') || $ch.hasClass('channel-name')) {
                addBroadcaster($ch.text());
            }
          });
          // Also check text content if no tags found
          if (broadcasters.length === 0) {
              channelsRow.text().split(/[,/|•\n]/).forEach(p => addBroadcaster(p));
          }
          
          // Specific check for Starzplay/Shasha in channelsRow text
          const rowText = channelsRow.text().toLowerCase();
          if (rowText.includes("starzplay")) addBroadcaster("Starzplay");
          if (rowText.includes("shasha")) addBroadcaster("ShaSha");
          if (rowText.includes("stc tv")) addBroadcaster("stc tv");
          if (rowText.includes("tod")) addBroadcaster("TOD");
        }

        // 2. Check within the row itself
        $el.find(".channels a, .broadcasters a, .m_channels a, .channels span, .broadcasters span, .bt-list a, .channel-link").each((j, ch) => {
          addBroadcaster($(ch).text());
        });

        // 3. Check for specific streaming service links/icons or data attributes
        $el.find(".stream_link, .live_stream, [title*='Stream'], [title*='Live'], .online-link, .watch-live").each((j, ch) => {
            const title = $(ch).attr('title') || $(ch).text();
            if (title) addBroadcaster(title);
        });

        // 4. Check for Starzplay / Shasha specifically if they are in text
        const rowText = $el.text().toLowerCase();
        if (rowText.includes("starzplay")) addBroadcaster("Starzplay");
        if (rowText.includes("shasha")) addBroadcaster("ShaSha");
        if (rowText.includes("stc tv")) addBroadcaster("stc tv");
        if (rowText.includes("tod")) addBroadcaster("TOD");

        if (home && away && (broadcasters.length > 0 || time)) {
          fixtures.push({
            home_team: home,
            away_team: away,
            match_time: time,
            competition: competition || (url.includes("ligue-1") ? "Algeria Ligue 1" : url.includes("serie-a") ? "Serie A" : "Football"),
            source: "Live Soccer TV",
            broadcasters
          });
        }
      });
      return fixtures;
    } catch (error) {
      console.error(`Error scraping Live Soccer TV (${url}):`, error);
      return [];
    }
  };

  const results = await Promise.all(urls.map((url, i) => scrapePage(url, i * 500)));
  results.forEach(f => allFixtures.push(...f));

  // Deduplicate and MERGE broadcasters
  const mergedFixtures: Record<string, Fixture> = {};
  
  allFixtures.forEach(f => {
      const homeNorm = f.home_team.toLowerCase().trim();
      const awayNorm = f.away_team.toLowerCase().trim();
      const key = `${homeNorm}_${awayNorm}`;
      
      if (!mergedFixtures[key]) {
          mergedFixtures[key] = { ...f };
      } else {
          // Merge broadcasters
          if (f.broadcasters) {
              f.broadcasters.forEach(b => {
                  if (!mergedFixtures[key].broadcasters?.includes(b)) {
                      mergedFixtures[key].broadcasters?.push(b);
                  }
              });
          }
          // Prefer competition name if current is generic
          if ((mergedFixtures[key].competition === "Football" || !mergedFixtures[key].competition) && f.competition) {
              mergedFixtures[key].competition = f.competition;
          }
      }
  });

  return Object.values(mergedFixtures);
}

// Scraper for sporteventz.com
async function scrapeSportEventz(): Promise<Fixture[]> {
  const urls = [
    "https://www.sporteventz.com/en/",
    "https://www.sporteventz.com/en/football",
    "https://www.sporteventz.com/en/live-on-tv"
  ];
  
  const allFixtures: Fixture[] = [];

  const scrapePage = async (url: string, delay: number = 0): Promise<Fixture[]> => {
    const pageFixtures: Fixture[] = [];
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const { data } = await axios.get(url, {
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.google.com/"
        },
        timeout: 5000
      });
      const $ = cheerio.load(data);

      // SportEventz structure often uses event-row or match-row
      $(".event-row, .match-row, .event, .match, .event-list-item, tr.event, div.event").each((i, el) => {
        const $el = $(el);
        const time = $el.find(".time, .event-time, .match-time, .event-date").text().trim();
        const home = $el.find(".home-team, .team-home, .home, .event-home").text().trim();
        const away = $el.find(".away-team, .team-away, .away, .event-away").text().trim();
        const teams = $el.find(".match-name, .event-name, .teams, .event-title").text().trim();
        const competition = $el.find(".competition, .tournament-name, .league, .event-competition").text().trim();
        
        const broadcasters: string[] = [];
        $el.find(".channel-name, .broadcaster-name, .channel, a[href*='channel'], .station-name, .event-channels a").each((j, ch) => {
          const name = $(ch).text().trim();
          if (name && !broadcasters.includes(name)) broadcasters.push(name);
        });

        if ((home && away) || teams) {
          pageFixtures.push({
            home_team: home || teams.split(" vs ")[0] || teams,
            away_team: away || teams.split(" vs ")[1] || "TBD",
            match_time: time,
            competition,
            source: "SportEventz",
            broadcasters: broadcasters.length > 0 ? broadcasters : []
          });
        }
      });
    } catch (error: any) {
      console.error(`Error scraping SportEventz (${url}):`, error.message);
    }
    return pageFixtures;
  };

  const results = await Promise.all(urls.map((url, i) => scrapePage(url, i * 200)));
  results.forEach(f => allFixtures.push(...f));

  return allFixtures;
}

// Scraper for LiveOnSat (Mobile version with multiple fallbacks)
async function scrapeLiveOnSat(): Promise<Fixture[]> {
  const allFixtures: Fixture[] = [];
  const daysToScrape = [0, 1, 2]; // Scrape today, tomorrow, and day after

  const scrapeDay = async (day: number, delay: number = 0): Promise<Fixture[]> => {
    const dayFixtures: Fixture[] = [];
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Try mobile site first, then fallback to quick-selection if it fails with 521
      const mobileUrl = day === 0 ? "https://m.liveonsat.com/" : `https://m.liveonsat.com/?selDay=${day}`;
      
      let data: string = "";
      try {
        const response = await axios.get(mobileUrl, {
          headers: { 
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/"
          },
          timeout: 5000 // Shorter timeout
        });
        data = response.data;
      } catch (err: any) {
        if (err.response?.status === 521 || err.response?.status === 403 || err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
          console.warn(`LiveOnSat Mobile Day ${day} failed (${err.response?.status || err.code}), trying quick-selection fallback...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Fallback to quick-selection
          const fallbackUrl = "https://liveonsat.com/quick-selection.php";
          try {
            const response = await axios.get(fallbackUrl, {
              headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Referer": "https://www.google.com/"
              },
              timeout: 5000
            });
            data = response.data;
          } catch (fallbackErr: any) {
             console.warn(`LiveOnSat Quick-Selection fallback also failed: ${fallbackErr.message}`);
             // Final fallback: try the main international page
             try {
               const intUrl = "https://liveonsat.com/los_int.php";
               const response = await axios.get(intUrl, {
                  headers: { 
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Referer": "https://www.bing.com/"
                  },
                  timeout: 5000
               });
               data = response.data;
             } catch (intErr: any) {
               console.warn(`LiveOnSat International fallback also failed: ${intErr.message}`);
               return [];
             }
          }
        } else {
          throw err;
        }
      }

      if (!data || typeof data !== 'string') return [];

      const $ = cheerio.load(data);

      let currentCompetition = "Football";

      // Iterate through all elements to maintain order
      $("body").find("div, table, tr").each((i, el) => {
          const $el = $(el);
          
          // Detect competition headers
          if ($el.hasClass("comp_head")) {
              currentCompetition = $el.text().trim();
          }

          // Detect match rows (div with onclick containing expandContract)
          const onclick = $el.attr("onclick");
          if (onclick && onclick.includes("expandContract")) {
              const matchIdMatch = onclick.match(/expandContract\('(\d+)'\)/);
              if (matchIdMatch) {
                  const matchId = matchIdMatch[1];
                  const teamsText = $el.find("td").eq(1).text().trim();
                  
                  if (teamsText && (teamsText.includes(" v ") || teamsText.includes(" vs "))) {
                      const [home, away] = teamsText.split(/\s+v(?:s)?\s+/i);
                      
                      // Find the time - it's usually in the next table
                      const nextTable = $el.nextAll("table").first();
                      const timeText = nextTable.text().trim();
                      const timeMatch = timeText.match(/ST:\s*(\d{2}:\d{2})/);
                      const time = timeMatch ? timeMatch[1] : "TBD";

                      // Find the channels - they are in the div with id expand-contract + matchId
                      const channelsDiv = $(`#expand-contract${matchId}`);
                      let broadcasters: string[] = [];
                      
                      const cleanChannelName = (name: string) => {
                          return name
                              .replace(/\(geo.*?\)/gi, '')
                              .replace(/\(\$.*?\)/gi, '')
                              .replace(/\(R\)/gi, '')
                              .replace(/HD|SD|4K/g, '')
                              .replace(/\s+/g, ' ')
                              .trim();
                      };

                      // 1. Try to find channels in the specific link tags
                      channelsDiv.find("a").each((j, ch) => {
                          const rawName = $(ch).text();
                          const chName = cleanChannelName(rawName);
                          if (chName && chName.length > 2 && !broadcasters.includes(chName)) {
                              broadcasters.push(chName);
                          }
                      });

                      // 2. If no channels found in links, try to parse the text content
                      if (broadcasters.length === 0) {
                          const chText = channelsDiv.text();
                          if (chText) {
                              // Split by common delimiters and clean
                              const parts = chText.split(/[,/|•]/);
                              parts.forEach(p => {
                                  const chName = cleanChannelName(p);
                                  if (chName && chName.length > 2 && !broadcasters.includes(chName)) {
                                      broadcasters.push(chName);
                                  }
                              });
                          }
                      }

                      if (home && away && broadcasters.length > 0) {
                          const fixture: Fixture = {
                              home_team: home.trim(),
                              away_team: away.trim(),
                              match_time: time,
                              competition: currentCompetition,
                              source: "LiveOnSat",
                              broadcasters
                          };
                          dayFixtures.push(fixture);
                      }
                  }
              }
          }
      });
    } catch (error: any) {
      console.error(`Error scraping LiveOnSat Mobile (Day ${day}):`, error.message);
    }
    return dayFixtures;
  };

  const results = await Promise.all(daysToScrape.map((day, i) => scrapeDay(day, i * 200)));
  results.forEach(dayFixtures => allFixtures.push(...dayFixtures));

  // Deduplicate
  return allFixtures.filter((f, index, self) => 
    index === self.findIndex((t) => t.home_team === f.home_team && t.away_team === f.away_team)
  );
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Helper to normalize team names for better merging
const normTeam = (name: string) => {
  if (!name) return "";
  try {
    return name.toLowerCase()
      .replace(/manchester united/g, 'man utd')
      .replace(/manchester city/g, 'man city')
      .replace(/tottenham hotspur/g, 'spurs')
      .replace(/brighton & hove albion/g, 'brighton')
      .replace(/west ham united/g, 'west ham')
      .replace(/newcastle united/g, 'newcastle')
      .replace(/sheffield united/g, 'sheffield utd')
      .replace(/wolverhampton wanderers/g, 'wolves')
      .replace(/leicester city/g, 'leicester')
      .replace(/norwich city/g, 'norwich')
      .replace(/swansea city/g, 'swansea')
      .replace(/cardiff city/g, 'cardiff')
      .replace(/hull city/g, 'hull')
      .replace(/stoke city/g, 'stoke')
      .replace(/&/g, 'and')
      .replace(/\b(fc|cf|sc|u21|u23|u19|reserves|youth|women|ladies|men|boys|girls)\b/g, '') // Remove common suffixes
      .replace(/[^a-z0-9]/g, '')
      .trim();
  } catch (e) {
    return "";
  }
};

// Shared function to merge fixtures from multiple sources
function mergeFixtures(allFixtures: Fixture[]): Fixture[] {
  const mergedMap = new Map<string, Fixture>();

  allFixtures.forEach(f => {
    if (!f || !f.home_team || !f.away_team) return;
    
    const team1 = normTeam(f.home_team);
    const team2 = normTeam(f.away_team);
    
    if (!team1 || !team2) return;
    
    const key = team1 < team2 ? `${team1}_${team2}` : `${team2}_${team1}`;
    
    const existing = mergedMap.get(key);
    if (existing) {
      // Merge broadcasters
      const broadcasters = new Set(existing.broadcasters || []);
      f.broadcasters?.forEach(ch => {
        if (ch) broadcasters.add(ch);
      });
      existing.broadcasters = Array.from(broadcasters);
      
      // Update competition if missing
      if (!existing.competition && f.competition) {
        existing.competition = f.competition;
      }
      
      // Combine sources
      if (f.source && !existing.source.includes(f.source)) {
        existing.source = `${existing.source}, ${f.source}`;
      }
    } else {
      mergedMap.set(key, { ...f });
    }
  });

  return Array.from(mergedMap.values());
}

// LiveOnSat Dedicated Endpoint
app.get("/api/liveonsat", async (req, res) => {
  try {
    const liveOnSat = await scrapeLiveOnSat();
    const formatted = liveOnSat.map(m => ({
      teams: `${m.home_team} vs ${m.away_team}`,
      channels: m.broadcasters || [],
      competition: m.competition,
      source: "LiveOnSat"
    }));
    res.json(formatted);
  } catch (error: any) {
    console.error("LiveOnSat Endpoint Error:", error.message);
    res.status(500).json({ error: "Failed to scrape LiveOnSat" });
  }
});

// LiveSoccerTV Dedicated Endpoint
app.get("/api/livesoccertv", async (req, res) => {
  try {
    const liveSoccerTV = await scrapeLiveSoccerTV();
    const formatted = liveSoccerTV.map(m => ({
      teams: `${m.home_team} vs ${m.away_team}`,
      channels: m.broadcasters || [],
      competition: m.competition,
      source: "Live Soccer TV"
    }));
    res.json(formatted);
  } catch (error: any) {
    console.error("LiveSoccerTV Endpoint Error:", error.message);
    res.status(500).json({ error: "Failed to scrape LiveSoccerTV" });
  }
});

// SportEventz Dedicated Endpoint
app.get("/api/sporteventz", async (req, res) => {
  try {
    const sportEventz = await scrapeSportEventz();
    const formatted = sportEventz.map(m => ({
      teams: `${m.home_team} vs ${m.away_team}`,
      channels: m.broadcasters || [],
      competition: m.competition,
      source: "SportEventz"
    }));
    res.json(formatted);
  } catch (error: any) {
    console.error("SportEventz Endpoint Error:", error.message);
    res.status(500).json({ error: "Failed to scrape SportEventz" });
  }
});

// SofaScore Proxy Routes
const SOFASCORE_API = "https://api.sofascore.com/api/v1";

app.get("/api/sofascore/*", async (req, res) => {
  const path = req.params[0];
  const query = req.query;
  const isImage = path.endsWith('/image');
  
  try {
    const url = `${SOFASCORE_API}/${path}`;
    const response = await axios.get(url, {
      params: query,
      headers: { "User-Agent": USER_AGENT },
      responseType: isImage ? 'stream' : 'json',
      timeout: 5000
    });
    
    if (isImage) {
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
      response.data.pipe(res);
    } else {
      res.json(response.data);
    }
  } catch (error: any) {
    if (isImage) {
      // Return a transparent 1x1 pixel or a placeholder if image fails
      res.status(404).end();
    } else {
      res.status(error.response?.status || 500).json(error.response?.data || { error: "SofaScore API Error" });
    }
  }
});

// Stream Relay Routes
app.get("/api/relay/stream/ts", handleMpegTsRelay);
app.get("/api/relay/stream/m3u8", handleHlsManifest);
app.get("/api/relay/stream/segment", handleHlsSegment);

// IPTV Proxy & EPG Routes
app.get("/api/iptv/epg", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    const { data } = await axios.get(url as string);
    res.send(data); // EPG is usually XML
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/iptv-proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    const response = await axios.get(url as string, {
      responseType: 'stream',
      headers: { "User-Agent": USER_AGENT }
    });
    response.data.pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/matches/scraped", async (req, res) => {
  try {
    const fixtures = getAllFixtures();
    
    if (fixtures.length === 0) {
      const results = await Promise.all([
        scrapeSportEventz().catch(() => []),
        scrapeLiveOnSat().catch(() => [])
      ]);
      const allMatches = results.flat();
      const merged = mergeFixtures(allMatches);
      saveFixtures(merged);
      return res.json(merged);
    }

    res.json(fixtures);
  } catch (error: any) {
    console.error("Error fetching scraped matches:", error);
    res.status(500).json({ error: "Failed to fetch scraped matches" });
  }
});

// Trigger a manual scrape
app.post("/api/matches/scrape-now", async (req, res) => {
  try {
    const results = await Promise.all([
      scrapeSportEventz().catch(e => { console.error("SportEventz Scrape Error:", e.message); return []; }),
      scrapeLiveOnSat().catch(e => { console.error("LiveOnSat Scrape Error:", e.message); return []; })
    ]);
    const allMatches = results.flat();
    const merged = mergeFixtures(allMatches);
    saveFixtures(merged);
    res.json(merged);
  } catch (error: any) {
    console.error("Manual Scrape Error:", error);
    res.status(500).json({ error: "Failed to perform manual scrape" });
  }
});

// IPTV Routes expected by the frontend
app.post("/api/iptv/fetch", async (req, res) => {
  const { m3uUrl, type, host, port, username, password } = req.body;
  
  try {
    let data = "";
    
    if (type === 'xtream' && host) {
      const baseUrl = host.endsWith('/') ? host.slice(0, -1) : host;
      const fullHost = baseUrl.includes('://') ? baseUrl : `http://${baseUrl}`;
      const url = `${fullHost}${port ? `:${port}` : ''}/get.php?username=${username}&password=${password}&type=m3u_plus&output=ts`;
      
      console.log(`Fetching Xtream M3U: ${url}`);
      
      const response = await axios.get(url, {
        headers: { 
          "User-Agent": IPTV_USER_AGENT,
          "Accept": "*/*",
          "Connection": "keep-alive"
        },
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024
      });
      data = response.data;
    } else if (m3uUrl) {
      console.log(`Fetching M3U URL: ${m3uUrl}`);
      const response = await axios.get(m3uUrl, {
        headers: { 
          "User-Agent": IPTV_USER_AGENT,
          "Accept": "*/*",
          "Connection": "keep-alive"
        },
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024
      });
      data = response.data;
    } else {
      return res.status(400).json({ error: "M3U URL or Xtream config is required" });
    }

    if (typeof data !== 'string') {
      return res.status(500).json({ error: "Invalid response from IPTV provider" });
    }

    // Check for common error messages in the response body
    const lowerData = data.toLowerCase();
    if (lowerData.includes("invalid username") || lowerData.includes("invalid password") || lowerData.includes("authentication failed")) {
      return res.status(401).json({ error: "IPTV Provider: Invalid credentials." });
    }
    if (lowerData.includes("account expired") || lowerData.includes("subscription expired")) {
      return res.status(403).json({ error: "IPTV Provider: Account expired." });
    }
    if (data.trim().startsWith("<!DOCTYPE html") || data.trim().startsWith("<html")) {
      return res.status(500).json({ error: "IPTV Provider returned an HTML page instead of a playlist. This usually happens when redirected to a login or error page." });
    }

    const lines = data.split(/\r?\n/);
    const channels: any[] = [];
    const MAX_CHANNELS = 30000;

    let currentChannel: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle #EXTINF line
      if (line.toUpperCase().startsWith("#EXTINF:")) {
        const info = line;
        
        // Extract name: everything after the last comma
        const nameMatch = info.match(/,(.*)$/);
        const name = nameMatch ? nameMatch[1].trim() : "";
        
        if (!name || name.toLowerCase().includes("unknown channel") || name.toLowerCase().includes("unknown_channel")) {
          currentChannel = null;
          continue;
        }
        
        // Extract logo
        const logoMatch = info.match(/tvg-logo="([^"]+)"/i);
        const logo = logoMatch ? logoMatch[1] : "";
        
        // Extract group
        const groupMatch = info.match(/group-title="([^"]+)"/i);
        const group = groupMatch ? groupMatch[1] : "General";

        currentChannel = { name, logo, group, url: "" };
      } 
      // Handle #EXTGRP line (alternative group tag)
      else if (line.toUpperCase().startsWith("#EXTGRP:")) {
        if (currentChannel && (currentChannel.group === "General" || !currentChannel.group)) {
          currentChannel.group = line.substring(8).trim();
        }
      } 
      // Handle URL line (anything not starting with #)
      else if (!line.startsWith("#")) {
        if (currentChannel) {
          currentChannel.url = line;
          channels.push(currentChannel);
          currentChannel = null;
          if (channels.length >= MAX_CHANNELS) break;
        } else if (line.startsWith("http")) {
          // Some M3U files just list URLs without #EXTINF
          const name = line.split('/').pop() || "";
          if (name && !name.toLowerCase().includes("unknown channel") && !name.toLowerCase().includes("unknown_channel")) {
            channels.push({ 
              name, 
              url: line, 
              logo: "", 
              group: "General" 
            });
            if (channels.length >= MAX_CHANNELS) break;
          }
        }
      }
    }

    console.log(`Parsed ${channels.length} channels from playlist.`);
    res.json(channels);
  } catch (error: any) {
    console.error("IPTV Fetch Error:", error.message);
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const errorMsg = typeof data === 'string' ? data.substring(0, 150) : 'Check your credentials or URL.';
      
      if (status === 403 || status === 401) {
        return res.status(status).json({ error: `Access Denied (${status}). Your credentials might be wrong or the provider is blocking the server IP.` });
      }
      if (status === 885) {
        return res.status(500).json({ error: "IPTV Provider blocked the request (Status 885). This usually means your IP is blocked or a specific User-Agent is required." });
      }
      return res.status(status).json({ error: `IPTV Provider Error (${status}): ${errorMsg}` });
    } else if (error.code === 'ECONNABORTED') {
      return res.status(500).json({ error: "Connection timed out. The playlist might be too large or the server is slow." });
    } else if (error.request) {
      return res.status(500).json({ error: "No response from IPTV provider. The server might be down or blocking our IP." });
    }
    
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
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
