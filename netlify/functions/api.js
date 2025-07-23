// netlify/functions/product-api.js
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/product-api', '');
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const query = event.queryStringParameters || {};

  try {
    // Admin authentication for admin routes
    if (path.startsWith('/admin') && path !== '/admin/login') {
      const authHeader = event.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }
      
      const token = authHeader.split(' ')[1];
      if (token !== process.env.ADMIN_TOKEN) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
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
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    }
  } catch (error) {
    console.error('API Error:', error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Internal server error' }) 
    };
  }
};

// Admin functions
async function handleAdminLogin(body) {
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
}

async function getFeatures() {
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
}

async function createFeature(body) {
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
}

async function updateFeature(body) {
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
}

async function deleteFeature(id) {
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
    console.error('Error downloading game data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to download game data' })
    };
  }
}

// Game functions
async function joinGame(body) {
  const { playerName, panelId } = body;
  
  // Check for existing lobby
  let { data: existingGame } = await supabase
    .from('product_games')
    .select('*')
    .eq('stage', 'lobby')
    .gte('created_at', new Date(Date.now() - 25000).toISOString())
    .limit(1);
  
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
}

async function fillWithBotsAndStart(gameId) {
  try {
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
    
    // Auto-progress bots in conjoint stage
    setTimeout(() => processBotConjointChoices(gameId), 5000);
    
    // Auto-advance to building after 30 seconds
    setTimeout(() => startBuildingStage(gameId), 30000);
    
  } catch (error) {
    console.error('Error in fillWithBotsAndStart:', error);
  }
}

async function processBotConjointChoices(gameId) {
  try {
    const { data: game } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (!game || game.stage !== 'conjoint') return;
    
    const players = game.players.map(player => {
      if (player.is_bot && player.conjoint_choice === null) {
        // Bots make random choices with some preference logic
        const choice = Math.floor(Math.random() * 3);
        player.conjoint_choice = choice;
        
        // Update feature stats
        const chosenProduct = game.product_options[choice];
        if (chosenProduct) {
          chosenProduct.features.forEach(feature => {
            if (game.feature_stats[feature]) {
              game.feature_stats[feature].conjoint_selections++;
            }
          });
        }
      }
      return player;
    });
    
    await supabase
      .from('product_games')
      .update({ 
        players,
        feature_stats: game.feature_stats
      })
      .eq('id', gameId);
      
  } catch (error) {
    console.error('Error processing bot conjoint choices:', error);
  }
}

async function startBuildingStage(gameId) {
  try {
    const { data: game } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (!game || game.stage !== 'conjoint') return;
    
    // Reset player boards and start building
    const players = game.players.map(player => ({
      ...player,
      board: []
    }));
    
    await supabase
      .from('product_games')
      .update({
        stage: 'building',
        players,
        round_timer: 60
      })
      .eq('id', gameId);
    
    // Start bot building behavior
    setTimeout(() => processBotBuilding(gameId), 2000);
    
    // End building stage after 60 seconds
    setTimeout(() => endGame(gameId), 60000);
    
  } catch (error) {
    console.error('Error starting building stage:', error);
  }
}

async function processBotBuilding(gameId) {
  try {
    const { data: game } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (!game || game.stage !== 'building') return;
    
    const players = [...game.players];
    const availableFeatures = [...game.available_features];
    const featureStats = { ...game.feature_stats };
    
    // Simulate bot building actions
    players.forEach(player => {
      if (player.is_bot && player.board.length < 4) {
        // Bots add 1-2 features per cycle
        const actionsCount = Math.floor(Math.random() * 2) + 1;
        
        for (let i = 0; i < actionsCount && player.board.length < 4; i++) {
          // 70% chance to take from pool, 30% chance to steal
          if (Math.random() < 0.7 && availableFeatures.length > 0) {
            // Take from pool
            const featureIndex = Math.floor(Math.random() * availableFeatures.length);
            const feature = availableFeatures.splice(featureIndex, 1)[0];
            player.board.push(feature);
            
            if (featureStats[feature]) {
              featureStats[feature].build_selections++;
            }
          } else {
            // Try to steal from other players
            const playersWithFeatures = players.filter(p => p.id !== player.id && p.board.length > 0);
            if (playersWithFeatures.length > 0) {
              const targetPlayer = playersWithFeatures[Math.floor(Math.random() * playersWithFeatures.length)];
              const featureIndex = Math.floor(Math.random() * targetPlayer.board.length);
              const stolenFeature = targetPlayer.board.splice(featureIndex, 1)[0];
              player.board.push(stolenFeature);
              
              if (featureStats[stolenFeature]) {
                featureStats[stolenFeature].build_selections++;
              }
            }
          }
        }
      }
    });
    
    await supabase
      .from('product_games')
      .update({
        players,
        available_features: availableFeatures,
        feature_stats: featureStats
      })
      .eq('id', gameId);
    
    // Continue bot building every 3-5 seconds
    if (game.stage === 'building') {
      setTimeout(() => processBotBuilding(gameId), 3000 + Math.random() * 2000);
    }
    
  } catch (error) {
    console.error('Error processing bot building:', error);
  }
}

async function endGame(gameId) {
  try {
    const { data: game } = await supabase
      .from('product_games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (!game || game.stage !== 'building') return;
    
    // Calculate final scores
    const players = game.players.map(player => {
      let score = 0;
      
      if (player.board) {
        player.board.forEach(feature => {
          if (game.feature_stats[feature]) {