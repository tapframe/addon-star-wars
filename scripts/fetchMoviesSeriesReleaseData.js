require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY; // Optional

const outputFilePath = path.join(__dirname, '../Data/moviesSeriesReleaseData.js');

// --- List of Content to Fetch (Initial list, will be sorted by release date) ---
const contentList = [
    { title: "The Acolyte", year: 2024, type: "series" },
    { title: "Star Wars: Episode I – The Phantom Menace", year: 1999, type: "movie" },
    { title: "Star Wars: Episode II – Attack of the Clones", year: 2002, type: "movie" },
    { title: "Star Wars: The Clone Wars", year: 2008, type: "movie", searchTitle: "Star Wars: The Clone Wars" },
    { title: "Star Wars: The Clone Wars", year: 2008, type: "series", searchTitle: "Star Wars: The Clone Wars" }, 
    { title: "Star Wars: Tales of the Jedi", year: 2022, type: "series" },
    { title: "Star Wars: Episode III – Revenge of the Sith", year: 2005, type: "movie" },
    { title: "Star Wars: Tales of the Empire", year: 2024, type: "series" },
    { title: "Star Wars: The Bad Batch", year: 2021, type: "series" },
    { title: "Solo: A Star Wars Story", year: 2018, type: "movie" },
    { title: "Obi-Wan Kenobi", year: 2022, type: "series" },
    { title: "Star Wars Rebels", year: 2014, type: "series" },
    { title: "Andor", year: 2022, type: "series" },
    { title: "Rogue One: A Star Wars Story", year: 2016, type: "movie" },
    { title: "Star Wars: Episode IV – A New Hope", year: 1977, type: "movie" },
    { title: "Star Wars: Episode V – The Empire Strikes Back", year: 1980, type: "movie" },
    { title: "Star Wars: Episode VI – Return of the Jedi", year: 1983, type: "movie" },
    { title: "The Mandalorian", year: 2019, type: "series" },
    { title: "The Book of Boba Fett", year: 2021, type: "series" },
    { title: "Ahsoka", year: 2023, type: "series" },
    { title: "Star Wars: Skeleton Crew", year: 2024, type: "series" },
    { title: "Star Wars Resistance", year: 2018, type: "series" },
    { title: "Star Wars: Episode VII – The Force Awakens", year: 2015, type: "movie" },
    { title: "Star Wars: Episode VIII – The Last Jedi", year: 2017, type: "movie" },
    { title: "Star Wars: Episode IX – The Rise of Skywalker", year: 2019, type: "movie" }
];

// --- Helper Functions (Identical to fetchMoviesSeriesChronologicalData.js) ---
async function searchTmdb(title, year, type, searchTitleOverride) {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const queryTitle = searchTitleOverride || title;
    const yearParam = mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year';
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(queryTitle)}&${yearParam}=${year}&language=en-US`;
    
    console.log(`   Searching TMDb for: "${queryTitle}" (Year: ${year}, Type: ${type}) URL: ${url}`);
    try {
        const res = await axios.get(url);
        if (res.data && res.data.results && res.data.results.length > 0) {
            const exactMatch = res.data.results.find(r => (r.title || r.name)?.toLowerCase() === queryTitle.toLowerCase());
            const result = exactMatch || res.data.results[0];
            console.log(`   Found TMDb ID: ${result.id} for "${queryTitle}"`);
            return result.id;
        } else {
            const urlWithoutYear = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(queryTitle)}&language=en-US`;
            console.log(`   Retrying TMDb search without year for: "${queryTitle}" (Type: ${type}) URL: ${urlWithoutYear}`);
            const resWithoutYear = await axios.get(urlWithoutYear);
            if (resWithoutYear.data && resWithoutYear.data.results && resWithoutYear.data.results.length > 0) {
                const yearMatch = resWithoutYear.data.results.find(r => {
                    const releaseDate = r.release_date || r.first_air_date;
                    return releaseDate && releaseDate.startsWith(year.toString());
                });
                if (yearMatch) {
                    console.log(`   Found TMDb ID (without year search, matched year): ${yearMatch.id} for "${queryTitle}"`);
                    return yearMatch.id;
                }
                console.warn(`   ⚠️ TMDb search warning: Found results for "${queryTitle}" but no exact year match for ${year}. Using first result: ${resWithoutYear.data.results[0].id}`);
                return resWithoutYear.data.results[0].id;
            }
            console.warn(`   ⚠️ TMDb search warning: No results found for "${queryTitle}" (Type: ${type})`);
            return null;
        }
    } catch (error) {
        console.error(`   ❌ TMDb search error for "${queryTitle}" (Type: ${type}): ${error.message}`);
        if (error.response) console.error('   Error Response:', error.response.data);
        return null;
    }
}

