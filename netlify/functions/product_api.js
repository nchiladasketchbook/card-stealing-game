// netlify/functions/product-api.js
const { createClient }

exports.handler = async (event, context) => { = require('@supabase/supabase-js');

// Initialize Supabase client with better error handling
let supabase;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  console.log('Initializing Supabase with:', {
    url: supabaseUrl ? 'SET' : 'MISSING',
    key: supabaseKey ? 'SET' : 'MISSING'
  });
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Available features for the product building game
const AVAILABLE_FEATURES = [
  'Premium Materials', 'Wireless Connectivity', 'Voice Control', 'Mobile App',
  'Energy Efficient', 'Compact Design', 'Touch Screen', 'Auto Updates',
  'Cloud Storage', 'AI Assistant', '24/7 Support', 'Warranty Plus',
  'Fast Charging', 'Water Resistant', 'Customizable', 'Smart Integration',
  'Eco Friendly', 'Professional Grade', 'User Friendly', 'Advanced Security'
];

// Bot names
const BOT_NAMES = [
  'TechGuru_AI', 'MarketMaven', 'ProductPro', 'InnoBot', 'DesignWiz',
  'FeatureFinder', 'BuildMaster', 'TrendSpotter', 'UserVoice', 'QualityBot'
];

// Admin password (in production, this should be in environment variables)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function generateGameId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generatePlayerId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 15);
}

function generateProductOptions() {
  const options = [];
  const shuffledFeatures = [...AVAILABLE_FEATURES].sort(() => 0.5 - Math.random());
  
  for (let i = 0; i < 3; i++) {
    const features = [];
    for (let j = 0; j < 5; j++) {
      features.push(shuffledFeatures[i * 5 + j]);
    }
    options.push({
      id: i,
      name: `Product ${String.fromCharCode(65 + i)}`,
      features: features
    });
  }
  return options;
}

function createBot(usedNames) {
  const availableNames = BOT_NAMES.filter(name => !usedNames.includes(name));
  const botName = availableNames.length > 0 ? 
    availableNames[Math.floor(Math.random() * availableNames.length)] : 
    `Bot_${Math.floor(Math.random() * 1000)}`;
  
  return {
    id: generatePlayerId(),
    name: botName,
    is_bot: true,
    score: 0,
    board: [],
    conjoint_choice: null,
    panel_id: null
  };
}

