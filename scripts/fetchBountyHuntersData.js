require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY; // Optional

const outputBountyHuntersPath = path.join(__dirname, '../Data/bountyHuntersUnderworldData.js'); // Updated output path

// --- List of Bounty Hunters & Underworld Content to Fetch ---
const contentToFetch = [
    { title: "The Book of Boba Fett", year: 2021, type: 'series' },
    { title: "Tales of the Underworld", year: 2025, type: 'series' }, // May not exist yet
    { title: "Maul – Shadow Lord", year: 2026, type: 'series' } // Unlikely to exist on TMDB
];


// --- Helper Functions (Consistent with other Star Wars fetching scripts) ---

async function searchTmdb(title, year, type) {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const yearParam = mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year';
    
    const urlWithYear = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&${yearParam}=${year}&language=en-US`;
    try {
        console.log(`   Searching TMDb for: \"${title}\" (${year}, ${type})`);
        const res = await axios.get(urlWithYear);
        if (res.data && res.data.results && res.data.results.length > 0) {
            const exactMatch = res.data.results.find(r => (r.name || r.title || '').toLowerCase() === title.toLowerCase());
            if (exactMatch) {
                console.log(`   Found TMDb ID (Exact Match): ${exactMatch.id} for \"${exactMatch.name || exactMatch.title}\"`);
                return exactMatch.id;
            }
            console.log(`   Found TMDb ID (First Result): ${res.data.results[0].id} for \"${res.data.results[0].name || res.data.results[0].title}\"`);
            return res.data.results[0].id;
        }
    } catch (error) {
        // console.error(`   ⚠️ TMDb search error (with year) for \"${title}\" (${year}, ${type}): ${error.message}`); // Reduce noise for expected failures
    }

    const urlNoYear = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US`;
    try {
        console.log(`   Retrying search without year for: \"${title}\" (${type})`);
        const resNoYear = await axios.get(urlNoYear);
        if (resNoYear.data && resNoYear.data.results && resNoYear.data.results.length > 0) {
             const releaseDateKey = mediaType === 'movie' ? 'release_date' : 'first_air_date';
             // For future/speculative titles, don't strictly check year if no-year search finds something
             // const matchingYearResult = resNoYear.data.results.find(r => r[releaseDateKey] && r[releaseDateKey].startsWith(year.toString()));
             // if (matchingYearResult) { ... }
             const fallbackResult = resNoYear.data.results[0]; // Take first result from no-year search
             console.log(`   Found TMDb ID (no year search, fallback): ${fallbackResult.id} for \"${fallbackResult.name || fallbackResult.title}\"`);
             return fallbackResult.id;
        }
    } catch (error) {
         // console.error(`   ❌ TMDb search error (no year) for \"${title}\" (${type}): ${error.message}`);
         return null;
    }

    console.warn(`   ⚠️ TMDb search warning: No results found for \"${title}\" (${type}, with or without year)`);
    return null;
}

async function getTmdbDetails(id, type) {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=external_ids,genres`;
    try {
        const res = await axios.get(url);
        return res?.data || null;
    } catch (error) {
        console.warn(`   ⚠️ TMDb fetch warning for ${mediaType}/${id}: ${error.message}`);
        return null;
    }
}

async function getOmdbDetails(imdbId) {
    if (!imdbId || !OMDB_API_KEY) return null;
    const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`;
    try {
        const res = await axios.get(url);
        if (res.data && res.data.Response === 'False') {
            return null;
        }
        return res?.data || null;
    } catch (error) {
        return null;
    }
}

function writeDataFile(filePath, data, itemTypeDescription) {
    const fileContent = `module.exports = ${JSON.stringify(data, null, 2)};\n`;
    try {
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`\n✅ Successfully wrote ${data.length} ${itemTypeDescription} items with required metadata to ${path.basename(filePath)}`);
    } catch (error) {
        console.error(`\n❌ Error writing ${itemTypeDescription} data to ${path.basename(filePath)}: ${error.message}`);
    }
}

function sortByFirstAirYear(a, b) {
    const yearA = parseInt(a.releaseYear, 10);
    const yearB = parseInt(b.releaseYear, 10);
    if (isNaN(yearA) && isNaN(yearB)) return 0;
    if (isNaN(yearA)) return 1;
    if (isNaN(yearB)) return -1;
    return yearA - yearB;
}

// --- Main Fetch Function ---

async function fetchBountyHuntersContent() { // Renamed function
    console.log('🚀 Starting Bounty Hunters & Underworld content data fetching process...'); // Updated log
    const finalContentData = [];
    let processedCount = 0;

    for (const item of contentToFetch) {
        processedCount++;
        console.log(`\nProcessing Bounty Hunter item ${processedCount}/${contentToFetch.length}: \"${item.title}\" (${item.year}, ${item.type})...`); // Updated log

        const tmdbId = await searchTmdb(item.title, item.year, item.type);
        if (!tmdbId) {
            console.warn(`   Skipping \"${item.title}\" (${item.year}) - Could not find TMDb ID.`);
            continue;
        }

        const details = await getTmdbDetails(tmdbId, item.type);
        if (!details) {
            console.warn(`   Skipping \"${item.title}\" (${item.year}) - Could not fetch TMDb details for ID ${tmdbId}.`);
            continue;
        }

        // Skip if essential data missing, maybe relax for future/speculative?
        if (!details.poster_path || !details.overview || details.overview.trim() === '') {
             // Allow items without poster/overview if they are future dated?
             const currentYear = new Date().getFullYear();
             if (parseInt(item.year) <= currentYear) { 
                 console.warn(`   Skipping \"${details.name || details.title || item.title}\" (${(details.first_air_date || details.release_date || '').split('-')[0] || item.year}) - Missing poster or overview for released item.`);
                 continue;
             } else {
                 console.log(`   Keeping future item \"${details.name || details.title || item.title}\" despite missing poster/overview.`);
             }
        }

        const title = (details.name || details.title || item.title).trim();
        const releaseDateKey = item.type === 'movie' ? 'release_date' : 'first_air_date';
        const releaseYear = (details[releaseDateKey] || item.year.toString() || 'TBD').split('-')[0];
        const imdbId = details.external_ids?.imdb_id || null;
        const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
        const genres = details.genres || [];
        const overview = details.overview || 'No overview available yet.'; // Provide default for future items

        const omdbDetails = await getOmdbDetails(imdbId);
        const ratings = omdbDetails?.Ratings || [];

        finalContentData.push({
            tmdbId: tmdbId,
            title,
            type: item.type,
            imdbId: imdbId || `tmdb_${tmdbId}`,
            id: `sw_${imdbId || 'tmdb_' + tmdbId}`, // Updated ID prefix to sw_
            releaseYear,
            poster,
            ratings,
            genres: genres.map(g => ({ id: g.id, name: g.name })),
            overview
        });
        console.log(`   Successfully processed \"${title}\" with required metadata.`);
    }

    finalContentData.sort(sortByFirstAirYear);
    writeDataFile(outputBountyHuntersPath, finalContentData, "Bounty Hunters & Underworld Content"); // Updated log
    console.log('\n✨ Bounty Hunters & Underworld content data fetching complete!'); // Updated log
}

// --- Run Script ---

fetchBountyHuntersContent().catch(err => { // Renamed function call
    console.error('❌ Critical error during script execution:', err);
    process.exit(1);
}); 