const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const axios = require('axios');
const bountyHuntersUnderworldData = require('../Data/bountyHuntersUnderworldData');
const jediSithLoreData = require('../Data/jediSithLoreData');
const droidsCreaturesData = require('../Data/droidsCreaturesData');
const animatedSeriesData = require('../Data/animatedSeriesData');
const empireEraData = require('../Data/empireEraData');
const microSeriesShortsData = require('../Data/microSeriesShortsData');
const newRepublicEraData = require('../Data/newRepublicEraData');
const highRepublicEraData = require('../Data/highRepublicEraData');
const anthologyFilmsData = require('../Data/anthologyFilmsData');
const liveActionSeriesData = require('../Data/liveActionSeriesData');

require('dotenv').config();

// Get API keys and port
let tmdbKey, omdbKey, port;
try {
    ({ tmdbKey, omdbKey, port } = require('./config'));
} catch (error) {
    console.error('Error loading config.js. Using environment variables.', error);
    port = process.env.PORT || 7000;
    tmdbKey = process.env.TMDB_API_KEY;
    omdbKey = process.env.OMDB_API_KEY;
    
    if (!tmdbKey || !omdbKey) {
        console.error('CRITICAL: API keys (TMDB_API_KEY, OMDB_API_KEY) are missing. Addon cannot fetch metadata.');
    }
}

const app = express();

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cache for 3 weeks
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=1814400');
    next();
});

// Variable to store cache separated by ID
let cachedCatalog = {};

