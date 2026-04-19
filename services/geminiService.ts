
import { GoogleGenAI, Type } from "@google/genai";
import { Match, MatchDetail, Source, Player, MatchStats, Incident, NewsItem, Standing, OfficialBroadcaster } from "../types";
import { iptvService } from "./iptvService";

const getAi = () => {
  // Priority: GEMINI_API_KEY (standard), then API_KEY (fallback)
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.error("[Gemini] CRITICAL: No API key found in environment variables (GEMINI_API_KEY or API_KEY)");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

const CHANNEL_DB: Record<string, string> = {
    "beIN SPORTS 1": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3221",
    "beIN SPORTS 2": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3222",
    "beIN SPORTS 3": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3224",
    "beIN SPORTS 4": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3225",
    "beIN SPORTS 5": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3226",
    "beIN SPORTS 6": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3227",
    "beIN SPORTS 7": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3228",
    "beIN SPORTS 8": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3229",
    "beIN SPORTS 9": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3230",
    "beIN SPORTS 10": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3231",
    "beIN SPORTS XTRA 1": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3232",
    "beIN SPORTS XTRA 2": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3233",
    "Sky Sports Main Event": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/838",
    "BT Sport 1 HD": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/839",
    "AR: ON Time Sport 1": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/507",
    "AR: AD Sport 1": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/112",
    "DAZN LaLiga": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/4287",
    "Movistar LaLiga": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/4290",
    "TV 6 Algérie": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3019",
    "Programme National": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3019",
    "UGEEN IPTV": "http://ugeen.live:8080/kaicer_VIPb0dzot/70gdlu/3019",
};

let allChannelsCache: Source[] | null = null;
let lastAllChannelsFetch = 0;

export const getAllChannels = (): Source[] => {
    const now = Date.now();
    if (allChannelsCache && (now - lastAllChannelsFetch < 10000)) { // 10s cache
        return allChannelsCache;
    }
    
    const hardcoded: Source[] = Object.entries(CHANNEL_DB).map(([name, url]) => ({ name, url, group: "Premium" }));
    const registered = iptvService.getGlobalRegistry().filter(c => 
      c.name && 
      !c.name.toLowerCase().includes("unknown channel") && 
      !c.name.toLowerCase().includes("unknown_channel")
    );
    
    const channelMap = new Map<string, Source>();
    
    // Add hardcoded first
    hardcoded.forEach(c => channelMap.set(c.url, c));
    
    // Add registered, overwriting if URL matches (or skipping if preferred)
    registered.forEach(reg => {
      if (!channelMap.has(reg.url)) {
        channelMap.set(reg.url, reg);
      }
    });
    
    const result = Array.from(channelMap.values());
    allChannelsCache = result;
    lastAllChannelsFetch = now;
    return result;
};

let liveOnSatCache: any[] | null = null;
let lastLiveOnSatFetch = 0;

export const fetchLiveOnSatData = async () => {
    const now = Date.now();
    if (liveOnSatCache && (now - lastLiveOnSatFetch < 300000)) { // 5 min cache
        return liveOnSatCache;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

        // Fetch from all three endpoints in parallel
        const endpoints = ['/api/liveonsat', '/api/livesoccertv', '/api/sporteventz'];
        const fetchPromises = endpoints.map(url => 
            fetch(url, { signal: controller.signal })
                .then(async res => {
                    if (!res.ok) return [];
                    return await res.json();
                })
                .catch(err => {
                    if (err.name === 'AbortError') {
                        console.warn(`Scraper fetch aborted for ${url} (Timeout)`);
                    } else {
                        console.error(`Error fetching from ${url}:`, err.message || err);
                    }
                    return [];
                })
        );

        const results = await Promise.all(fetchPromises);
        clearTimeout(timeoutId);
        
        // Flatten the results from all sources
        const combinedData = results.flat();
        
        if (combinedData.length === 0) {
            console.warn("All scraper endpoints returned 0 results.");
        }

        liveOnSatCache = combinedData;
        lastLiveOnSatFetch = now;
        return combinedData;
    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.error("Scraper Fetch Timeout");
        } else {
            console.error("Error in fetchLiveOnSatData:", err);
        }
        return liveOnSatCache || [];
    }
};

const COUNTRY_MAP: Record<string, string[]> = {
    "portugal": ["portugal", "pt"],
    "polska": ["poland", "polska", "pl"],
    "poland": ["poland", "polska", "pl"],
    "armenia": ["armenia", "am"],
    "czech": ["czech", "cz"],
    "slovakia": ["slovakia", "sk"],
    "mena": ["arabic", "ar", "mena", "middle east", "national", "algerie", "maghreb"],
    "arabic": ["arabic", "ar", "mena", "middle east"],
    "france": ["france", "fr"],
    "uk": ["uk", "united kingdom", "gb", "england"],
    "spain": ["spain", "espana", "es", "sp"],
    "italy": ["italy", "it"],
    "germany": ["germany", "deutschland", "de", "deutsch"],
    "deutsch": ["germany", "deutschland", "de", "deutsch"],
    "turkey": ["turkey", "turkiye", "tr", "türkiye"],
    "turkiye": ["turkey", "turkiye", "tr", "türkiye"],
    "türkiye": ["turkey", "turkiye", "tr", "türkiye"],
    "greece": ["greece", "gr"],
    "romania": ["romania", "ro"],
    "hungary": ["hungary", "hu"],
    "bulgaria": ["bulgaria", "bg"],
    "croatia": ["croatia", "hr"],
    "serbia": ["serbia", "rs"],
    "albania": ["albania", "al"],
};

// Pre-compile regexes for performance
const COUNTRY_REGEX_MAP: Record<string, RegExp[]> = {};
for (const [country, keywords] of Object.entries(COUNTRY_MAP)) {
    COUNTRY_REGEX_MAP[country] = keywords.map(k => new RegExp(`\\b${k}\\b`, 'i'));
}

const normalizationCache = new Map<string, string>();

