require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY; // Optional, will fetch ratings if key is valid

const outputSkywalkerSagaPath = path.join(__dirname, '../Data/skywalkerSagaData.js');

// --- List of Skywalker Saga Movies to Fetch (Episodic Order) ---
const skywalkerSagaMoviesToFetch = [
    { title: "Star Wars: Episode I - The Phantom Menace", year: 1999, type: 'movie' }, // Adjusted title for better search
    { title: "Star Wars: Episode II - Attack of the Clones", year: 2002, type: 'movie' }, // Adjusted title
    { title: "Star Wars: Episode III - Revenge of the Sith", year: 2005, type: 'movie' }, // Adjusted title
    { title: "Star Wars: Episode IV - A New Hope", year: 1977, type: 'movie' }, // Adjusted title
    { title: "Star Wars: Episode V - The Empire Strikes Back", year: 1980, type: 'movie' }, // Adjusted title
    { title: "Star Wars: Episode VI - Return of the Jedi", year: 1983, type: 'movie' }, // Adjusted title
    { title: "Star Wars: Episode VII - The Force Awakens", year: 2015, type: 'movie' }, // Adjusted title
    { title: "Star Wars: Episode VIII - The Last Jedi", year: 2017, type: 'movie' }, // Adjusted title
    { title: "Star Wars: Episode IX - The Rise of Skywalker", year: 2019, type: 'movie' } // Adjusted title
];

// --- Helper Functions ---

async function searchTmdb(title, year, type) {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&${mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year'}=${year}&language=en-US`;
    try {
        console.log(`   Searching TMDb for: \"${title}\" (${year}, ${type})`);
        const res = await axios.get(url);
        if (res.data && res.data.results && res.data.results.length > 0) {
            console.log(`   Found TMDb ID: ${res.data.results[0].id} for \"${title}\"`);
            return res.data.results[0].id;
        } else {
            console.warn(`   ⚠️ TMDb search warning: No results found for \"${title}\" (${year}, ${type})`);
            return null;
        }
    } catch (error) {
        console.error(`   ❌ TMDb search error for \"${title}\" (${year}, ${type}): ${error.message}`);
        return null;
    }
}

async function getTmdbDetails(id, type) {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=external_ids`;
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

function writeDataFile(filePath, data) {
    const fileContent = `module.exports = ${JSON.stringify(data, null, 2)};\n`;
    try {
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`\n✅ Successfully wrote ${data.length} items to ${path.basename(filePath)}`);
    } catch (error) {
        console.error(`\n❌ Error writing data to ${path.basename(filePath)}: ${error.message}`);
    }
}

// --- Main Fetch Function ---

async function fetchSkywalkerSagaMovies() {
    console.log('🚀 Starting Skywalker Saga movie data fetching process...');
    const finalMovieData = [];
    let processedCount = 0;

    for (const movie of skywalkerSagaMoviesToFetch) {
        processedCount++;
        console.log(`\nProcessing movie ${processedCount}/${skywalkerSagaMoviesToFetch.length}: \"${movie.title}\" (${movie.year})...`);

        const tmdbId = await searchTmdb(movie.title, movie.year, movie.type);
        if (!tmdbId) {
            console.warn(`   Skipping \"${movie.title}\" (${movie.year}) - Could not find TMDb ID.`);
            finalMovieData.push({ // Add minimal data if TMDB ID not found to preserve order
                tmdbId: null,
                title: movie.title,
                type: movie.type,
                imdbId: null,
                id: `sw_manually_added_${movie.title.replace(/\W/g, '')}`,
                releaseYear: movie.year.toString(),
                poster: null,
                ratings: [],
                genres: [],
                overview: 'Details to be fetched or added manually.'
            });
            continue;
        }

        const details = await getTmdbDetails(tmdbId, movie.type);
        if (!details) {
            console.warn(`   Skipping \"${movie.title}\" (${movie.year}) - Could not fetch TMDb details for ID ${tmdbId}.`);
            finalMovieData.push({ // Add minimal data if details not found
                tmdbId: tmdbId,
                title: movie.title,
                type: movie.type,
                imdbId: null,
                id: `sw_tmdb_${tmdbId}`,
                releaseYear: movie.year.toString(),
                poster: null,
                ratings: [],
                genres: [],
                overview: 'Failed to fetch full details.'
            });
            continue;
        }

        const title = (details.title || details.name || movie.title).trim();
        const releaseYear = (details.release_date || details.first_air_date || movie.year.toString() || 'TBD').split('-')[0];
        const imdbId = details.external_ids?.imdb_id || null;
        const posterPath = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
        const overview = details.overview || '';
        const genres = details.genres || [];

        const omdbDetails = await getOmdbDetails(imdbId);
        const ratings = omdbDetails?.Ratings || [];

        finalMovieData.push({
            tmdbId: tmdbId,
            title,
            type: movie.type,
            imdbId: imdbId || `tmdb_${tmdbId}`, // Fallback if no IMDb ID
            id: `sw_${imdbId || 'tmdb_' + tmdbId}`,
            releaseYear,
            poster: posterPath,
            overview: overview,
            ratings,
            genres: genres.map(g => ({ id: g.id, name: g.name })) // Ensure genres are in the right format
        });
    }

    writeDataFile(outputSkywalkerSagaPath, finalMovieData);
    console.log('\n✨ Skywalker Saga movie data fetching complete.');
}

// --- Execute --- 
fetchSkywalkerSagaMovies(); 