// Helper function for TMDb details fetching
async function getTmdbDetails(id, type) {
    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${tmdbKey}&language=en-US&append_to_response=external_ids`;
    try {
        const res = await axios.get(url);
        return res;
    } catch (err) {
        console.error(`TMDb details error for ${type}/${id}: ${err.message}`);
        return {};
    }
}

// Helper function to fetch additional metadata
async function fetchAdditionalData(item) {
  console.log('\n--- Fetching details for item: ---', item); // Log raw item

  // Basic validation of the input item
  if (!item || (!item.imdbId && !item.id) || !item.type || !item.title) { // Allow using item.id if imdbId missing
      console.warn('Skipping item due to missing essential data:', item);
      return null;
  }
  const lookupId = item.imdbId || item.id; // Prefer imdbId but use item.id as fallback
  const idPrefix = lookupId.split('_')[0]; // Check prefix (e.g., 'tt' or 'tmdb')
  const isImdb = idPrefix === 'tt' || (item.imdbId && !item.imdbId.startsWith('tmdb_'));

  // Check if API keys are available
  if (!tmdbKey || (!omdbKey && isImdb)) { // OMDb key only needed if we have an IMDb ID
      console.warn(`Skipping metadata fetch for ${item.title} (${lookupId}) because API keys are missing.`);
      // Return minimal data if keys are missing
      return {
          id: lookupId,
          type: item.type,
          name: item.type === 'series' ? item.title.replace(/ Season \d+/, '') : item.title,
          poster: item.poster || null, // Use poster from data file if available
          description: item.overview || 'Metadata lookup unavailable (API key missing).', // Use local overview
          releaseInfo: item.releaseYear || 'N/A',
          imdbRating: 'N/A',
          genres: item.genres ? item.genres.map(g => g.name) : []
      };
  }

  let omdbData = {};
  let tmdbData = {};
  let tmdbImagesData = {};

  try {
    // OMDb call only if we have a real IMDb ID
    const omdbPromise = isImdb
        ? axios.get(`http://www.omdbapi.com/?i=${lookupId}&apikey=${omdbKey}`).catch((err) => {
              console.error(`OMDB error for ${lookupId}: ${err.message}`);
              return {};
          })
        : Promise.resolve({}); // Resolve immediately if no IMDb ID

    // TMDb search/details call
    // We need TMDb ID for images, try to get it from item first
    let effectiveTmdbId = item.tmdbId || (idPrefix === 'tmdb' ? lookupId.split('_')[1] : null);
    let tmdbDetailsPromise;
    if (effectiveTmdbId) {
        // If we have tmdbId, fetch details directly
        const tmdbDetailsUrl = `https://api.themoviedb.org/3/${item.type}/${effectiveTmdbId}?api_key=${tmdbKey}&language=en-US`;
        tmdbDetailsPromise = axios.get(tmdbDetailsUrl).catch((err) => {
            console.error(`TMDB Details error for ${item.type}/${effectiveTmdbId}: ${err.message}`);
            return {};
        });
    } else {
        // If no tmdbId, search TMDb by title/year
        const tmdbSearchUrl = `https://api.themoviedb.org/3/search/${item.type}?api_key=${tmdbKey}&query=${encodeURIComponent(item.title)}&year=${item.releaseYear}`;
        tmdbDetailsPromise = axios.get(tmdbSearchUrl).then(res => 
            res.data?.results?.[0] ? getTmdbDetails(res.data.results[0].id, item.type) : {})
        .catch((err) => {
            console.error(`TMDB Search error for ${item.title}: ${err.message}`);
            return {};
        });
    }

    // Fetch Images using TMDb ID (if we found one)
    const tmdbImagesPromise = tmdbDetailsPromise.then(detailsRes => {
        const foundTmdbId = detailsRes?.data?.id || effectiveTmdbId; // Get ID from details if available
        if (foundTmdbId) {
            const tmdbImagesUrl = `https://api.themoviedb.org/3/${item.type}/${foundTmdbId}/images?api_key=${tmdbKey}`;
            return axios.get(tmdbImagesUrl).catch((err) => {
                if (!err.response || err.response.status !== 404) {
                    console.warn(`TMDb Images error for ${item.title}: ${err.message}`);
                }
                return {};
            });
        } else {
            return Promise.resolve({}); // No TMDb ID, no images
        }
    });

    console.log(`Fetching data for ${item.title} (${lookupId})...`);
    const [omdbRes, tmdbDetailsResult, tmdbImagesRes] = await Promise.all([
      omdbPromise,
      tmdbDetailsPromise,
      tmdbImagesPromise
    ]);

    omdbData = omdbRes.data || {};
    tmdbData = tmdbDetailsResult.data || {}; // If searched, this might already be details
    tmdbImagesData = tmdbImagesRes.data || {};

    // Poster priority: local data -> TMDb -> OMDb -> fallback
    let poster = item.poster || null;
    if (!poster && tmdbData.poster_path) {
      poster = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
    }
    if (!poster && omdbData.Poster && omdbData.Poster !== 'N/A') {
      poster = omdbData.Poster;
    }

    let logoUrl = null;
    if (tmdbImagesData.logos && tmdbImagesData.logos.length > 0) {
      let bestLogo = tmdbImagesData.logos.find(logo => logo.iso_639_1 === 'en');
      if (!bestLogo) {
        bestLogo = tmdbImagesData.logos[0];
      }
      if (bestLogo && bestLogo.file_path) {
          logoUrl = `https://image.tmdb.org/t/p/original${bestLogo.file_path}`;
      }
    }
    console.log(`   > Selected logo URL: ${logoUrl || 'Not found'}`);

    // Description priority: local data -> TMDb -> OMDb -> fallback
    const description = item.overview || tmdbData.overview || omdbData.Plot || 'No description available.';

    const meta = {
      id: lookupId, // Use the ID we actually used for lookup
      type: item.type,
      name: item.type === 'series' ? item.title.replace(/ Season \d+/, '') : item.title,
      logo: logoUrl,
      poster: poster,
      description: description,
      releaseInfo: item.releaseYear || (tmdbData.release_date ? tmdbData.release_date.split('-')[0] : (tmdbData.first_air_date ? tmdbData.first_air_date.split('-')[0] : 'N/A')),
      imdbRating: omdbData.imdbRating || 'N/A',
      // Use TMDb genres if available, otherwise fallback to local genres
      genres: tmdbData.genres ? tmdbData.genres.map(g => g.name) : (item.genres ? item.genres.map(g => g.name) : [])
    };

    console.log('   > Returning metadata:', { ...meta, description: meta.description.substring(0, 50) + '...'}); // Log truncated desc
    return meta;
  } catch (err) {
    console.error(`Error processing ${item.title} (${lookupId}): ${err.message}`);
    return null;
  }
}