// Enhanced normalization for smart fuzzy matching
export const normalizeChannelName = (s: string) => {
    if (!s) return "";
    if (normalizationCache.has(s)) return normalizationCache.get(s)!;
    
    let cleaned = s.toLowerCase();
    
    // Replace soccer ball emoji with 'o' (e.g. BEIN SP⚽️RTS -> bein sports)
    cleaned = cleaned.replace(/⚽️?/g, 'o');
    
    // 0. Separate numbers from letters (e.g., tv2 -> tv 2)
    cleaned = cleaned.replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');
    
    // Remove leading zeros from numbers (e.g., 01 -> 1, 002 -> 2)
    cleaned = cleaned.replace(/\b0+(\d+)\b/g, '$1');
    
    // 0.1 Separate common concatenated words and normalize plural
    cleaned = cleaned
        .replace(/sports/g, 'sport')
        .replace(/sporttv/g, 'sport tv')
        .replace(/beinsport/g, 'bein sport')
        .replace(/\bmena\b/g, ' ') // Remove standalone mena anywhere
        .replace(/novasport/g, 'nova sport')
        .replace(/elevensport/g, 'eleven sport')
        .replace(/dazntv/g, 'dazn tv');

    // Filter out "Unknown Channel"
    if (cleaned.includes("unknown channel") || cleaned.includes("unknown_channel")) {
        return "BLACKLISTED_CHANNEL";
    }

    // Blacklist for non-sports channels (religious, etc.)
    const blacklist = [/quran/i, /islam/i, /adhkar/i, /religious/i, /prayer/i, /فاتحة/i, /قرآن/i, /أذكار/i];
    if (blacklist.some(regex => regex.test(cleaned))) {
        return "BLACKLISTED_CHANNEL";
    }

    // 1. Handle specific synonyms and spelling variations
    cleaned = cleaned
        .replace(/l'equipe live foot/g, 'lequipe')
        .replace(/l'equipe|l'équipe|lequipe|l equipe|l équipe/g, 'lequipe')
        .replace(/arriadia|aryadia|arriyadia|arryadia|arriadya|arryadya/g, 'arryadia')
        .replace(/entv algerie|programme national/g, 'entv')
        .replace(/thmanyah|thamaniyah|thamaniya|thamanyah|thamanya/g, 'thmanyah')
        .replace(/\benglish\b/g, 'en')
        .replace(/\bfrench\b/g, 'fr')
        .replace(/\barabic\b/g, 'ar')
        .replace(/\[app\]|\(app\)/g, ' ') // Remove app tags
        .replace(/espana|españa/g, 'spain')
        .replace(/\bss\b/g, 'supersport')
        .replace(/turkiye/g, 'turkey')
        .replace(/\b(hd|sd|4k|fhd|uhd|premium|mena|ar|astro|optus|stan|spark|megogo|starhub)\b/g, ' ') // Replace technical suffixes and redundant tags with space
        .replace(/[^\p{L}\p{N}\s\+]/gu, ' ') // Remove special chars but keep letters, numbers, and '+'
        .trim();
    
    // 2. Return space-separated words for word-based matching
    const result = cleaned.split(/\s+/).filter(word => word.length > 0).join(' ');
    normalizationCache.set(s, result);
    return result;
};

const MAJOR_BRANDS = [
    'dazn', 'bein', 'sky', 'bt', 'tnt', 'espn', 'fox', 'euro', 'eleven', 'canal', 'nova', 
    'arena', 'sport tv', 'ziggo', 'viaplay', 'setanta', 'supersport', 'max', 'prime', 
    'amazon', 'apple', 'paramount', 'peacock', 'fubo', 'optus', 'stan', 'spark', 
    'shasha', 'ssc', 'ad sport', 'on time', 'alkass', 'movistar', 'orange', 'telekom',
    'digi', 'polsat', 'viaplay', 'dsmart', 'tivibu', 'cosmote', 'cytavision', 'primetel'
];

export const matchOfficialChannelToIptv = (
    officialName: string,
    preProcessedIptv: { source: Source, normalized: string, original: string }[],
    isAlgerianMatch: boolean = false,
    isEnglishMatch: boolean = false,
    debug: boolean = false
): Source[] => {
    const lowerSat = officialName.toLowerCase();
    
    // Special Fast-Path Matches
    if (lowerSat.includes('entv algerie') || lowerSat === 'entv') {
        const matches = preProcessedIptv
            .filter(item => {
                const iptvOriginal = item.original.toLowerCase();
                const iptvGroup = (item.source.group || "").toLowerCase();
                const isAlgerianGroup = iptvGroup.includes('algeria') || iptvGroup.includes('algérie') || iptvGroup.includes('algerie') || iptvGroup.includes('alg') || iptvGroup.includes('dz');
                return iptvOriginal.includes('entv') && isAlgerianGroup;
            })
            .map(item => item.source);
        if (matches.length > 0) return matches;
    }

    if (lowerSat.includes("l'équipe live foot") || lowerSat.includes("l'equipe live foot") || lowerSat.includes("lequipe live foot")) {
        const matches = preProcessedIptv
            .filter(item => {
                const iptvOriginal = item.original.toLowerCase();
                const iptvGroup = (item.source.group || "").toLowerCase();
                const hasLequipe = iptvOriginal.includes("l'équipe") || iptvOriginal.includes("l'equipe") || iptvOriginal.includes("lequipe");
                return hasLequipe && (iptvGroup.includes('france') || iptvGroup.includes('fr'));
            })
            .map(item => item.source);
        if (matches.length > 0) return matches;
    }

    if (lowerSat.includes('arryadia tnt') || lowerSat.includes('tnt arryadia')) {
        const matches = preProcessedIptv
            .filter(item => {
                const iptvOriginal = item.original.toLowerCase();
                const iptvGroup = (item.source.group || "").toLowerCase();
                const isMoroccoGroup = iptvGroup.includes('morocco') || iptvGroup.includes('maroc') || /\bma\b/.test(iptvGroup);
                return (iptvOriginal.includes('arryadia tnt') || iptvOriginal.includes('tnt arryadia')) && isMoroccoGroup;
            })
            .map(item => item.source);
        if (matches.length > 0) return matches;
    }

    const normSat = normalizeChannelName(officialName);
    const satWords = normSat.split(' ').filter(w => w.length > 0);
    
    // 1. Extract country hint from official name
    let countryHint: string | null = null;
    
    // Check all words for country hints
    for (const word of satWords) {
        if (COUNTRY_MAP[word]) {
            countryHint = word;
            break;
        }
    }
    
    if (!countryHint && lowerSat.includes('mena')) countryHint = 'mena';
    
    // beIN Sports Special Handling: Detect if it's beIN Türkiye or beIN MENA
    let isBeinTurkey = /\b(turkey|turkiye|türkiye|turk|tr)\b/i.test(lowerSat);
    let isBeinMena = lowerSat.includes('bein') && !isBeinTurkey && !/\b(france|usa|espan|españa|australia|thailand)\b/i.test(lowerSat);

    // Identify which major brands are in the official name
    const brandsInOfficial = MAJOR_BRANDS.filter(brand => {
        const brandNorm = normalizeChannelName(brand);
        const brandWords = brandNorm.split(' ');
        return brandWords.every(bw => satWords.includes(bw));
    });

    // Words to match, excluding region tags that we handle via countryHint
    const regionTags = Object.keys(COUNTRY_MAP).concat([
        'mena', 'global', 'ksa', 'polska', 'deutsch', 'türkiye', 'portugal', 'france', 'spain', 'italy', 'germany', 'uk', 'poland',
        'premium', 'extra', 'xtra', 'en', 'fr', 'es', 'ar'
    ]);
    const coreSatWords = satWords.filter(w => !regionTags.includes(w));
    
    // Special Case: For beIN channels, 'sport' is often omitted in IPTV names (e.g. "beIN 1" instead of "beIN Sport 1")
    // We make it optional to ensure matching works even when the provider is lazy with naming.
    const isBeinOfficial = lowerSat.includes('bein');
    let finalCoreWords = isBeinOfficial 
        ? coreSatWords.filter(w => w !== 'sport' && w !== 'sports')
        : coreSatWords;

    // If it's beIN English but no number is specified, assume 1
    if (isBeinOfficial && lowerSat.includes('english') && !finalCoreWords.some(w => /\d/.test(w))) {
        finalCoreWords.push('1');
    }
    
    // If it's beIN English, make sure we accept "EN" as a match for "English"
    if (isBeinOfficial && lowerSat.includes('english')) {
        if (!finalCoreWords.includes('en')) {
            finalCoreWords.push('en');
        }
        // Remove 'english' from core words since we use 'en'
        finalCoreWords = finalCoreWords.filter(w => w !== 'english');
    }

    if (finalCoreWords.length === 0) return [];
    
    const candidates = preProcessedIptv.filter(item => {
        const iptvOriginal = item.original.toLowerCase().replace(/⚽️?/g, 'o');
        const iptvGroup = (item.source.group || "").toLowerCase().replace(/⚽️?/g, 'o');
        const normIptv = item.normalized;
        
        if (debug) console.log(`\nEvaluating: ${iptvOriginal} (group: ${iptvGroup})`);
        
        // For strict word matching, we ONLY use the channel name, NOT the group
        const iptvWords = normIptv.split(' ').filter(w => w.length > 0);
        
        // A. Country Filtering & Isolation
        if (countryHint || isBeinTurkey || isBeinMena) {
            const currentHint = countryHint || (isBeinTurkey ? 'turkey' : 'mena');
            const countryRegexes = COUNTRY_REGEX_MAP[currentHint] || [];
            
            const matchesTargetCountry = countryRegexes.some(regex => {
                return regex.test(iptvOriginal) || regex.test(iptvGroup);
            });
            
            // beIN Türkiye specific: must have TR or be in Turkey group
            if (isBeinTurkey) {
                const isTurkey = /\b(tr|turk|türkiye|turkey)\b/i.test(iptvOriginal) || /\b(tr|turk|türkiye|turkey)\b/i.test(iptvGroup);
                if (!isTurkey) { if (debug) console.log(`Rejected ${iptvOriginal}: not turkey`); return false; }
            }
            
            // beIN MENA specific: must NOT have TR/Turkey and should have AR/Arabic/MENA or be in MENA group
            if (isBeinMena) {
                const isTurkey = /\b(tr|turk|türkiye|turkey)\b/i.test(iptvOriginal) || /\b(tr|turk|türkiye|turkey)\b/i.test(iptvGroup);
                if (isTurkey) { if (debug) console.log(`Rejected ${iptvOriginal}: is turkey`); return false; }
            }

            // Isolation logic
            if (currentHint === 'mena' || isBeinMena) {
                // Just ensure it's not a DIFFERENT specific country that we've identified
                const otherSpecificCountries = ['france', 'uk', 'turkey', 'spain', 'italy', 'germany', 'usa', 'brazil', 'portugal', 'hungary', 'poland', 'bulgaria', 'romania'];
                const allowedForThisMatch = otherSpecificCountries.filter(c => lowerSat.includes(c));
                
                // If it's an English channel, allow UK and USA groups
                if (lowerSat.includes('english') || /\b(en)\b/i.test(lowerSat)) {
                    if (!allowedForThisMatch.includes('uk')) allowedForThisMatch.push('uk');
                    if (!allowedForThisMatch.includes('usa')) allowedForThisMatch.push('usa');
                }
                
                // If it's a French channel, allow France groups
                if (lowerSat.includes('french') || /\b(fr)\b/i.test(lowerSat)) {
                    if (!allowedForThisMatch.includes('france')) allowedForThisMatch.push('france');
                }

                // If it's a Spanish channel, allow Spain groups
                if (lowerSat.includes('espan') || lowerSat.includes('españa') || /\b(es)\b/i.test(lowerSat)) {
                    if (!allowedForThisMatch.includes('spain')) allowedForThisMatch.push('spain');
                }

                const forbiddenForThisMatch = otherSpecificCountries.filter(c => !allowedForThisMatch.includes(c));
                
                if (forbiddenForThisMatch.some(c => {
                    const regexes = COUNTRY_REGEX_MAP[c] || [new RegExp(`\\b${c}\\b`, 'i')];
                    return regexes.some(regex => {
                        return regex.test(iptvOriginal) || regex.test(iptvGroup);
                    });
                })) {
                    if (debug) console.log(`Rejected ${iptvOriginal}: forbidden country group`);
                    return false;
                }
            } else {
                // Strict Isolation for other countries
                const otherCountries = Object.keys(COUNTRY_MAP).filter(c => c !== currentHint);
                const matchesOtherCountry = otherCountries.some(other => {
                    const otherRegexes = COUNTRY_REGEX_MAP[other];
                    return otherRegexes.some(regex => {
                        return regex.test(iptvOriginal) || regex.test(iptvGroup);
                    });
                });

                if (matchesOtherCountry && !matchesTargetCountry) { if (debug) console.log(`Rejected ${iptvOriginal}: matches other country`); return false; }
                if (!matchesTargetCountry) { if (debug) console.log(`Rejected ${iptvOriginal}: does not match target country`); return false; }
            }
        }

        // B. Brand Protection: Ensure no "extra" major brands are present
        const otherBrandsInIptv = MAJOR_BRANDS.filter(brand => {
            const brandNorm = normalizeChannelName(brand);
            const brandWords = brandNorm.split(' ');
            const isBrandInIptv = brandWords.every(bw => iptvWords.includes(bw));
            const isBrandInOfficial = brandsInOfficial.includes(brand);
            return isBrandInIptv && !isBrandInOfficial;
        });

        if (otherBrandsInIptv.length > 0) { if (debug) console.log(`Rejected ${iptvOriginal}: extra brand ${otherBrandsInIptv[0]}`); return false; }

        // C. beIN Global Special Case
        if (lowerSat.includes('bein') && lowerSat.includes('global')) {
            const hasNumber = /\d/.test(normIptv);
            if (hasNumber) return false;
            
            if (!iptvWords.includes('bein')) return false;
            
            // It must be "bein sports" or "bein sport"
            if (!iptvWords.includes('sport') && !iptvWords.includes('sports')) return false;
            
            // It should not be news, movies, etc.
            const nonSportKeywords = ['news', 'movie', 'cinema', 'film', 'box office', 'series', 'drama', 'kids', 'documentary', 'xtra', 'extra', 'max'];
            if (nonSportKeywords.some(k => iptvOriginal.toLowerCase().includes(k) || iptvGroup.toLowerCase().includes(k))) return false;

            // Also, it should be Arabic (no EN/FR/ES)
            const iptvHasEn = /\b(en|english|uk|us)\b/i.test(iptvOriginal) || /\b(en|english|uk|us)\b/i.test(iptvGroup);
            const iptvHasFr = /\b(fr|french|france)\b/i.test(iptvOriginal) || /\b(fr|french|france)\b/i.test(iptvGroup);
            const iptvHasEs = /\b(es|espan|españa|spain)\b/i.test(iptvOriginal) || /\b(es|espan|españa|spain)\b/i.test(iptvGroup);
            if (iptvHasEn || iptvHasFr || iptvHasEs) return false;

            return true;
        }

        // D. Strict rule: All core words from the official channel name must be present in the IPTV name
        // We also check for "extra" words that might indicate a different channel (like 'news' vs 'sport')
        const hasAllCoreWords = finalCoreWords.every(word => {
            if (iptvWords.includes(word)) return true;
            
            // Allow language words to be satisfied by the group name or original name
            if (word === 'en' && (/\b(en|english|uk|us|usa)\b/i.test(iptvOriginal) || /\b(en|english|uk|us|usa)\b/i.test(iptvGroup) || /\b(en)\b/i.test(normIptv))) return true;
            if (word === 'fr' && (/\b(fr|french|france)\b/i.test(iptvOriginal) || /\b(fr|french|france)\b/i.test(iptvGroup) || /\b(fr)\b/i.test(normIptv))) return true;
            if (word === 'es' && (/\b(es|espan|españa|spain)\b/i.test(iptvOriginal) || /\b(es|espan|españa|spain)\b/i.test(iptvGroup) || /\b(es)\b/i.test(normIptv))) return true;
            
            return false;
        });
        if (!hasAllCoreWords) return false;

        // E. Prevent "Sky Sport" matching "Sky News" or "beIN Sport" matching "beIN Movies"
        // If official name has 'sport', IPTV name should NOT have 'news', 'movie', 'cinema' if official doesn't have them
        const sportKeywords = ['sport', 'sports'];
        const nonSportKeywords = ['news', 'movie', 'cinema', 'film', 'box office', 'series', 'drama', 'kids', 'documentary'];
        
        const officialHasSport = sportKeywords.some(k => lowerSat.includes(k));
        const iptvHasNonSport = nonSportKeywords.some(k => iptvOriginal.includes(k) || iptvGroup.includes(k));
        const officialHasNonSport = nonSportKeywords.some(k => lowerSat.includes(k));

        if (officialHasSport && !officialHasNonSport && iptvHasNonSport) return false;
        if (lowerSat.includes('news') && !lowerSat.includes('sport') && iptvWords.includes('sport')) return false;

        // F. Strict matching for specific channel variants (Premium, Max, Extra, Xtra, AFC, AFCON)
        const variants = ['premium', 'max', 'extra', 'xtra', 'afcon', 'asian', 'afc'];
        for (const variant of variants) {
            const officialHasVariant = lowerSat.includes(variant);
            const iptvHasVariant = iptvOriginal.includes(variant) || iptvGroup.includes(variant) || normIptv.includes(variant);
            if (officialHasVariant && !iptvHasVariant) return false;
            if (!officialHasVariant && iptvHasVariant) return false;
        }

        // G. Language strictness for beIN MENA (as requested)
        if (isBeinMena) {
            const hasEn = lowerSat.includes('english') || /\b(en)\b/i.test(lowerSat);
            const hasFr = lowerSat.includes('french') || /\b(fr)\b/i.test(lowerSat);
            const hasEs = lowerSat.includes('espan') || lowerSat.includes('españa') || /\b(es)\b/i.test(lowerSat);
            
            // Check IPTV name for language markers
            const iptvHasEn = /\b(en|english|uk|us|usa)\b/i.test(iptvOriginal) || /\b(en|english|uk|us|usa)\b/i.test(iptvGroup) || /\b(en)\b/i.test(normIptv);
            const iptvHasFr = /\b(fr|french|france)\b/i.test(iptvOriginal) || /\b(fr|french|france)\b/i.test(iptvGroup) || /\b(fr)\b/i.test(normIptv);
            const iptvHasEs = /\b(es|espan|españa|spain)\b/i.test(iptvOriginal) || /\b(es|espan|españa|spain)\b/i.test(iptvGroup) || /\b(es)\b/i.test(normIptv);
            
            if (hasEn && !iptvHasEn) return false;
            if (hasFr && !iptvHasFr) return false;
            if (hasEs && !iptvHasEs) return false;
            
            // If official name DOES NOT specify EN, FR, or ES, the IPTV match MUST NOT have them (implicitly Arabic)
            // Exception: Xtra channels are often English, so allow them to be in English groups
            const isXtra = lowerSat.includes('xtra') || lowerSat.includes('extra');
            if (!hasEn && !hasFr && !hasEs && (iptvHasEn || iptvHasFr || iptvHasEs) && !isXtra) return false;
        }

        return true;
    });

    // Sort candidates to prioritize better matches
    candidates.sort((a, b) => {
        const aLower = a.original.toLowerCase();
        const bLower = b.original.toLowerCase();
        const aNorm = a.normalized;
        const bNorm = b.normalized;
        const aGroup = (a.source.group || "").toLowerCase();
        const bGroup = (b.source.group || "").toLowerCase();
        
        // 1. Prioritize country-specific folders/groups if hint exists
        if (countryHint) {
            const countryRegexes = COUNTRY_REGEX_MAP[countryHint];
            const aInCountryGroup = countryRegexes.some(regex => regex.test(aGroup));
            const bInCountryGroup = countryRegexes.some(regex => regex.test(bGroup));
            if (aInCountryGroup && !bInCountryGroup) return -1;
            if (!aInCountryGroup && bInCountryGroup) return 1;

            // 2. Prioritize channels with abbreviation in name
            const aHasAbbr = countryRegexes.some(regex => regex.test(aLower));
            const bHasAbbr = countryRegexes.some(regex => regex.test(bLower));
            if (aHasAbbr && !bHasAbbr) return -1;
            if (!aHasAbbr && bHasAbbr) return 1;
        }

        // 3. Prioritize exact "Global" match if official is Global
        if (lowerSat.includes('global')) {
            const aIsGlobal = aNorm.includes('global');
            const bIsGlobal = bNorm.includes('global');
            if (aIsGlobal && !bIsGlobal) return -1;
            if (!aIsGlobal && bIsGlobal) return 1;
        }

        // 4. Prioritize Arabic/AR for MENA matches
        if (countryHint === 'mena' || isBeinMena) {
            const aIsArabic = /\b(ar|arabic|mena)\b/i.test(aLower) || /\b(ar|arabic|mena)\b/i.test(aGroup);
            const bIsArabic = /\b(ar|arabic|mena)\b/i.test(bLower) || /\b(ar|arabic|mena)\b/i.test(bGroup);
            if (aIsArabic && !bIsArabic) return -1;
            if (!aIsArabic && bIsArabic) return 1;
        }

        if (isAlgerianMatch) {
            const aIsAlg = aLower.includes('algerie') || aLower.includes('national') || aLower.includes('entv');
            const bIsAlg = bLower.includes('algerie') || bLower.includes('national') || bLower.includes('entv');
            if (aIsAlg && !bIsAlg) return -1;
            if (!aIsAlg && bIsAlg) return 1;
        }

        if (isEnglishMatch) {
            const aIsBein = aLower.includes('bein');
            const bIsBein = bLower.includes('bein');
            if (aIsBein && !bIsBein) return -1;
            if (!aIsBein && bIsBein) return 1;
        }
        
        // 5. Prefer higher quality (4K > FHD > HD > SD)
        const getQualityScore = (name: string) => {
            if (/\b(4k|uhd)\b/i.test(name)) return 4;
            if (/\b(fhd|1080p)\b/i.test(name)) return 3;
            if (/\b(hd|720p)\b/i.test(name)) return 2;
            if (/\b(sd|480p)\b/i.test(name)) return 1;
            return 0; // Unknown quality
        };
        const aQuality = getQualityScore(aLower);
        const bQuality = getQualityScore(bLower);
        if (aQuality !== bQuality) {
            return bQuality - aQuality; // Higher score comes first
        }

        // 6. Prefer shorter names (less extra noise)
        return a.normalized.length - b.normalized.length;
    });

    // Return only the top 3 matches to avoid cluttering the UI
    return candidates.slice(0, 3).map(c => c.source);
};

const TEAM_SYNONYMS: Record<string, string[]> = {
    "manchester united": ["man utd", "man united", "mufc"],
    "manchester city": ["man city", "mancity", "mcfc"],
    "tottenham hotspur": ["spurs", "tottenham"],
    "west ham united": ["west ham", "whu"],
    "brighton & hove albion": ["brighton", "bha"],
    "leicester city": ["leicester"],
    "newcastle united": ["newcastle", "nufc"],
    "sheffield united": ["sheffield utd"],
    "arsenal": ["afc"],
    "liverpool": ["lfc"],
    "chelsea": ["cfc"],
    "aston villa": ["avfc"],
    "everton": ["efc"],
    "wolverhampton": ["wolves", "wwfc"],
    "nottingham forest": ["forest", "nffc"],
    "crystal palace": ["cpfc"],
    "bournemouth": ["afcb"],
    "brentford": ["bfc"],
    "fulham": ["ffc"],
    "ipswich town": ["ipswich"],
    "southampton": ["saints"],
    "premier league": ["epl", "england premier league"],
    "championship": ["england championship", "efl championship"],
    "league one": ["england league one", "efl league one"],
    "league two": ["england league two", "efl league two"],
    "carabao cup": ["efl cup", "league cup"],
    "fa cup": ["the fa cup"],
    "mc alger": ["mca", "mouloudia alger"],
    "cr belouizdad": ["crb", " شباب بلوزداد"],
    "usm alger": ["usma", "اتحاد الجزائر"],
    "js kabylie": ["jsk", "شبيبة القبائل"],
    "es setif": ["ess", "وفاق سطيف"],
    "cs constantine": ["csc", "شباب قسنطينة"],
    "mc oran": ["mco", "مولودية وهران"],
    "paradou ac": ["pac", "نادي بارادو"],
    "aso chlef": ["aso", "جمعية الشلف"],
    "js saoura": ["jss", "شبيبة الساورة"],
    "us biskra": ["usb", "اتحاد بسكرة"],
    "nc magra": ["ncm", "نجم مقرة"],
    "es mostaganem": ["esm", "ترجي مستغانم"],
    "olympique akbou": ["oa", "أولمبي أقبو"],
    "mc el bayadh": ["mceb", "مولودية البيض"],
    "usm khenchela": ["usmk", "اتحاد خنشلة"],
    "algeria ligue 1": ["ligue 1 algeria", "الرابطة الجزائرية الأولى"],
    "coupe d'algerie": ["algerian cup", "كأس الجزائر"],
    "juventus": ["juve"],
    "inter milan": ["inter", "internazionale"],
    "ac milan": ["milan"],
    "as roma": ["roma"],
    "ss lazio": ["lazio"],
    "ssc napoli": ["napoli"],
    "acf fiorentina": ["fiorentina"],
    "atalanta bc": ["atalanta"],
    "serie a": ["italy serie a", "lega serie a"],
};

const getSearchTerms = (team: string) => {
    const terms = [team.toLowerCase()];
    for (const [key, synonyms] of Object.entries(TEAM_SYNONYMS)) {
        const lowerKey = key.toLowerCase();
        if (team.toLowerCase().includes(lowerKey) || lowerKey.includes(team.toLowerCase())) {
            terms.push(key.toLowerCase(), ...synonyms.map(s => s.toLowerCase()));
        }
        if (synonyms.some(s => team.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(team.toLowerCase()))) {
            terms.push(key.toLowerCase(), ...synonyms.map(s => s.toLowerCase()));
        }
    }
    return [...new Set(terms)];
};

export const findIptvSourcesForMatch = (
    homeTeam: string, 
    awayTeam: string, 
    competitionName: string, 
    leagueLogo: string | undefined,
    liveOnSatData: any[], 
    preProcessedIptv: { source: Source, normalized: string, original: string }[]
): Source[] => {
    const home = homeTeam.toLowerCase();
    const away = awayTeam.toLowerCase();
    const compName = competitionName.toLowerCase();
    
    // Algerian Ligue 1 (841) or Algerian Cup (1588)
    const isAlgerianMatch = (leagueLogo && (leagueLogo.includes('/841/') || leagueLogo.includes('/1588/'))) || 
                            compName.includes("algeria") || compName.includes("dz") || compName === "ligue 1 mobilis";
    
    const isEnglishMatch = compName.includes("premier league") || compName.includes("england") || compName.includes("championship") || compName.includes("carabao") || compName.includes("fa cup");
    const isSaudiMatch = compName.includes("saudi") || compName.includes("pro league") || compName.includes("ksa") || compName.includes("roshn") || compName.includes("roshan");
    
    const homeTerms = getSearchTerms(home);
    const awayTerms = getSearchTerms(away);

    const foundSources: Source[] = [];
    const seenUrls = new Set<string>();

    // 1. Find all matching entries in LiveOnSat data (from all sources)
    const matchingEntries = liveOnSatData.filter(m => {
        const teams = m.teams.toLowerCase();
        const competition = (m.competition || "").toLowerCase();
        
        const homeMatch = homeTerms.some(term => teams.includes(term));
        const awayMatch = awayTerms.some(term => teams.includes(term));
        
        // Special handling for Algerian & English Competitions
        const isAlgerianComp = competition.includes("algeria") || 
                               competition.includes("dz") ||
                               (competition.includes("ligue 1") && isAlgerianMatch) ||
                               (competition.includes("coupe") && isAlgerianMatch);
        
        const isEnglishComp = competition.includes("premier league") || 
                              competition.includes("championship") || 
                              competition.includes("league one") ||
                              competition.includes("carabao") ||
                              competition.includes("fa cup") ||
                              competition.includes("england");
                              
        const isSaudiComp = competition.includes("saudi") || 
                            competition.includes("pro league") || 
                            competition.includes("ksa") || 
                            competition.includes("roshn") || 
                            competition.includes("roshan");
        
        return (homeMatch && awayMatch) || 
               ((isAlgerianComp || isAlgerianMatch) && (homeMatch || awayMatch)) ||
               (isEnglishComp && (homeMatch || awayMatch)) ||
               ((isSaudiComp || isSaudiMatch) && (homeMatch || awayMatch));
    });

    if (isAlgerianMatch) {
        matchingEntries.push({
            teams: `${homeTeam} vs ${awayTeam}`,
            competition: competitionName,
            channels: ["ENTV", "Programme National", "Canal Algerie", "TV3", "TV4", "TV6"],
            source: "Auto-Added"
        });
    }

    if (isSaudiMatch && matchingEntries.length === 0) {
        matchingEntries.push({
            teams: `${homeTeam} vs ${awayTeam}`,
            competition: competitionName,
            channels: ["Thamanyah"],
            source: "Auto-Added"
        });
    }

    if (matchingEntries.length > 0) {
        // 2. Strict Word-Based Matching for each channel from all matching entries
        matchingEntries.forEach(matchData => {
            matchData.channels.forEach((satChName: string) => {
                let matchName = satChName;
                if (matchName.toLowerCase().includes('bein sports mena')) {
                    matchName = matchName.replace(/\bMENA\b/i, '').replace(/\s+/g, ' ').trim();
                }

                const sources = matchOfficialChannelToIptv(matchName, preProcessedIptv, isAlgerianMatch, isEnglishMatch);
                sources.forEach(src => {
                    if (!seenUrls.has(src.url)) {
                        // Tag the source with the origin if available
                        const originTag = matchData.source ? ` [${matchData.source}]` : "";
                        foundSources.push({
                            ...src,
                            playlistName: `${src.playlistName}${originTag}`
                        });
                        seenUrls.add(src.url);
                    }
                });
            });
        });
    }

    // Final sort for foundSources to ensure region-based priority
    foundSources.sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        
        if (isAlgerianMatch) {
            const aIsAlg = aLower.includes('algerie') || aLower.includes('national') || aLower.includes('entv');
            const bIsAlg = bLower.includes('algerie') || bLower.includes('national') || bLower.includes('entv');
            if (aIsAlg && !bIsAlg) return -1;
            if (!aIsAlg && bIsAlg) return 1;
        }

        if (isEnglishMatch) {
            const aIsBein = aLower.includes('bein');
            const bIsBein = bLower.includes('bein');
            if (aIsBein && !bIsBein) return -1;
            if (!aIsBein && bIsBein) return 1;
        }
        return 0;
    });

    return foundSources;
};

