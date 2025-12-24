
import { GoogleGenAI, Type } from "@google/genai";
import { Match, MatchDetail, Source, Player, MatchStats, Incident, NewsItem, Standing } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CHANNEL_DB: Record<string, string> = {
    "beIN SPORTS Premium 1": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3221",
    "beIN SPORTS Premium 2": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3222",
    "beIN SPORTS Premium 3": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3224",
    "Sky Sports Main Event": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/838",
    "BT Sport 1 HD": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/839",
    "AR: ON Time Sport 1": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/507",
    "AR: AD Sport 1": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/112",
    "DAZN LaLiga": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/4287",
    "Movistar LaLiga": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/4290",
    "UGEEN IPTV": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3019",
};

export const getAllChannels = (): Source[] => {
    return Object.entries(CHANNEL_DB).map(([title, uri]) => ({ title, uri }));
};

const mapSofaEventToMatch = (event: any): Match => {
    const dateObj = new Date(event.startTimestamp * 1000);
    const localDate = dateObj.toISOString().split('T')[0];
    
    const isLive = event.status.type === 'inprogress';
    const isFinished = event.status.type === 'finished';
    
    let displayTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (isLive) {
        displayTime = event.status.description || 'Live';
    } else if (isFinished) {
        displayTime = 'FT';
    }

    const leagueLogoId = event.tournament?.uniqueTournament?.id || event.tournament?.id;
    const isUnique = !!event.tournament?.uniqueTournament?.id;
    const logoUrl = leagueLogoId 
        ? `https://www.sofascore.com/api/v1/${isUnique ? 'unique-tournament' : 'tournament'}/${leagueLogoId}/image` 
        : undefined;

    return {
        id: event.id.toString(),
        league: event.tournament?.name || 'Tournament',
        leagueLogo: logoUrl,
        homeTeam: {
            name: event.homeTeam.name,
            logo: `https://www.sofascore.com/api/v1/team/${event.homeTeam.id}/image`,
            score: event.homeScore?.current ?? 0
        },
        awayTeam: {
            name: event.awayTeam.name,
            logo: `https://www.sofascore.com/api/v1/team/${event.awayTeam.id}/image`,
            score: event.awayScore?.current ?? 0
        },
        status: isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED',
        time: displayTime,
        date: localDate,
        timestamp: event.startTimestamp,
        sources: getAllChannels().slice(0, 3)
    };
};

export const fetchLiveMatches = async (): Promise<Match[]> => {
    try {
        const response = await fetch('https://api.sofascore.com/api/v1/sport/football/events/live');
        const data = await response.json();
        return (data.events || []).map(mapSofaEventToMatch);
    } catch (err) {
        return [];
    }
};

export const fetchMatchesForDate = async (dateStr: string): Promise<Match[]> => {
    try {
        const response = await fetch(`https://api.sofascore.com/api/v1/sport/football/scheduled-events/${dateStr}`);
        const data = await response.json();
        return (data.events || []).map(mapSofaEventToMatch);
    } catch (err) {
        return [];
    }
};

export const fetchLeagueStandings = async (tournamentId: string, seasonId?: string): Promise<Standing[]> => {
    try {
        let targetSeasonId = seasonId;
        if (!targetSeasonId) {
            const seasonsRes = await fetch(`https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/seasons`);
            const seasonsData = await seasonsRes.json();
            targetSeasonId = seasonsData.seasons?.[0]?.id;
        }

        if (!targetSeasonId) return [];

        const standingsRes = await fetch(`https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/season/${targetSeasonId}/standings/total`);
        const standingsData = await standingsRes.json();
        const rows = standingsData.standings?.[0]?.rows || [];

        return rows.map((row: any) => ({
            rank: row.position,
            team: row.team.name,
            logo: `https://www.sofascore.com/api/v1/team/${row.team.id}/image`,
            played: row.matches,
            won: row.wins,
            drawn: row.draws,
            lost: row.losses,
            points: row.points,
            goalsFor: row.scoresFor,
            goalsAgainst: row.scoresAgainst,
            goalDifference: row.scoresFor - row.scoresAgainst,
            form: []
        }));
    } catch (err) {
        return [];
    }
};