// Get all available catalogs
function getAllCatalogs() {
    return [
        {
            type: "StarWars",
            id: "sw-skywalker-saga",
            name: "Skywalker Saga"
        },
        {
            type: "StarWars",
            id: "sw-anthology-films",
            name: "Anthology Films"
        },
        {
            type: "StarWars",
            id: "sw-live-action-series",
            name: "Live-Action Series"
        },
        {
            type: "StarWars",
            id: "sw-animated-series",
            name: "Animated Series"
        },
        {
            type: "StarWars",
            id: "sw-micro-series-shorts",
            name: "Micro-Series & Shorts"
        },
        {
            type: "StarWars",
            id: "sw-high-republic-era",
            name: "High Republic Era"
        },
        {
            type: "StarWars",
            id: "sw-empire-era",
            name: "Empire Era"
        },
        {
            type: "StarWars",
            id: "sw-new-republic-era",
            name: "New Republic Era"
        },
        {
            type: "StarWars",
            id: "sw-bounty-hunters-underworld",
            name: "Bounty Hunters & Underworld"
        },
        {
            type: "StarWars",
            id: "sw-jedi-sith-lore",
            name: "Jedi & Sith Lore"
        },
        {
            type: "StarWars",
            id: "sw-droids-creatures",
            name: "Droids & Creatures"
        }
    ];
}

// Define the configuration page
app.get('/configure', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'configure.html'));
});

// Custom catalog manifest endpoint
app.get('/catalog/:catalogsParam/manifest.json', (req, res) => {
    const catalogsParam = req.params.catalogsParam;
    
    // Parse the selected catalogs from the URL
    const selectedCatalogIds = catalogsParam ? decodeURIComponent(catalogsParam).split(',') : [];
    
    console.log(`Custom catalog manifest requested - Selected catalogs: ${selectedCatalogIds.join(', ')}`);
    
    // Filter catalogs based on user selection
    const allCatalogs = getAllCatalogs();
    let filteredCatalogs = allCatalogs;
    
    if (selectedCatalogIds.length > 0) {
        filteredCatalogs = allCatalogs.filter(catalog => selectedCatalogIds.includes(catalog.id));
    }
    
    // Create the customized manifest
    const manifest = {
        id: "com.starwars.addon.custom",
        name: "Star Wars Universe Custom",
        description: "Your personalized Star Wars Universe collection",
        version: "1.0.0",
        logo: "URL_TO_STAR_WARS_ICON.png",
        background: "URL_TO_STAR_WARS_BACKGROUND.jpg",
        catalogs: filteredCatalogs,
        resources: ["catalog"],
        types: ["movie", "series"],
        idPrefixes: ["sw_"],
        behaviorHints: {
            configurable: true
        },
        contactEmail: "YOUR_EMAIL@example.com"
    };
    
    res.json(manifest);
});

// Default manifest endpoint
app.get('/manifest.json', (req, res) => {
    console.log('Default manifest requested');
    
    const manifest = {
        id: "com.starwars.addon",
        name: "Star Wars Universe",
        description: "Explore the Star Wars Universe by sagas, series, eras, and more!",
        version: "1.0.0",
        logo: "URL_TO_STAR_WARS_ICON.png",
        background: "URL_TO_STAR_WARS_BACKGROUND.jpg",
        catalogs: getAllCatalogs(),
        resources: ["catalog"],
        types: ["movie", "series"],
        idPrefixes: ["sw_"],
        behaviorHints: {
            configurable: true
        },
        contactEmail: "YOUR_EMAIL@example.com"
    };
    
    res.json(manifest);
});