const mapSofaEventToMatch = (
    event: any, 
    liveOnSatData: any[] = [], 
    preProcessedIptv: { source: Source, normalized: string, original: string }[]
): Match => {
    if (!event || !event.id || !event.homeTeam || !event.awayTeam) {
        return {
            id: (event?.id || Math.random()).toString(),
            league: 'Unknown',
            homeTeam: { name: 'Unknown', logo: '', score: 0 },
            awayTeam: { name: 'Unknown', logo: '', score: 0 },
            status: 'SCHEDULED',
            time: '00:00',
            date: '',
            timestamp: 0
        };
    }

    const dateObj = new Date(event.startTimestamp * 1000);
    const localDate = dateObj.toISOString().split('T')[0];
    
    const statusType = event.status?.type || 'unknown';
    const nowSeconds = Math.floor(Date.now() / 1000);
    const startTimestamp = event.startTimestamp || 0;
    const secondsSinceStart = nowSeconds - startTimestamp;

    let isLive = statusType === 'inprogress';
    let isFinished = statusType === 'finished';

    // Override logic based on time if status is ambiguous
    if (!isFinished && !isLive) {
        if (secondsSinceStart > 0 && secondsSinceStart < 7200) { // Started less than 2 hours ago
            isLive = true;
        } else if (secondsSinceStart >= 7200) { // Started more than 2 hours ago
            isFinished = true;
        }
    }

    let displayTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (isLive) {
        displayTime = event.status?.description || 'Live';
        if (displayTime === 'Not started' || statusType === 'notstarted') displayTime = 'Live';
    } else if (isFinished) {
        displayTime = 'FT';
    }

    const tournament = event.tournament || {};
    const uniqueTournament = tournament.uniqueTournament || {};
    const leagueLogoId = uniqueTournament.id || tournament.id;
    const isUnique = !!uniqueTournament.id;
    const logoUrl = leagueLogoId 
        ? `/api/sofascore/${isUnique ? 'unique-tournament' : 'tournament'}/${leagueLogoId}/image` 
        : undefined;

    const homeName = event.homeTeam.name || 'Home';
    const awayName = event.awayTeam.name || 'Away';
    
    // REMOVED: dynamicSources calculation here to prevent UI freeze
    // Matching will be done on-demand in the UI components
    
    return {
        id: event.id.toString(),
        league: tournament.name || 'Tournament',
        leagueLogo: logoUrl,
        homeTeam: {
            name: homeName,
            logo: `/api/sofascore/team/${event.homeTeam.id}/image`,
            score: event.homeScore?.current ?? 0
        },
        awayTeam: {
            name: awayName,
            logo: `/api/sofascore/team/${event.awayTeam.id}/image`,
            score: event.awayScore?.current ?? 0
        },
        status: isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED',
        time: displayTime,
        date: localDate,
        timestamp: event.startTimestamp || 0,
        sources: [] // Start with empty sources
    };
};