// Calculate scores based on historical feature performance across all games
async function calculateHistoricalScores(players, currentFeatureStats, currentGameId) {
  try {
    // Get all completed games to calculate historical averages
    const { data: allGames, error } = await supabase
      .from('product_games')
      .select('*')
      .eq('stage', 'completed')
      .neq('id', currentGameId); // Exclude current game from history
    
    if (error) {
      console.error('Error fetching historical games:', error);
      // Fallback to current game scoring if historical data unavailable
      return players.map(player => ({ ...player, score: 0 }));
    }
    
    console.log(`Found ${allGames?.length || 0} historical games for scoring`);
    
    // Calculate historical averages for each feature
    const featureHistoricalScores = {};
    const featureUsageCounts = {};
    
    // Initialize counters
    AVAILABLE_FEATURES.forEach(feature => {
      featureHistoricalScores[feature] = 0;
      featureUsageCounts[feature] = 0;
    });
    
    // Process historical games
    if (allGames && allGames.length > 0) {
      allGames.forEach(game => {
        if (game.feature_stats) {
          Object.keys(game.feature_stats).forEach(feature => {
            const stats = game.feature_stats[feature];
            if (stats && (stats.build_selections > 0 || stats.conjoint_selections > 0)) {
              // Score includes both building and conjoint for historical data
              const gameScore = (stats.build_selections * 5) + (stats.conjoint_selections * 3);
              featureHistoricalScores[feature] += gameScore;
              featureUsageCounts[feature]++;
            }
          });
        }
      });
    }
    
    // For the very first game, include conjoint scores in the current game
    const isFirstGame = !allGames || allGames.length === 0;
    if (isFirstGame) {
      console.log('First game detected - including conjoint scores');
      Object.keys(currentFeatureStats).forEach(feature => {
        const stats = currentFeatureStats[feature];
        if (stats) {
          // Include conjoint scores for the first game only
          const currentGameScore = (stats.build_selections * 5) + (stats.conjoint_selections * 3);
          featureHistoricalScores[feature] += currentGameScore;
          featureUsageCounts[feature]++;
        }
      });
    } else {
      // For subsequent games, only add building scores from current game
      Object.keys(currentFeatureStats).forEach(feature => {
        const stats = currentFeatureStats[feature];
        if (stats && stats.build_selections > 0) {
          const currentGameScore = stats.build_selections * 5;
          featureHistoricalScores[feature] += currentGameScore;
          featureUsageCounts[feature]++;
        }
      });
    }
    
    // Calculate average scores per feature
    const featureAverageScores = {};
    Object.keys(featureHistoricalScores).forEach(feature => {
      if (featureUsageCounts[feature] > 0) {
        featureAverageScores[feature] = featureHistoricalScores[feature] / featureUsageCounts[feature];
      } else {
        featureAverageScores[feature] = 0;
      }
    });
    
    console.log('Feature average scores calculated:', featureAverageScores);
    
    // Calculate player scores based on their selected features' average performance
    const scoredPlayers = players.map(player => {
      let score = 0;
      
      if (player.board && player.board.length > 0) {
        player.board.forEach(feature => {
          if (featureAverageScores[feature] !== undefined) {
            score += featureAverageScores[feature];
          }
        });
      }
      
      // Round to 2 decimal places
      score = Math.round(score * 100) / 100;
      
      return { ...player, score };
    });
    
    console.log('Player scores calculated:', scoredPlayers.map(p => ({ name: p.name, score: p.score })));
    
    return scoredPlayers;
    
  } catch (error) {
    console.error('Error calculating historical scores:', error);
    // Fallback scoring
    return players.map(player => ({ ...player, score: 0 }));
  }
}
  console.log('Function invoked:', {
    path: event.path,
    method: event.httpMethod
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: '' 
    };
  }
  
  // Validate Supabase
  if (!supabase) {
    console.error('Supabase not initialized');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Database connection failed',
        details: 'Supabase client not initialized - check environment variables'
      })
    };
  }

  const path = event.path.replace('/.netlify/functions/product-api', '');
  const method = event.httpMethod;
  let body = {};
  
  try {
    if (event.body) {
      body = JSON.parse(event.body);
    }
  } catch (e) {
    console.error('Failed to parse request body:', e);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    };
  }
  
  const query = event.queryStringParameters || {};

  console.log('Processing request:', { path, method });

  try {
    // Route handling
    switch (path) {
      case '/game/join':
        return await joinGame(body);
      
      case '/game/status':
        return await getGameStatus(query.gameId);
      
      case '/game/progress':
        return await progressGame(body);
      
      case '/game/conjoint':
        return await submitConjointChoice(body);
      
      case '/game/build':
        return await handleBuildAction(body);
      
      case '/game/cursor':
        return await updateCursor(body);
      
      case '/admin/login':
        return await adminLogin(body);
      
      case '/admin/features':
        return await handleAdminFeatures(method, body, event.headers);
      
      case '/admin/download':
        return await downloadGameData(event.headers);
      
      case '/admin/feature-scores':
        return await downloadFeatureScores(event.headers);
      
      default:
        console.log('Route not found:', path);
        return { 
          statusCode: 404, 
          headers, 
          body: JSON.stringify({ error: 'Route not found', path: path }) 
        };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

// Admin functions
async function adminLogin(body) {
  try {
    const { password } = body;
    
    if (password === ADMIN_PASSWORD) {
      // In production, use proper JWT tokens
      const token = 'admin_' + Date.now();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ token })
      };
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid password' })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Login failed' })
    };
  }
}

async function handleAdminFeatures(method, body, requestHeaders) {
  // Simple auth check
  const authHeader = requestHeaders.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer admin_')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  if (method === 'GET') {
    // Return current features
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(AVAILABLE_FEATURES.map((feature, index) => ({
        id: index,
        name: feature,
        category: getFeatureCategory(feature)
      })))
    };
  }
  
  // For POST/PUT/DELETE, you could implement feature management
  // For now, return the current features as read-only
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Feature management coming soon' })
  };
}