// API endpoint for catalog info
app.get('/api/catalogs', (req, res) => {
    console.log('Catalog info requested');
    
    const catalogInfo = [
        { 
            id: 'sw-skywalker-saga', 
            name: 'Skywalker Saga', 
            category: 'Sagas',
            description: 'The central narrative arc of the Skywalker family.',
            icon: 'star'
        },
        { 
            id: 'sw-anthology-films', 
            name: 'Anthology Films', 
            category: 'Films',
            description: 'Standalone stories expanding the Star Wars universe.',
            icon: 'film' 
        },
        { 
            id: 'sw-live-action-series', 
            name: 'Live-Action Series', 
            category: 'Series',
            description: 'Television series exploring various characters and timelines.',
            icon: 'tv'
        },
        { 
            id: 'sw-animated-series', 
            name: 'Animated Series', 
            category: 'Series',
            description: 'Animated shows set in various eras of the Star Wars timeline.',
            icon: 'play-circle' 
        },
        { 
            id: 'sw-micro-series-shorts', 
            name: 'Micro-Series & Shorts', 
            category: 'Shorts',
            description: 'Short-form content offering unique stories.',
            icon: 'th-large'
        },
        { 
            id: 'sw-high-republic-era', 
            name: 'High Republic Era', 
            category: 'Eras',
            description: 'Stories from the golden age of the Jedi.',
            icon: 'landmark'
        },
        { 
            id: 'sw-empire-era', 
            name: 'Empire Era', 
            category: 'Eras',
            description: 'Content during the reign of the Galactic Empire.',
            icon: 'empire'
        },
        { 
            id: 'sw-new-republic-era', 
            name: 'New Republic Era', 
            category: 'Eras',
            description: 'Stories following the fall of the Empire.',
            icon: 'rebel'
        },
        { 
            id: 'sw-bounty-hunters-underworld', 
            name: 'Bounty Hunters & Underworld', 
            category: 'Themes',
            description: 'Exploring the galaxy\'s criminal elements.',
            icon: 'user-secret'
        },
        { 
            id: 'sw-jedi-sith-lore', 
            name: 'Jedi & Sith Lore', 
            category: 'Themes',
            description: 'Delving into the histories of Jedi and Sith.',
            icon: 'book-dead'
        },
        { 
            id: 'sw-droids-creatures', 
            name: 'Droids & Creatures', 
            category: 'Themes',
            description: 'Content centered on droids and creatures.',
            icon: 'robot'
        }
    ];
    
    res.json(catalogInfo);
});

// Custom catalog endpoint
app.get('/catalog/:catalogsParam/catalog/:type/:id.json', async (req, res) => {
    const { catalogsParam, type, id } = req.params;
    console.log(`Custom catalog requested - Catalogs: ${catalogsParam}, Type: ${type}, ID: ${id}`);
    
    // Check cache
    const cacheKey = `custom-${id}-${catalogsParam}`;
    if (cachedCatalog[cacheKey]) {
        console.log(`✅ Returning cached catalog for ID: ${cacheKey}`);
        return res.json(cachedCatalog[cacheKey]);
    }
    
    let dataSource;
    let dataSourceName = id;
    
    // Load data based on catalog ID
    try {
        switch (id) {
            case 'sw-skywalker-saga':
                dataSource = require('../Data/skywalkerSagaData');
                break;
            case 'sw-bounty-hunters-underworld':
                dataSource = bountyHuntersUnderworldData;
                break;
            case 'sw-jedi-sith-lore':
                dataSource = jediSithLoreData;
                break;
            case 'sw-droids-creatures':
                dataSource = droidsCreaturesData;
                break;
            case 'sw-animated-series':
                dataSource = animatedSeriesData;
                break;
            case 'sw-empire-era':
                dataSource = empireEraData;
                break;
            case 'sw-micro-series-shorts':
                dataSource = microSeriesShortsData;
                break;
            case 'sw-new-republic-era':
                dataSource = newRepublicEraData;
                break;
            case 'sw-high-republic-era':
                dataSource = highRepublicEraData;
                break;
            case 'sw-anthology-films':
                dataSource = anthologyFilmsData;
                dataSourceName = 'Anthology Films';
                break;
            case 'sw-live-action-series':
                dataSource = liveActionSeriesData;
                dataSourceName = 'Live-Action Series';
                break;
            default:
                console.warn(`Unrecognized catalog ID: ${id}`);
                return res.json({ metas: [] });
        }
        
        if (!Array.isArray(dataSource)) {
            throw new Error(`Data source for ID ${id} is not a valid array.`);
        }
        console.log(`Loaded ${dataSource.length} items for catalog: ${dataSourceName}`);
    } catch (error) {
        console.error(`❌ Error loading data for catalog ID ${id}:`, error.message);
        return res.json({ metas: [] });
    }
    
    console.log(`⏳ Generating catalog for ${dataSourceName}...`);
    const metas = await Promise.all(
        dataSource.map(item => fetchAdditionalData(item))
    );
    
    const validMetas = metas.filter(item => item !== null);
    console.log(`✅ Catalog generated with ${validMetas.length} items for ID: ${id}`);
    
    // Store in cache
    cachedCatalog[cacheKey] = { metas: validMetas };
    
    // Return the data
    return res.json(cachedCatalog[cacheKey]);
});

