// netlify/functions/product-api.js
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with better error handling
let supabase;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables:', {
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_ANON_KEY: !!supabaseKey
    });
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
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

function generateGameId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generatePlayerId() {
  return Date.now() + Math.random().toString(36).substring(2, 15);
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
  const botName = availableNames[Math.floor(Math.random() * availableNames.length)];
  
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

// Enhanced error handling function
function handleError(error, context = '') {
  console.error(`Error in ${context}:`, error);
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ 
      error: 'Internal server error',
      context: context,
      message: error.message
    })
  };
}

// Validate Supabase connection
function validateSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Check environment variables.');
  }
}

exports.handler = async (event, context) => {
  console.log('Function invoked:', {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers,
    env: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
      ADMIN_TOKEN: !!process.env.ADMIN_TOKEN
    }
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: '' 
    };
  }

  const path = event.path.replace('/.netlify/functions/product-api', '');
  const method = event.httpMethod;
  let body = {};
  
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    console.error('Failed to parse request body:', e);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    };
  }
  
  const query = event.queryStringParameters || {};

  try {
    // Validate Supabase for all routes except admin login
    if (path !== '/admin/login') {
      validateSupabase();
    }

    // Admin authentication for admin routes
    if (path.startsWith('/admin') && path !== '/admin/login') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { 
          statusCode: 401, 
          headers, 
          body: JSON.stringify({ error: 'Unauthorized - Missing token' }) 
        };
      }
      
      const token = authHeader.split(' ')[1];
      if (token !== process.env.ADMIN_TOKEN) {
        return { 
          statusCode: 401, 
          headers, 
          body: JSON.stringify({ error: 'Unauthorized - Invalid token' }) 
        };
      }
    }

    // Route handling
    switch (path) {
      case '/admin/login':
        return handleAdminLogin(body);
      
      case '/admin/features':
        if (method === 'GET') return getFeatures();
        if (method === 'POST') return createFeature(body);
        if (method === 'PUT') return updateFeature(body);
        if (method === 'DELETE') return deleteFeature(query.id);
        break;
      
      case '/admin/download':
        return downloadGameData();
      
      case '/game/join':
        return joinGame(body);
      
      case '/game/status':
        return getGameStatus(query.gameId);
      
      case '/game/conjoint':
        return submitConjointChoice(body);
      
      case '/game/build':
        return handleBuildAction(body);
      
      default:
        return { 
          statusCode: 404, 
          headers, 
          body: JSON.stringify({ error: 'Route not found', path: path }) 
        };
    }
  } catch (error) {
    return handleError(error, `Route: ${path}`);
  }
};

// Admin functions
async function handleAdminLogin(body) {
  try {
    const { password } = body;
    if (password === process.env.ADMIN_PASSWORD) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          token: process.env.ADMIN_TOKEN 
        })
      };
    }
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid password' })
    };
  } catch (error) {
    return handleError(error, 'Admin login');
  }
}

async function getFeatures() {
  try {
    const { data, error } = await supabase
      .from('product_features')
      .select('*')
      .order('id');
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return handleError(error, 'Get features');
  }
}

async function createFeature(body) {
  try {
    const { name, category } = body;
    
    const { data, error } = await supabase
      .from('product_features')
      .insert([{ name, category }])
      .select();
    
    if (error) throw error;
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(data[0])
    };
  } catch (error) {
    return handleError(error, 'Create feature');
  }
}

async function updateFeature(body) {
  try {
    const { id, name, category } = body;
    
    const { data, error } = await supabase
      .from('product_features')
      .update({ name, category })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data[0])
    };
  } catch (error) {
    return handleError(error, 'Update feature');
  }
}

async function deleteFeature(id) {
  try {
    const { error } = await supabase
      .from('product_features')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return handleError(error, 'Delete feature');
  }
}

async function downloadGameData() {
  try {
    const { data: games, error } = await supabase
      .from('product_games')
      .select('*')
      .eq('stage', 'completed')
      .order('completed_at', { ascending: false });
    
    if (error) throw error;
    
    const csvData = [];
    
    games.forEach(game => {
      if (game.players) {
        const realPlayers = game.players.filter(player => !player.is_bot);
        
        realPlayers.forEach(player => {
          // Conjoint choice data
          if (player.conjoint_choice !== null && game.product_options) {
            const chosenProduct = game.product_options[player.conjoint_choice];
            if (chosenProduct) {
              chosenProduct.features.forEach(feature => {
                csvData.push({
                  game_id: game.id,
                  player_id: player.id,
                  player_name: player.name,
                  panel_id: player.panel_id || '',
                  stage: 'conjoint',
                  feature: feature,
                  action: 'selected',
                  product_name: chosenProduct.name,
                  final_score: player.score || 0,
                  game_completed_at: game.completed_at
                });
              });
            }
          }
          
          // Building stage data
          if (player.board && player.board.length > 0) {
            player.board.forEach(feature => {
              csvData.push({
                game_id: game.id,
                player_id: player.id,
                player_name: player.name,
                panel_id: player.panel_id || '',
                stage: 'building',
                feature: feature,
                action: 'built',
                product_name: '',
                final_score: player.score || 0,
                game_completed_at: game.completed_at
              });
            });
          }
        });
      }
    });
    
    if (csvData.length === 0) {
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="product_builder_data_empty.csv"'
        },
        body: 'No data available'
      };
    }
    
    const csvHeaders = Object.keys(csvData[0]).join(',');
    const csvRows = csvData.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    );
    
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="product_builder_data.csv"'
      },
      body: csvContent
    };
  } catch (error) {
    return handleError(error, 'Download game data');
  }
}