export const fetchMatchDetails = async (match: Match): Promise<MatchDetail> => {
    const matchId = match.id;
    try {
        const [incidentsRes, lineupsRes, statsRes] = await Promise.all([
            fetch(`https://api.sofascore.com/api/v1/event/${matchId}/incidents`).then(res => res.json()).catch(() => ({ incidents: [] })),
            fetch(`https://api.sofascore.com/api/v1/event/${matchId}/lineups`).then(res => res.json()).catch(() => ({})),
            fetch(`https://api.sofascore.com/api/v1/event/${matchId}/statistics`).then(res => res.json()).catch(() => ({ statistics: [] }))
        ]);

        const mapPlayer = (p: any): Player => ({
            name: p.player?.name || 'Player',
            number: p.jerseyNumber || 0,
            position: p.player?.position || 'N/A'
        });

        const homeLineup = (lineupsRes.home?.players || []).map((p: any) => mapPlayer(p));
        const awayLineup = (lineupsRes.away?.players || []).map((p: any) => mapPlayer(p));
        const homeSubs = (lineupsRes.home?.substitutes || []).map((p: any) => mapPlayer(p));
        const awaySubs = (lineupsRes.away?.substitutes || []).map((p: any) => mapPlayer(p));

        const getStat = (groupName: string, itemName: string, side: 'home' | 'away') => {
            const allStats = statsRes.statistics?.[0]?.groups || [];
            const group = allStats.find((g: any) => g.groupName === groupName);
            const item = group?.statisticsItems?.find((i: any) => i.name === itemName);
            if (!item) return side === 'home' ? 50 : 50; 
            const val = side === 'home' ? item.homeValue : item.awayValue;
            return typeof val === 'string' ? parseInt(val.replace('%', '')) : val;
        };

        const stats: MatchStats = {
            possession: [getStat('Match overview', 'Ball possession', 'home'), getStat('Match overview', 'Ball possession', 'away')],
            shots: [getStat('Match overview', 'Total shots', 'home'), getStat('Match overview', 'Total shots', 'away')],
            shotsOnTarget: [getStat('Match overview', 'Shots on target', 'home'), getStat('Match overview', 'Shots on target', 'away')],
            corners: [getStat('Match overview', 'Corner kicks', 'home'), getStat('Match overview', 'Corner kicks', 'away')],
            fouls: [getStat('Match overview', 'Fouls', 'home'), getStat('Match overview', 'Fouls', 'away')]
        };

        const incidents: Incident[] = (incidentsRes.incidents || []).map((inc: any) => ({
            type: inc.incidentType === 'substitution' ? 'substitution' : inc.incidentType,
            playerIn: inc.playerIn ? { name: inc.playerIn.name, number: 0, position: '' } : undefined,
            playerOut: inc.playerOut ? { name: inc.playerOut.name, number: 0, position: '' } : undefined,
            player: inc.player ? { name: inc.player.name, number: 0, position: '' } : undefined,
            time: inc.time,
            isHome: inc.isHome
        }));

        return {
            ...match,
            venue: lineupsRes.venue?.name || "Arena Stadium",
            referee: lineupsRes.referee?.name || "Match Official",
            homeLineup,
            awayLineup,
            homeSubstitutes: homeSubs,
            awaySubstitutes: awaySubs,
            homeFormation: lineupsRes.home?.formation,
            awayFormation: lineupsRes.away?.formation,
            stats,
            incidents,
            summary: "Signal synchronized successfully."
        };
    } catch (err) {
        return {
            ...match,
            venue: "Arena Stadium",
            referee: "Match Official",
            homeLineup: [],
            awayLineup: [],
            homeSubstitutes: [],
            awaySubstitutes: [],
            stats: { possession: [50, 50], shots: [0, 0], shotsOnTarget: [0, 0], corners: [0, 0], fouls: [0, 0] },
            incidents: [],
            summary: "Manual relay required. Statistical node currently offline."
        };
    }
};