// Default catalog endpoint
app.get('/catalog/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    console.log(`Default catalog requested - Type: ${type}, ID: ${id}`);
    
    // Check cache
    const cacheKey = `default-${id}`;
    if (cachedCatalog[cacheKey]) {
        console.log(`✅ Returning cached catalog for ID: ${cacheKey}`);
        return res.json(cachedCatalog[cacheKey]);
    }
    
    let dataSource;
    let dataSourceName = id;
    
    // Load data based on catalog ID
    try {
        switch (id) {
            case 'sw-skywalker-saga':
                dataSource = require('../Data/skywalkerSagaData');
                break;
            case 'sw-bounty-hunters-underworld':
                dataSource = bountyHuntersUnderworldData;
                break;
            case 'sw-jedi-sith-lore':
                dataSource = jediSithLoreData;
                break;
            case 'sw-droids-creatures':
                dataSource = droidsCreaturesData;
                break;
            case 'sw-animated-series':
                dataSource = animatedSeriesData;
                break;
            case 'sw-empire-era':
                dataSource = empireEraData;
                break;
            case 'sw-micro-series-shorts':
                dataSource = microSeriesShortsData;
                break;
            case 'sw-new-republic-era':
                dataSource = newRepublicEraData;
                break;
            case 'sw-high-republic-era':
                dataSource = highRepublicEraData;
                break;
            case 'sw-anthology-films':
                dataSource = anthologyFilmsData;
                dataSourceName = 'Anthology Films';
                break;
            case 'sw-live-action-series':
                dataSource = liveActionSeriesData;
                dataSourceName = 'Live-Action Series';
                break;
            default:
                console.warn(`Unrecognized catalog ID: ${id}`);
                return res.json({ metas: [] });
        }
        
        if (!Array.isArray(dataSource)) {
            throw new Error(`Data source for ID ${id} is not a valid array.`);
        }
        console.log(`Loaded ${dataSource.length} items for catalog: ${dataSourceName}`);
    } catch (error) {
        console.error(`❌ Error loading data for catalog ID ${id}:`, error.message);
        return res.json({ metas: [] });
    }
    
    console.log(`⏳ Generating catalog for ${dataSourceName}...`);
    const metas = await Promise.all(
        dataSource.map(item => fetchAdditionalData(item))
    );
    
    const validMetas = metas.filter(item => item !== null);
    console.log(`✅ Catalog generated with ${validMetas.length} items for ID: ${id}`);
    
    // Store in cache
    cachedCatalog[cacheKey] = { metas: validMetas };
    
    // Return the data
    return res.json(cachedCatalog[cacheKey]);
});

// Default routes
app.get('/', (req, res) => {
    res.redirect('/configure');
});

app.listen(port, () => {
    console.log(`Star Wars Universe Addon server running at http://localhost:${port}/`);
    console.log(`Configuration page: http://localhost:${port}/configure`);
    console.log(`To install with custom catalogs: stremio://localhost:${port}/catalog/CATALOG_IDS/manifest.json`);
});

// Export the fetchAdditionalData function for testing
module.exports = { fetchAdditionalData };