function getFeatureCategory(feature) {
  const categories = {
    'Premium Materials': 'Design',
    'Wireless Connectivity': 'Technology',
    'Voice Control': 'Technology',
    'Mobile App': 'Technology',
    'Energy Efficient': 'Performance',
    'Compact Design': 'Design',
    'Touch Screen': 'Technology',
    'Auto Updates': 'Technology',
    'Cloud Storage': 'Technology',
    'AI Assistant': 'Technology',
    '24/7 Support': 'Support',
    'Warranty Plus': 'Support',
    'Fast Charging': 'Performance',
    'Water Resistant': 'Design',
    'Customizable': 'Design',
    'Smart Integration': 'Technology',
    'Eco Friendly': 'Sustainability',
    'Professional Grade': 'Performance',
    'User Friendly': 'Design',
    'Advanced Security': 'Technology'
  };
  return categories[feature] || 'Other';
}

async function downloadGameData(requestHeaders) {
  // Simple auth check
  const authHeader = requestHeaders.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer admin_')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  try {
    const { data: games, error } = await supabase
      .from('product_games')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Generate CSV
    let csv = 'Game ID,Player Name,Is Bot,Panel ID,Score,Features,Conjoint Choice,Game Stage,Created At\n';
    
    games.forEach(game => {
      if (game.players) {
        game.players.forEach(player => {
          const features = player.board ? player.board.join(';') : '';
          csv += `"${game.id}","${player.name}","${player.is_bot}","${player.panel_id || ''}","${player.score || 0}","${features}","${player.conjoint_choice || ''}","${game.stage}","${game.created_at}"\n`;
        });
      }
    });
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="product_builder_data.csv"'
      },
      body: csv
    };
  } catch (error) {
    console.error('Error downloading game data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to download data' })
    };
  }
}

async function downloadFeatureScores(requestHeaders) {
  // Simple auth check
  const authHeader = requestHeaders.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer admin_')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  try {
    const { data: games, error } = await supabase
      .from('product_games')
      .select('*')
      .eq('stage', 'completed')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Calculate historical feature averages
    const featureHistoricalScores = {};
    const featureUsageCounts = {};
    
    // Initialize counters
    AVAILABLE_FEATURES.forEach(feature => {
      featureHistoricalScores[feature] = 0;
      featureUsageCounts[feature] = 0;
    });
    
    // Process all games to build historical averages
    games.forEach((game, gameIndex) => {
      const isFirstGame = gameIndex === games.length - 1; // Last in descending order = first chronologically
      
      if (game.feature_stats) {
        Object.keys(game.feature_stats).forEach(feature => {
          const stats = game.feature_stats[feature];
          if (stats && (stats.build_selections > 0 || stats.conjoint_selections > 0)) {
            let gameScore;
            if (isFirstGame) {
              // Include conjoint scores for the very first game
              gameScore = (stats.build_selections * 5) + (stats.conjoint_selections * 3);
            } else {
              // Only building scores for subsequent games
              gameScore = stats.build_selections * 5;
            }
            
            featureHistoricalScores[feature] += gameScore;
            featureUsageCounts[feature]++;
          }
        });
      }
    });
    
    // Calculate average scores
    const featureAverageScores = {};
    Object.keys(featureHistoricalScores).forEach(feature => {
      if (featureUsageCounts[feature] > 0) {
        featureAverageScores[feature] = Math.round((featureHistoricalScores[feature] / featureUsageCounts[feature]) * 100) / 100;
      } else {
        featureAverageScores[feature] = 0;
      }
    });
    
    // Generate feature scores CSV with historical averages
    let csv = 'Game ID,Player Name,Panel ID,Feature,Feature Historical Average,Player Total Score,Game Date\n';
    
    games.forEach(game => {
      if (game.players && game.feature_stats) {
        const realPlayers = game.players.filter(p => !p.is_bot);
        
        realPlayers.forEach(player => {
          if (player.board && player.board.length > 0) {
            player.board.forEach(feature => {
              const featureAverage = featureAverageScores[feature] || 0;
              
              csv += `"${game.id}","${player.name}","${player.panel_id || ''}","${feature}","${featureAverage}","${player.score || 0}","${game.created_at}"\n`;
            });
          }
        });
      }
    });
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="feature_historical_scores.csv"'
      },
      body: csv
    };
  } catch (error) {
    console.error('Error downloading feature scores:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to download feature scores' })
    };
  }
}