const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : "dQw4w9WgXcQ"; 
};

const parseAIResponseToNewsItems = (text: string | undefined): NewsItem[] => {
    if (!text) return [];
    try {
        const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return data.map((item: any, idx: number) => ({
                id: `ai-item-${idx}-${Date.now()}`,
                title: item.title || "Match Highlight",
                summary: item.summary || "Summary processing...",
                timestamp: item.timestamp || "Official Transmission",
                imageUrl: `https://img.youtube.com/vi/${extractVideoId(item.youtubeUrl || '')}/maxresdefault.jpg`,
                videoUrl: item.youtubeUrl
            }));
        }
    } catch (e) {}
    return [];
};

async function callGeminiSafe(prompt: string, useSearch: boolean = true) {
    const model = 'gemini-3-flash-preview';
    try {
        const config: any = {
            temperature: 0.1, // Low temp for structured data extraction
        };
        if (useSearch) config.tools = [{ googleSearch: {} }];

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: config
        });
        return response.text;
    } catch (err: any) {
        if (useSearch) {
            return callGeminiSafe(prompt + " (Search disabled: provide internal knowledge)", false);
        }
        throw err;
    }
}

export const fetchHighlights = async (homeTeam: string, awayTeam: string): Promise<NewsItem[]> => {
    // Strictly following the search query logic provided in the Python snippet: "team1 vs team2 highlights"
    const searchQuery = `${homeTeam} vs ${awayTeam} highlights`;
    const prompt = `Search for YouTube highlights using the query: "${searchQuery}". Find the official match highlights or match resume. Return a JSON array: [{ "title": "...", "summary": "...", "youtubeUrl": "...", "timestamp": "..." }] in a markdown code block. Ensure the youtubeUrl is a valid watch link.`;

    try {
        const text = await callGeminiSafe(prompt);
        return parseAIResponseToNewsItems(text);
    } catch (err) {
        return [];
    }
};

export const fetchHighlightsForMatches = async (matches: Match[], dateContext: string = "TODAY"): Promise<NewsItem[]> => {
    const contextLabel = dateContext.toUpperCase();
    const targets = matches.filter(m => m.status === 'FINISHED').slice(0, 10);

    if (targets.length === 0) return fetchNews(dateContext);

    const matchInfoList = targets.map(m => `${m.homeTeam.name} vs ${m.awayTeam.name} highlights`);
    const prompt = `Search for official YouTube match highlights for these matches played ${contextLabel}: ${matchInfoList.join(', ')}. Return a JSON array: [{ "title": "...", "summary": "...", "youtubeUrl": "...", "timestamp": "..." }] in a markdown code block.`;

    try {
        const text = await callGeminiSafe(prompt);
        return parseAIResponseToNewsItems(text);
    } catch (err) {
        return fetchNews(dateContext);
    }
};

export const fetchNews = async (dateContext: string = "TODAY"): Promise<NewsItem[]> => {
    const prompt = `Find the 4 most important official football match highlights for ${dateContext.toUpperCase()}. Return a JSON array: [{ "title": "...", "summary": "...", "youtubeUrl": "...", "timestamp": "..." }] in a markdown code block.`;

    try {
        const text = await callGeminiSafe(prompt);
        return parseAIResponseToNewsItems(text);
    } catch (err) {
        return [];
    }
};

export const sendChatMessage = async (msg: string, history: any[]) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: msg,
            config: {
                systemInstruction: "You are a football expert assistant for XStream Arena. Be concise, fast, and helpful.",
                tools: [{ googleSearch: {} }]
            }
        });
        
        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        return {
            text: response.text || "I'm having trouble retrieving that information right now.",
            sources: grounding?.map((chunk: any) => ({
                title: chunk.web?.title || "Official Resource",
                uri: chunk.web?.uri || "#"
            })).filter((s: any) => s.uri !== "#")
        };
    } catch (err) {
        return { text: "Arena Signal Interrupted. Please check your network." };
    }
};