const safeFetch = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format");
    }
    return response.json();
};

export const fetchLiveMatches = async (): Promise<Match[]> => {
    try {
        const [data, liveOnSat] = await Promise.all([
            safeFetch('/api/sofascore/sport/football/events/live'),
            fetchLiveOnSatData()
        ]);
        if (!data || !data.events) return [];
        
        // No pre-processing here to save time
        return data.events.map((e: any) => mapSofaEventToMatch(e, liveOnSat, []));
    } catch (err: any) {
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
            console.warn("Fetch Live Matches: Network error or server restarting.");
        } else {
            console.error("Fetch Live Matches Error:", err);
        }
        return [];
    }
};

export const fetchMatchesForDate = async (dateStr: string): Promise<Match[]> => {
    try {
        const [data, liveOnSat] = await Promise.all([
            safeFetch(`/api/sofascore/sport/football/scheduled-events/${dateStr}`),
            fetchLiveOnSatData()
        ]);
        if (!data || !data.events) return [];
        
        // No limit - show all matches
        const events = data.events; 
        return events.map((e: any) => mapSofaEventToMatch(e, liveOnSat, []));
    } catch (err: any) {
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
            console.warn(`Fetch Matches For Date (${dateStr}): Network error or server restarting.`);
        } else {
            console.error("Fetch Matches For Date Error:", err);
        }
        return [];
    }
};