async function getTmdbDetails(id, type) {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=external_ids,credits,videos,keywords`;
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
             console.warn(`   ⚠️ OMDB warning for ${imdbId}: ${res.data.Error}`);
             return null;
         }
        return res?.data || null;
    } catch (error) {
        console.warn(`   ⚠️ OMDB fetch error for ${imdbId}: ${error.message}`);
        return null;
    }
}

function writeDataFile(filePath, data) {
    const fileContent = `module.exports = ${JSON.stringify(data, null, 2)};\n`;
    try {
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`\n✅ Successfully wrote ${path.basename(filePath)} with ${data.length} items`);
    } catch (error) {
        console.error(`\n❌ Error writing data to ${path.basename(filePath)}: ${error.message}`);
    }
}

// --- Main Fetch Function ---
async function fetchReleaseData() {
    console.log('🚀 Starting Movies & Series Release Order data fetching process...');
    let fetchedItems = [];
    let processedCount = 0;

    for (const item of contentList) {
        processedCount++;
        console.log(`\nProcessing ${item.type} ${processedCount}/${contentList.length}: "${item.searchTitle || item.title}" (${item.year})...`);

        const tmdbId = await searchTmdb(item.title, item.year, item.type, item.searchTitle);
        let itemData = {
            originalTitle: item.title, // Keep original title for reference
            originalYear: item.year,   // Keep original year for reference
            type: item.type,
            tmdbId: tmdbId,
            title: item.title, // Default title
            imdbId: null,
            id: `sw_manually_added_${item.title.replace(/\W/g, '')}_${item.year}`,
            releaseYear: item.year.toString(),
            release_date: null, // Will be populated by TMDB details
            poster: null,
            ratings: [],
            genres: [],
            overview: 'Details to be fetched or added manually.',
            popularity: 0
        };

        if (!tmdbId) {
            console.warn(`   Skipping "${item.title}" (${item.year}) - Could not find TMDb ID.`);
            fetchedItems.push(itemData); // Add minimal data
            continue;
        }

        const details = await getTmdbDetails(tmdbId, item.type);
        if (!details) {
            console.warn(`   Skipping "${item.title}" (${item.year}) - Could not fetch TMDb details for ID ${tmdbId}.`);
            itemData.id = `sw_tmdb_${tmdbId}`; // Update ID if TMDB ID was found but details failed
            itemData.overview = 'Failed to fetch full details.';
            fetchedItems.push(itemData);
            continue;
        }

        const title = (details.title || details.name || item.title).trim();
        const releaseDate = details.release_date || details.first_air_date;
        const releaseYear = releaseDate ? releaseDate.split('-')[0] : item.year.toString();
        
        const imdbId = details.external_ids?.imdb_id || null;
        const posterPath = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
        const overview = details.overview || '';
        const genres = details.genres || [];

        const omdbDetails = await getOmdbDetails(imdbId);
        const ratings = [];
        if (omdbDetails && omdbDetails.Ratings) {
            omdbDetails.Ratings.forEach(rating => {
                ratings.push({ Source: rating.Source, Value: rating.Value });
            });
        }
        if (omdbDetails && omdbDetails.imdbRating && !ratings.find(r => r.Source === 'Internet Movie Database')) {
             ratings.push({ Source: 'Internet Movie Database', Value: `${omdbDetails.imdbRating}/10` });
        }

        const trailerVideo = details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');

        fetchedItems.push({
            tmdbId: tmdbId,
            title,
            type: item.type,
            imdbId: imdbId || `tmdb_${tmdbId}`,
            id: `sw_${imdbId || ('tmdb_' + tmdbId)}`,
            releaseYear,
            release_date: releaseDate, // Crucial for sorting
            poster: posterPath,
            background: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
            overview: overview,
            ratings,
            genres: genres.map(g => ({ id: g.id, name: g.name })),
            runtime: details.runtime || (details.episode_run_time ? details.episode_run_time[0] : null),
            trailer: trailerVideo ? `plugin://plugin.video.youtube?action=play_video&videoid=${trailerVideo.key}` : null,
            popularity: details.popularity,
            // Keep original input for reference if needed, though not written to file
            originalTitle: item.title,
            originalYear: item.year,
        });
    }

    // Sort by release_date (YYYY-MM-DD), then by original list order for ties
    fetchedItems.sort((a, b) => {
        if (a.release_date && b.release_date) {
            if (a.release_date < b.release_date) return -1;
            if (a.release_date > b.release_date) return 1;
        }
        // Fallback sorting for items without a release_date or if dates are equal
        if (!a.release_date && b.release_date) return 1; // Items without date go last
        if (a.release_date && !b.release_date) return -1; // Items without date go last
        // If dates are same or both null, maintain original relative order (approximated by index in contentList)
        const aIndex = contentList.findIndex(item => item.title === a.originalTitle && item.year === a.originalYear && item.type === a.type);
        const bIndex = contentList.findIndex(item => item.title === b.originalTitle && item.year === b.originalYear && item.type === b.type);
        return aIndex - bIndex;
    });
    
    // Remove temporary fields before writing
    const finalData = fetchedItems.map(item => {
        const { originalTitle, originalYear, ...rest } = item;
        return rest;
    });

    writeDataFile(outputFilePath, finalData);
    console.log('\n✨ Movies & Series Release Order data fetching complete.');
}

// --- Execute ---
fetchReleaseData(); 