// Game functions
async function joinGame(body) {
  try {
    const { playerName, panelId } = body;
    
    console.log('Join game request:', { playerName, panelId });
    
    // Check for existing lobby
    let { data: existingGame } = await supabase
      .from('product_games')
      .select('*')
      .eq('stage', 'lobby')
      .gte('created_at', new Date(Date.now() - 25000).toISOString())
      .limit(1);
    
    console.log('Existing games found:', existingGame?.length || 0);
    
    if (existingGame && existingGame.length > 0) {
      const game = existingGame[0];
      const players = game.players || [];
      
      if (players.filter(p => !p.is_bot).length < 4) {
        const newPlayer = {
          id: generatePlayerId(),
          name: playerName,
          panel_id: panelId,
          is_bot: false,
          score: 0,
          board: [],
          conjoint_choice: null
        };
        
        players.push(newPlayer);
        
        const { error } = await supabase
          .from('product_games')
          .update({ players })
          .eq('id', game.id);
        
        if (error) throw error;
        
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
    
    // Create new game
    const gameId = generateGameId();
    const player = {
      id: generatePlayerId(),
      name: playerName,
      panel_id: panelId,
      is_bot: false,
      score: 0,
      board: [],
      conjoint_choice: null
    };
    
    const productOptions = generateProductOptions();
    
    console.log('Creating new game:', gameId);
    
    const { data, error } = await supabase
      .from('product_games')
      .insert([{
        id: gameId,
        stage: 'lobby',
        players: [player],
        product_options: productOptions,
        available_features: [...AVAILABLE_FEATURES],
        feature_stats: Object.fromEntries(AVAILABLE_FEATURES.map(f => [f, { conjoint_selections: 0, build_selections: 0 }])),
        lobby_timer: 20,
        round_timer: 30,
        created_at: new Date().toISOString()
      }])
      .select();
    
    if (error) throw error;
    
    console.log('New game created successfully');
    
    // Start game progression
    setTimeout(() => fillWithBotsAndStart(gameId), 20000);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        gameId, 
        playerId: player.id
      })
    };
  } catch (error) {
    return handleError(error, 'Join game');
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
    
    const { data: game, error } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (error) {
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
    return handleError(error, 'Get game status');
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
    return handleError(error, 'Submit conjoint choice');
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
    
    if (action === 'add') {
      // Add feature from pool
      const featureIndex = availableFeatures.indexOf(feature);
      if (featureIndex === -1) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Feature not available' })
        };
      }
      
      if (player.board.length >= 4) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Board is full' })
        };
      }
      
      // Remove from available features
      availableFeatures.splice(featureIndex, 1);
      
      // Add to player board
      if (slotIndex !== null && slotIndex < 4) {
        player.board[slotIndex] = feature;
      } else {
        player.board.push(feature);
      }
      
      // Update stats
      if (featureStats[feature]) {
        featureStats[feature].build_selections++;
      }
      
    } else if (action === 'steal') {
      // Steal feature from another player
      const sourcePlayerIndex = players.findIndex(p => p.id === sourcePlayerId);
      if (sourcePlayerIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Source player not found' })
        };
      }
      
      const sourcePlayer = players[sourcePlayerIndex];
      const featureIndex = sourcePlayer.board.indexOf(feature);
      if (featureIndex === -1) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Feature not found on source player board' })
        };
      }
      
      if (player.board.length >= 4) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Board is full' })
        };
      }
      
      // Remove from source player
      sourcePlayer.board.splice(featureIndex, 1);
      
      // Add to current player
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
    return handleError(error, 'Handle build action');
  }
}

// Bot and game progression functions (simplified for space)
async function fillWithBotsAndStart(gameId) {
  try {
    console.log('Filling game with bots:', gameId);
    
    const { data: game, error: gameError } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError || !game || game.stage !== 'lobby') return;
    
    const players = [...(game.players || [])];
    const usedNames = players.map(p => p.name);
    
    // Fill with bots to at least 2 players, max 4
    while (players.length < 4) {
      players.push(createBot(usedNames));
    }
    
    // Start conjoint stage
    const { error } = await supabase
      .from('product_games')
      .update({
        stage: 'conjoint',
        players,
        round_timer: 30
      })
      .eq('id', gameId);
    
    if (error) throw error;
    
    console.log('Game started with bots');
    
    // Auto-progress bots in conjoint stage
    setTimeout(() => processBotConjointChoices(gameId), 5000);
    
    // Auto-advance to building after 30 seconds
    setTimeout(() => startBuildingStage(gameId), 30000);
    
  } catch (error) {
    console.error('Error in fillWithBotsAndStart:', error);
  }
}

async function processBotConjointChoices(gameId) {
  // Implementation for bot conjoint choices...
  console.log('Processing bot conjoint choices for game:', gameId);
}

async function startBuildingStage(gameId) {
  // Implementation for starting building stage...
  console.log('Starting building stage for game:', gameId);
}