// Game functions
async function joinGame(body) {
  try {
    const { playerName, panelId } = body;
    
    console.log('Join game request:', { playerName, panelId });
    
    if (!playerName || playerName.trim() === '') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Player name is required' })
      };
    }
    
    // Test Supabase connection first
    const { data: testData, error: testError } = await supabase
      .from('product_games')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('Supabase connection test failed:', testError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Database connection failed',
          details: testError.message
        })
      };
    }
    
    console.log('Supabase connection test successful');
    
    // Check for existing lobby games
    const { data: existingGames, error: searchError } = await supabase
      .from('product_games')
      .select('*')
      .eq('stage', 'lobby')
      .gte('created_at', new Date(Date.now() - 30000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (searchError) {
      console.error('Error searching for existing games:', searchError);
      throw searchError;
    }
    
    console.log('Found existing games:', existingGames?.length || 0);
    
    // Try to join an existing game
    if (existingGames && existingGames.length > 0) {
      for (const game of existingGames) {
        const players = game.players || [];
        const realPlayers = players.filter(p => !p.is_bot);
        
        if (realPlayers.length < 4) {
          const newPlayer = {
            id: generatePlayerId(),
            name: playerName.trim(),
            panel_id: panelId || null,
            is_bot: false,
            score: 0,
            board: [],
            conjoint_choice: null
          };
          
          players.push(newPlayer);
          
          const { error: updateError } = await supabase
            .from('product_games')
            .update({ players })
            .eq('id', game.id);
          
          if (updateError) {
            console.error('Error updating existing game:', updateError);
            continue; // Try next game
          }
          
          console.log('Player added to existing game:', game.id);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              gameId: game.id, 
              playerId: newPlayer.id
            })
          };
        }
      }
    }
    
    // Create new game
    const gameId = generateGameId();
    const player = {
      id: generatePlayerId(),
      name: playerName.trim(),
      panel_id: panelId || null,
      is_bot: false,
      score: 0,
      board: [],
      conjoint_choice: null
    };
    
    const productOptions = generateProductOptions();
    const featureStats = {};
    AVAILABLE_FEATURES.forEach(feature => {
      featureStats[feature] = { conjoint_selections: 0, build_selections: 0 };
    });
    
    console.log('Creating new game:', gameId);
    
    const gameData = {
      id: gameId,
      stage: 'lobby',
      players: [player],
      product_options: productOptions,
      available_features: [...AVAILABLE_FEATURES],
      feature_stats: featureStats,
      lobby_timer: 20,
      round_timer: 30,
      created_at: new Date().toISOString()
    };
    
    const { data: insertedGame, error: insertError } = await supabase
      .from('product_games')
      .insert([gameData])
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating new game:', insertError);
      throw insertError;
    }
    
    console.log('New game created successfully:', insertedGame.id);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        gameId: gameId, 
        playerId: player.id
      })
    };
    
  } catch (error) {
    console.error('Error in joinGame:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to join game',
        message: error.message,
        details: error.details || error.hint || 'Unknown database error'
      })
    };
  }
}

async function getGameStatus(gameId) {
  try {
    if (!gameId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Game ID required' })
      };
    }
    
    console.log('Getting game status for:', gameId);
    
    const { data: game, error } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (error) {
      console.error('Error getting game status:', error);
      if (error.code === 'PGRST116') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Game not found' })
        };
      }
      throw error;
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(game)
    };
  } catch (error) {
    console.error('Error in getGameStatus:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to get game status',
        message: error.message
      })
    };
  }
}