export interface GroupStanding {
  name: string;
  rows: Standing[];
}

export const fetchLeagueStandings = async (tournamentId: string, seasonId?: string): Promise<GroupStanding[]> => {
    try {
        let targetSeasonId = seasonId;
        if (!targetSeasonId) {
            const seasonsData = await safeFetch(`/api/sofascore/unique-tournament/${tournamentId}/seasons`);
            targetSeasonId = seasonsData.seasons?.[0]?.id;
        }

        if (!targetSeasonId) return [];

        const standingsData = await safeFetch(`/api/sofascore/unique-tournament/${tournamentId}/season/${targetSeasonId}/standings/total`);
        const standingsGroups = standingsData.standings || [];

        return standingsGroups.map((group: any) => ({
            name: group.name || "Standings",
            rows: (group.rows || []).map((row: any) => ({
                rank: row.position,
                team: row.team.name,
                logo: `/api/sofascore/team/${row.team.id}/image`,
                played: row.matches,
                won: row.wins,
                drawn: row.draws,
                lost: row.losses,
                points: row.points,
                goalsFor: row.scoresFor,
                goalsAgainst: row.scoresAgainst,
                goalDifference: row.scoresFor - row.scoresAgainst,
                form: []
            }))
        }));
    } catch (err) {
        return [];
    }
};

