require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY; // Optional, will fetch ratings if key is valid

const outputAnthologyFilmsPath = path.join(__dirname, '../Data/anthologyFilmsData.js'); // Updated output path

// --- List of Anthology Films to Fetch ---
const moviesToFetch = [
    { title: "Rogue One: A Star Wars Story", year: 2016, type: 'movie' },
    { title: "Solo: A Star Wars Story", year: 2018, type: 'movie' }
];


// --- Helper Functions (Largely preserved, ensure types are handled if we add series later) ---

async function searchTmdb(title, year, type) { // Added type parameter for consistency
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const yearParam = mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year';
    
    const urlWithYear = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&${yearParam}=${year}&language=en-US`;
    try {
        console.log(`   Searching TMDb for: \"${title}\" (${year}, ${type})`);
        const res = await axios.get(urlWithYear);
        if (res.data && res.data.results && res.data.results.length > 0) {
            const exactMatch = res.data.results.find(r => (r.title || r.name || '').toLowerCase() === title.toLowerCase());
            if (exactMatch) {
                console.log(`   Found TMDb ID (Exact Title Match): ${exactMatch.id}`);
                return exactMatch.id;
            }
            console.log(`   Found TMDb ID (First Result): ${res.data.results[0].id} for \"${res.data.results[0].title || res.data.results[0].name}\"`);
            return res.data.results[0].id;
        }
    } catch (error) {
        console.error(`   ⚠️ TMDb search error (with year) for \"${title}\" (${year}, ${type}): ${error.message}`);
    }

    const urlNoYear = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US`;
    try {
        console.log(`   Retrying search without year for: \"${title}\" (${type})`);
        const resNoYear = await axios.get(urlNoYear);
        if (resNoYear.data && resNoYear.data.results && resNoYear.data.results.length > 0) {
            const releaseDateKey = mediaType === 'movie' ? 'release_date' : 'first_air_date';
            const matchingYearResult = resNoYear.data.results.find(r => r[releaseDateKey] && r[releaseDateKey].startsWith(year.toString()));
            if (matchingYearResult) {
                console.log(`   Found TMDb ID (no year search, year match): ${matchingYearResult.id} for \"${matchingYearResult.title || matchingYearResult.name}\"`);
                return matchingYearResult.id;
            }
            const fallbackResult = resNoYear.data.results[0];
            console.log(`   Found TMDb ID (no year search, fallback): ${fallbackResult.id} for \"${fallbackResult.title || fallbackResult.name}\"`);
            return fallbackResult.id;
        }
    } catch (error) {
         console.error(`   ❌ TMDb search error (no year) for \"${title}\" (${type}): ${error.message}`);
         return null;
    }

    console.warn(`   ⚠️ TMDb search warning: No results found for \"${title}\" (${type}, with or without year)`);
    return null;
}

async function getTmdbDetails(id, type) { // Added type parameter
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

function writeDataFile(filePath, data, itemTypeDescription) { // Added itemTypeDescription for logging
    const fileContent = `module.exports = ${JSON.stringify(data, null, 2)};\n`;
    try {
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`\n✅ Successfully wrote ${data.length} ${itemTypeDescription} items with required metadata to ${path.basename(filePath)}`);
    } catch (error) {
        console.error(`\n❌ Error writing ${itemTypeDescription} data to ${path.basename(filePath)}: ${error.message}`);
    }
}

function sortByReleaseYear(a, b) {
    const yearA = parseInt(a.releaseYear, 10);
    const yearB = parseInt(b.releaseYear, 10);
    if (isNaN(yearA) && isNaN(yearB)) return 0;
    if (isNaN(yearA)) return 1;
    if (isNaN(yearB)) return -1;
    return yearA - yearB;
}


// --- Main Fetch Function ---

async function fetchAnthologyFilms() { // Renamed function
    console.log('🚀 Starting Anthology Films data fetching process...'); // Updated log
    const finalMovieData = [];
    let processedCount = 0;

    for (const movie of moviesToFetch) {
        processedCount++;
        console.log(`\nProcessing Anthology Film ${processedCount}/${moviesToFetch.length}: \"${movie.title}\" (${movie.year})...`); // Updated log

        const tmdbId = await searchTmdb(movie.title, movie.year, movie.type);
        if (!tmdbId) {
            console.warn(`   Skipping \"${movie.title}\" (${movie.year}) - Could not find TMDb ID.`);
            // Optionally add placeholder like in Skywalker Saga script if needed
            continue;
        }

        const details = await getTmdbDetails(tmdbId, movie.type);
        if (!details) {
            console.warn(`   Skipping \"${movie.title}\" (${movie.year}) - Could not fetch TMDb details for ID ${tmdbId}.`);
            continue;
        }

        if (!details.poster_path || !details.overview || details.overview.trim() === '') {
            console.warn(`   Skipping \"${details.title || movie.title}\" (${(details.release_date || '').split('-')[0] || movie.year}) - Missing poster or overview.`);
            continue;
        }

        const title = (details.title || details.name || movie.title).trim();
        const releaseDateKey = movie.type === 'movie' ? 'release_date' : 'first_air_date';
        const releaseYear = (details[releaseDateKey] || movie.year.toString() || 'TBD').split('-')[0];
        const imdbId = details.external_ids?.imdb_id || null;
        const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
        const genres = details.genres || [];
        const overview = details.overview;

        const omdbDetails = await getOmdbDetails(imdbId);
        const ratings = omdbDetails?.Ratings || [];

        finalMovieData.push({
            tmdbId: tmdbId,
            title,
            type: movie.type,
            imdbId: imdbId || `tmdb_${tmdbId}`, // Fallback for ID
            id: `sw_${imdbId || 'tmdb_' + tmdbId}`, // Updated ID prefix to sw_
            releaseYear,
            poster,
            ratings,
            genres: genres.map(g => ({ id: g.id, name: g.name })), // Ensure correct format
            overview
        });
        console.log(`   Successfully processed \"${title}\" with required metadata.`);
    }

    finalMovieData.sort(sortByReleaseYear); // Keep sorting for this one, as order isn't inherently narrative
    writeDataFile(outputAnthologyFilmsPath, finalMovieData, "Anthology Film"); // Updated log
    console.log('\n✨ Anthology Films data fetching complete!'); // Updated log
}

// --- Run Script ---

fetchAnthologyFilms().catch(err => { // Renamed function call
    console.error('❌ Critical error during script execution:', err);
    process.exit(1);
}); 