async function progressGame(body) {
  try {
    const { gameId } = body;
    
    if (!gameId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Game ID required' })
      };
    }
    
    console.log('Progressing game:', gameId);
    
    const { data: game, error: gameError } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      console.error('Error getting game for progress:', gameError);
      throw gameError;
    }
    
    const currentTime = Date.now();
    const gameStartTime = new Date(game.created_at).getTime();
    const timeSinceStart = Math.floor((currentTime - gameStartTime) / 1000);
    
    let updatedFields = {};
    let shouldUpdate = false;
    
    if (game.stage === 'lobby') {
      const newLobbyTimer = Math.max(0, 20 - timeSinceStart);
      
      if (newLobbyTimer !== game.lobby_timer) {
        updatedFields.lobby_timer = newLobbyTimer;
        shouldUpdate = true;
      }
      
      // If timer reached 0, advance to conjoint stage
      if (newLobbyTimer <= 0) {
        console.log('Lobby timer expired, advancing to conjoint stage');
        
        // Add bots to fill the game
        const players = [...(game.players || [])];
        const usedNames = players.map(p => p.name);
        
        while (players.length < 4) {
          const bot = createBot(usedNames);
          players.push(bot);
          usedNames.push(bot.name);
        }
        
        console.log('Added bots to game:', players.map(p => ({ name: p.name, isBot: p.is_bot })));
        
        updatedFields = {
          stage: 'conjoint',
          players: players,
          round_timer: 10,
          lobby_timer: 0,
          conjoint_start_time: new Date().toISOString()
        };
        shouldUpdate = true;
      }
    } else if (game.stage === 'conjoint') {
      const conjointStartTime = game.conjoint_start_time ? 
        new Date(game.conjoint_start_time).getTime() : 
        gameStartTime;
      const timeSinceConjoint = Math.floor((currentTime - conjointStartTime) / 1000);
      const newRoundTimer = Math.max(0, 10 - timeSinceConjoint);
      
      if (newRoundTimer !== game.round_timer) {
        updatedFields.round_timer = newRoundTimer;
        shouldUpdate = true;
      }
      
      // Make bots choose after 5 seconds in conjoint stage
      if (timeSinceConjoint >= 5) {
        const players = [...game.players];
        const featureStats = { ...game.feature_stats };
        let botsMadeChoices = false;
        
        players.forEach(player => {
          if (player.is_bot && player.conjoint_choice === null) {
            const choice = Math.floor(Math.random() * 3);
            player.conjoint_choice = choice;
            botsMadeChoices = true;
            
            // Update feature stats for bot choices
            const chosenProduct = game.product_options[choice];
            if (chosenProduct && chosenProduct.features) {
              chosenProduct.features.forEach(feature => {
                if (featureStats[feature]) {
                  featureStats[feature].conjoint_selections++;
                }
              });
            }
          }
        });
        
        if (botsMadeChoices) {
          console.log('Bots made conjoint choices');
          updatedFields.players = players;
          updatedFields.feature_stats = featureStats;
          shouldUpdate = true;
        }
      }
      
      // If timer reached 0, advance to building stage
      if (newRoundTimer <= 0) {
        console.log('Conjoint timer expired, advancing to building stage');
        
        // Ensure all bots have made choices before advancing
        const players = game.players.map(player => {
          if (player.is_bot && player.conjoint_choice === null) {
            player.conjoint_choice = Math.floor(Math.random() * 3);
          }
          return {
            ...player,
            board: []
          };
        });
        
        updatedFields = {
          stage: 'building',
          players: players,
          round_timer: 60,
          building_start_time: new Date().toISOString()
        };
        shouldUpdate = true;
      }
    } else if (game.stage === 'building') {
      const buildingStartTime = game.building_start_time ? 
        new Date(game.building_start_time).getTime() : 
        gameStartTime;
      const timeSinceBuilding = Math.floor((currentTime - buildingStartTime) / 1000);
      const newRoundTimer = Math.max(0, 60 - timeSinceBuilding);
      
      if (newRoundTimer !== game.round_timer) {
        updatedFields.round_timer = newRoundTimer;
        shouldUpdate = true;
      }
      
      // UPDATED BOT BEHAVIOR: Make bots build features and move cursors, but steal much less frequently
      if (timeSinceBuilding >= 5 && timeSinceBuilding % 5 === 0) { // Changed from every 4 seconds to every 5
        const players = [...game.players];
        const availableFeatures = [...game.available_features];
        const featureStats = { ...game.feature_stats };
        let botsActed = false;
        
        players.forEach(player => {
          if (player.is_bot) {
            // Update bot cursor position to simulate movement
            player.cursor = {
              x: Math.floor(Math.random() * 800) + 200,
              y: Math.floor(Math.random() * 400) + 300,
              lastUpdate: new Date().toISOString(),
              action: null
            };
            
            if (player.board.length < 4) {
              // CHANGED: 50% chance bot takes action this cycle (down from 60%)
              if (Math.random() < 0.5) {
                // CHANGED: 98% chance to take from pool, only 2% chance to steal (was 95/5)
                if (Math.random() < 0.98 && availableFeatures.length > 0) {
                  // Take from pool
                  const featureIndex = Math.floor(Math.random() * availableFeatures.length);
                  const feature = availableFeatures.splice(featureIndex, 1)[0];
                  player.board.push(feature);
                  
                  // Set cursor action for visual feedback
                  player.cursor.action = {
                    type: 'take',
                    feature: feature,
                    timestamp: new Date().toISOString()
                  };
                  
                  if (featureStats[feature]) {
                    featureStats[feature].build_selections++;
                  }
                  botsActed = true;
                  console.log(`Bot ${player.name} took ${feature} from pool`);
                } else {
                  // Try to steal (very rare now)
                  const playersWithFeatures = players.filter(p => p.id !== player.id && p.board.length > 0);
                  if (playersWithFeatures.length > 0) {
                    const targetPlayer = playersWithFeatures[Math.floor(Math.random() * playersWithFeatures.length)];
                    const featureIndex = Math.floor(Math.random() * targetPlayer.board.length);
                    const stolenFeature = targetPlayer.board.splice(featureIndex, 1)[0];
                    player.board.push(stolenFeature);
                    
                    // Set cursor action for visual feedback
                    player.cursor.action = {
                      type: 'steal',
                      feature: stolenFeature,
                      target: targetPlayer.name,
                      timestamp: new Date().toISOString()
                    };
                    
                    if (featureStats[stolenFeature]) {
                      featureStats[stolenFeature].build_selections++;
                    }
                    botsActed = true;
                    console.log(`Bot ${player.name} stole ${stolenFeature} from ${targetPlayer.name}`);
                  }
                }
              }
            }
          }
        });
        
        if (botsActed) {
          updatedFields.players = players;
          updatedFields.available_features = availableFeatures;
          updatedFields.feature_stats = featureStats;
          shouldUpdate = true;
        }
      }
      
      // If timer reached 0, end game
      if (newRoundTimer <= 0) {
        console.log('Building timer expired, ending game');
        
        // Calculate final scores - UPDATED SCORING: Based on historical feature performance
        const players = await calculateHistoricalScores(game.players, game.feature_stats, gameId);
        
        updatedFields = {
          stage: 'completed',
          players: players,
          completed_at: new Date().toISOString(),
          round_timer: 0
        };
        shouldUpdate = true;
      }
    }
    
    if (shouldUpdate) {
      console.log('Updating game with fields:', Object.keys(updatedFields));
      
      const { error: updateError } = await supabase
        .from('product_games')
        .update(updatedFields)
        .eq('id', gameId);
      
      if (updateError) {
        console.error('Error updating game progress:', updateError);
        throw updateError;
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error in progressGame:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to progress game',
        message: error.message
      })
    };
  }
}