export const findOfficialBroadcastersForMatch = (home: string, away: string, liveOnSatData: any[]): OfficialBroadcaster[] => {
    const homeTerms = getSearchTerms(home);
    const awayTerms = getSearchTerms(away);
    
    const matches = liveOnSatData.filter(m => {
        const teams = m.teams.toLowerCase();
        const homeMatch = homeTerms.some(term => teams.includes(term));
        const awayMatch = awayTerms.some(term => teams.includes(term));
        return homeMatch && awayMatch;
    });

    return matches.map(m => ({
        source: m.source || "Official Source",
        channels: m.channels || [],
        competition: m.competition
    }));
};

export const fetchMatchDetails = async (match: Match): Promise<MatchDetail> => {
    const matchId = match.id;
    try {
        const [incidentsData, lineupsData, statsData, liveOnSat] = await Promise.all([
            safeFetch(`/api/sofascore/event/${matchId}/incidents`).catch(() => ({ incidents: [] })),
            safeFetch(`/api/sofascore/event/${matchId}/lineups`).catch(() => ({})),
            safeFetch(`/api/sofascore/event/${matchId}/statistics`).catch(() => ({ statistics: [] })),
            fetchLiveOnSatData()
        ]);

        const mapPlayer = (p: any): Player => ({
            name: p.player?.name || 'Player',
            number: p.jerseyNumber || 0,
            position: p.player?.position || 'N/A'
        });

        const homeLineup = (lineupsData.home?.players || []).map((p: any) => mapPlayer(p));
        const awayLineup = (lineupsData.away?.players || []).map((p: any) => mapPlayer(p));
        const homeSubs = (lineupsData.home?.substitutes || []).map((p: any) => mapPlayer(p));
        const awaySubs = (lineupsData.away?.substitutes || []).map((p: any) => mapPlayer(p));

        const getStat = (groupName: string, itemName: string, side: 'home' | 'away') => {
            const allStats = statsData.statistics?.[0]?.groups || [];
            const group = allStats.find((g: any) => g.groupName === groupName);
            const item = group?.statisticsItems?.find((i: any) => i.name === itemName);
            if (!item) return side === 'home' ? 50 : 50; 
            const val = side === 'home' ? item.homeValue : item.awayValue;
            const parsed = typeof val === 'string' ? parseInt(val.replace('%', '')) : val;
            return isNaN(parsed) ? 0 : parsed;
        };

        const stats: MatchStats = {
            possession: [getStat('Match overview', 'Ball possession', 'home'), getStat('Match overview', 'Ball possession', 'away')],
            shots: [getStat('Match overview', 'Total shots', 'home'), getStat('Match overview', 'Total shots', 'away')],
            shotsOnTarget: [getStat('Match overview', 'Shots on target', 'home'), getStat('Match overview', 'Shots on target', 'away')],
            corners: [getStat('Match overview', 'Corner kicks', 'home'), getStat('Match overview', 'Corner kicks', 'away')],
            fouls: [getStat('Match overview', 'Fouls', 'home'), getStat('Match overview', 'Fouls', 'away')]
        };

        const incidents: Incident[] = (incidentsData.incidents || []).map((inc: any) => ({
            type: inc.incidentType === 'substitution' ? 'substitution' : inc.incidentType,
            playerIn: inc.playerIn ? { name: inc.playerIn.name, number: 0, position: '' } : undefined,
            playerOut: inc.playerOut ? { name: inc.playerOut.name, number: 0, position: '' } : undefined,
            player: inc.player ? { name: inc.player.name, number: 0, position: '' } : undefined,
            time: inc.time,
            isHome: inc.isHome
        }));

        // Re-run source matching to ensure we have the latest signals
        const allIptv = getAllChannels();
        const preProcessedIptv = allIptv.map(ch => ({
            source: ch,
            normalized: normalizeChannelName(ch.name),
            original: ch.name
        }));
        
        const dynamicSources = findIptvSourcesForMatch(match.homeTeam.name, match.awayTeam.name, match.league, match.leagueLogo, liveOnSat, preProcessedIptv);
        const finalSources = dynamicSources.length > 0 ? dynamicSources : (match.sources || []);
        
        const officialBroadcasters = findOfficialBroadcastersForMatch(match.homeTeam.name, match.awayTeam.name, liveOnSat);

        return {
            ...match,
            sources: finalSources,
            officialBroadcasters,
            venue: lineupsData.venue?.name || "Arena Stadium",
            referee: lineupsData.referee?.name || "Match Official",
            homeLineup,
            awayLineup,
            homeSubstitutes: homeSubs,
            awaySubstitutes: awaySubs,
            homeFormation: lineupsData.home?.formation,
            awayFormation: lineupsData.away?.formation,
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
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null; 
};





async function callGeminiSafe(prompt: string, useSearch: boolean = true) {
    const model = 'gemini-3-flash-preview';
    try {
        const ai = getAi();
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

export const fetchHighlights = async (homeTeam: string, awayTeam: string, league?: string, date?: string, matchId?: string): Promise<NewsItem[]> => {
    const fetchTask = async () => {
        try {
            // 1. Try Sofascore Media API first if matchId is provided
            if (matchId) {
                try {
                    const mediaRes = await safeFetch(`/api/sofascore/event/${matchId}/media`);
                    if (mediaRes && mediaRes.media && mediaRes.media.length > 0) {
                        const highlights = mediaRes.media.filter((m: any) => {
                            const isYoutube = m.url?.includes('youtube.com') || m.url?.includes('youtu.be');
                            const isHighlight = m.subtitle?.toLowerCase().includes('highlights') || m.title?.toLowerCase().includes('highlights');
                            return isYoutube && isHighlight;
                        });
                        if (highlights.length > 0) {
                            // Deduplicate by videoUrl
                            const uniqueHighlights: any[] = [];
                            const seenUrls = new Set();
                            for (const v of highlights) {
                                if (!seenUrls.has(v.url)) {
                                    seenUrls.add(v.url);
                                    uniqueHighlights.push(v);
                                }
                            }
                            
                            return uniqueHighlights.map((v: any) => {
                                const yId = v.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1];
                                return {
                                    id: v.id.toString(),
                                    title: v.title || `${homeTeam} vs ${awayTeam} Highlights`,
                                    summary: v.subtitle || `Official Highlights`,
                                    timestamp: new Date((v.createdAtTimestamp || Date.now() / 1000) * 1000).toISOString(),
                                    imageUrl: v.thumbnailUrl || (yId ? `https://img.youtube.com/vi/${yId}/hqdefault.jpg` : ''),
                                    videoUrl: v.url
                                };
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`Sofascore media fetch failed for ${matchId}`, e);
                }
            }
            return [];
        } catch (err: any) {
            return [];
        }
    };

    // 20s timeout for individual match highlights
    return withTimeout(fetchTask(), 20000, []);
};

export const BIG_COMPETITIONS = [
    'Premier League',
    'LaLiga',
    'Bundesliga',
    'Serie A',
    'Ligue 1',
    'UEFA Champions League',
    'UEFA Europa League',
    'UEFA Europa Conference League',
    'World Cup',
    'Euro',
    'Copa America',
    'Africa Cup of Nations',
    'Asian Cup',
    'MLS',
    'Saudi Pro League',
    'Eredivisie',
    'Primeira Liga',
    'Brasileirão',
    'Liga MX'
];

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
};

export const fetchHighlightsForMatches = async (matches: Match[]): Promise<NewsItem[]> => {
    // Filter finished matches
    const targets = matches.filter(m => m.status === 'FINISHED');

    if (targets.length === 0) return [];

    try {
        const highlightPromises = targets.map(match => 
            fetchHighlights(match.homeTeam.name, match.awayTeam.name, match.league, match.date, match.id)
        );
        
        // Use a 60s timeout for the entire batch since we are fetching for all leagues
        const results = await withTimeout(Promise.all(highlightPromises), 60000, []);
        const allHighlights: NewsItem[] = [];
        
        results.forEach(highlights => {
            if (highlights && highlights.length > 0) {
                // Add all highlights found for the match, not just the first one
                allHighlights.push(...highlights);
            }
        });
        
        // If we timed out or got no results, return empty array
        return allHighlights;
    } catch (err) {
        return [];
    }
};

export const sendChatMessage = async (msg: string, history: any[]) => {
    try {
        const ai = getAi();
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
                name: chunk.web?.title || "Official Resource",
                url: chunk.web?.uri || "#"
            })).filter((s: any) => s.url !== "#")
        };
    } catch (err) {
        return { text: "Arena Signal Interrupted. Please check your network." };
    }
};
