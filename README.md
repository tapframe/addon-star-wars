# ⭐ Star Wars Universe Addon for Stremio

Explore the Star Wars Universe within Stremio! Browse movies and series organized by **Sagas**, **Eras**, **Content Types**, and **Themes**.

---

## ✨ Features

*   🌌 **Diverse Catalogs**: Explore content via Skywalker Saga, Anthology Films, Live-Action & Animated Series, Eras (High Republic, Empire, New Republic), Character/Theme collections (Jedi/Sith, Bounty Hunters, Droids/Creatures), and more.
*   🎬 **Movies & Series**: Covers both films and television series across the Star Wars timeline.
*   ⚡ **Data Updates**: Includes scripts to easily fetch and update content metadata from TMDb/OMDb.
*   🚀 **Fast & Lightweight**: Built using Node.js and Express.
*   🔧 **Configurable**: Choose exactly which catalogs you want to see in Stremio.
*   ⭐ **Poster Ratings**: Optional integration with [RatingPosterDB](https://ratingposterdb.com) to display IMDb ratings directly on posters (requires RPDB key).

---

## 📦 Installation

### Using the Configuration Page (Recommended)

Create your personalized Star Wars Universe addon with only the catalogs you want:

1.  Visit the configuration page: [`https://addon-star-wars.onrender.com/configure`](https://addon-star-wars.onrender.com/configure)
2.  Select the catalogs you want to include.
3.  **(Optional)** Enter your [RatingPosterDB](https://ratingposterdb.com) key in the input field to show IMDb ratings on posters.
4.  Click the "Install addon" button.
5.  The installation link will be generated in a popup. Click "Install in Stremio" or copy the URL manually.
6.  Open Stremio (if it didn't open automatically), paste the link into the Addon search bar if needed, and press Enter to install.

### Manual Installation (All Catalogs)

To install the addon with all catalogs included (without RPDB ratings):

1.  Open Stremio.
2.  Paste the default manifest URL into the Addon search bar: [`https://addon-star-wars.onrender.com/manifest.json`](https://addon-star-wars.onrender.com/manifest.json)
3.  Press Enter to install.

*Note: To install with all catalogs *and* RPDB ratings, visit the configuration page, click "Select All", enter your RPDB key, and then install using the generated link.*

---

## 🛠️ Running Locally

### Prerequisites

*   Node.js and npm installed
*   Git (optional, for cloning)

### Setup

1.  Clone the repository (or download the source):
    ```bash
    git clone https://github.com/tapframe/addon-star-wars.git # Replace with your repo URL
    cd addon-star-wars
```

2.  Install dependencies:
    ```bash
npm install
```

3.  Create a `.env` file in the root directory with your API keys:
    ```dotenv
    TMDB_API_KEY=your_tmdb_api_key_here
    OMDB_API_KEY=your_omdb_api_key_here # Optional, needed for ratings
    PORT=7000 # Optional, defaults to 7000
```

4.  **(Optional) Populate Data Files:** Run the data fetching scripts. This requires the TMDB API key in your `.env` file.
    ```bash
    node scripts/fetchSkywalkerSagaData.js
    node scripts/fetchAnthologyFilmsData.js
    node scripts/fetchLiveActionSeriesData.js
    # ... run all other fetch*.js scripts in the scripts/ directory ...
    node scripts/fetchDroidsCreaturesData.js
    node scripts/fetchMoviesSeriesChronologicalData.js
    node scripts/fetchMoviesSeriesReleaseData.js
    ```
    *Alternatively, run the combined command (PowerShell example):*
    ```powershell
    node scripts/fetchSkywalkerSagaData.js; node scripts/fetchAnthologyFilmsData.js; node scripts/fetchLiveActionSeriesData.js; node scripts/fetchAnimatedSeriesData.js; node scripts/fetchMicroSeriesShortsData.js; node scripts/fetchHighRepublicEraData.js; node scripts/fetchEmpireEraData.js; node scripts/fetchNewRepublicEraData.js; node scripts/fetchBountyHuntersData.js; node scripts/fetchJediSithLoreData.js; node scripts/fetchDroidsCreaturesData.js; node scripts/fetchMoviesSeriesChronologicalData.js; node scripts/fetchMoviesSeriesReleaseData.js
    ```

5.  Start the server:
    ```bash
npm run start:server
```

6.  The addon server will be running.
    *   Configuration Page: `http://localhost:7000/configure`
    *   Default Manifest: `http://localhost:7000/manifest.json`

---

## 📚 Available Catalogs

The following catalogs can be selected via the configuration page:

*   **sw-movies-series-chronological**: Movies & Series Chronological Order
*   **sw-movies-series-release**: Movies & Series Release Order
*   **sw-skywalker-saga**: Skywalker Saga (Episodes I-IX)
*   **sw-anthology-films**: Anthology Films (Rogue One, Solo)
*   **sw-live-action-series**: Live-Action Series (Mandalorian, Andor, etc.)
*   **sw-animated-series**: Animated Series (Clone Wars, Rebels, etc.)
*   **sw-micro-series-shorts**: Micro-Series & Shorts (Forces of Destiny, Blips, etc.)
*   **sw-high-republic-era**: High Republic Era Content (Acolyte, Young Jedi Adventures)
*   **sw-empire-era**: Empire Era Content (Andor, Rebels, Obi-Wan, Bad Batch)
*   **sw-new-republic-era**: New Republic Era Content (Mandalorian, Ahsoka, etc.)
*   **sw-bounty-hunters-underworld**: Bounty Hunters & Underworld Theme
*   **sw-jedi-sith-lore**: Jedi & Sith Lore Theme
*   **sw-droids-creatures**: Droids & Creatures Theme

---

## 💻 Development

This addon uses:

*   Node.js
*   Express.js for the server and routing.
*   Axios for making requests to external APIs.
*   The Movie Database (TMDb) API for primary metadata.
*   OMDb API for supplementary ratings (optional).
*   Local data files in `Data/` populated by scripts in `scripts/`.

---

## 📄 License

This project is under the MIT License. (Or update if different)

---

##  Acknowledgements

This addon is a modified fork of the original Marvel addon created by **joaogonp**. Many thanks for the initial work!

---

## ☕ Support

If you find this addon useful, you can support its development:

[Buy Me a Coffee🍺](https://buymeacoffee.com/tapframe)

---

## 📬 Feedback

Issues, suggestions, or questions? Please open an issue on the repository.