async function submitConjointChoice(body) {
  try {
    const { gameId, playerId, choice } = body;
    
    console.log('Conjoint choice submission:', { gameId, playerId, choice });
    
    const { data: game, error: gameError } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError) throw gameError;
    
    const players = game.players.map(player => {
      if (player.id === playerId) {
        player.conjoint_choice = choice;
      }
      return player;
    });
    
    // Update feature stats
    const featureStats = { ...game.feature_stats };
    const chosenProduct = game.product_options[choice];
    if (chosenProduct) {
      chosenProduct.features.forEach(feature => {
        if (featureStats[feature]) {
          featureStats[feature].conjoint_selections++;
        }
      });
    }
    
    const { error } = await supabase
      .from('product_games')
      .update({ 
        players,
        feature_stats: featureStats
      })
      .eq('id', gameId);
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error in submitConjointChoice:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to submit choice',
        message: error.message
      })
    };
  }
}

async function handleBuildAction(body) {
  try {
    const { gameId, playerId, action, feature, sourcePlayerId, slotIndex } = body;
    
    console.log('Build action:', { gameId, playerId, action, feature });
    
    const { data: game, error: gameError } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError) throw gameError;
    
    const players = [...game.players];
    const availableFeatures = [...game.available_features];
    const featureStats = { ...game.feature_stats };
    
    // Find player
    const playerIndex = players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Player not found' })
      };
    }
    
    const player = players[playerIndex];
    
    // Track when real players make actions to prevent bot conflicts
    if (!player.is_bot) {
      player.last_action_time = new Date().toISOString();
    }
    
    if (action === 'add') {
      // Add feature from pool
      const featureIndex = availableFeatures.indexOf(feature);
      if (featureIndex !== -1 && player.board.length < 4) {
        availableFeatures.splice(featureIndex, 1);
        
        if (slotIndex !== null && slotIndex < 4) {
          player.board[slotIndex] = feature;
        } else {
          player.board.push(feature);
        }
        
        // Update stats
        if (featureStats[feature]) {
          featureStats[feature].build_selections++;
        }
      }
    } else if (action === 'remove') {
      // NEW: Remove feature from player's board and return to pool
      const featureIndex = player.board.indexOf(feature);
      if (featureIndex !== -1) {
        player.board.splice(featureIndex, 1);
        availableFeatures.push(feature);
        
        // Update stats (decrease count)
        if (featureStats[feature] && featureStats[feature].build_selections > 0) {
          featureStats[feature].build_selections--;
        }
        
        console.log(`Player ${player.name} removed ${feature} from their board`);
      }
    } else if (action === 'steal') {
      // Steal feature from another player
      const sourcePlayerIndex = players.findIndex(p => p.id === sourcePlayerId);
      if (sourcePlayerIndex !== -1) {
        const sourcePlayer = players[sourcePlayerIndex];
        const featureIndex = sourcePlayer.board.indexOf(feature);
        if (featureIndex !== -1 && player.board.length < 4) {
          sourcePlayer.board.splice(featureIndex, 1);
          
          if (slotIndex !== null && slotIndex < 4) {
            player.board[slotIndex] = feature;
          } else {
            player.board.push(feature);
          }
          
          // Update stats
          if (featureStats[feature]) {
            featureStats[feature].build_selections++;
          }
        }
      }
    }
      // Steal feature from another player
      const sourcePlayerIndex = players.findIndex(p => p.id === sourcePlayerId);
      if (sourcePlayerIndex !== -1) {
        const sourcePlayer = players[sourcePlayerIndex];
        const featureIndex = sourcePlayer.board.indexOf(feature);
        if (featureIndex !== -1 && player.board.length < 4) {
          sourcePlayer.board.splice(featureIndex, 1);
          
          if (slotIndex !== null && slotIndex < 4) {
            player.board[slotIndex] = feature;
          } else {
            player.board.push(feature);
          }
          
          // Update stats
          if (featureStats[feature]) {
            featureStats[feature].build_selections++;
          }
        }
      }
    }
    
    const { error } = await supabase
      .from('product_games')
      .update({
        players,
        available_features: availableFeatures,
        feature_stats: featureStats
      })
      .eq('id', gameId);
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error in handleBuildAction:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to handle build action',
        message: error.message
      })
    };
  }
}

async function updateCursor(body) {
  try {
    const { gameId, playerId, x, y } = body;
    
    if (!gameId || !playerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing gameId or playerId' })
      };
    }
    
    const { data: game, error: gameError } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError) throw gameError;
    
    // Update player cursor position
    const players = game.players.map(player => {
      if (player.id === playerId) {
        player.cursor = { x, y, lastUpdate: new Date().toISOString() };
      }
      return player;
    });
    
    const { error } = await supabase
      .from('product_games')
      .update({ players })
      .eq('id', gameId);
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error in updateCursor:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to update cursor',
        message: error.message
      })
    };
  }
}
        