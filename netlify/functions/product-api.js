// netlify/functions/product-api.js
const { createClient } = require('@supabase/supabase-js');

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

exports.handler = async (event, context) => {
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
        
        // Don't make bots choose immediately - let them choose in conjoint stage
        updatedFields = {
          stage: 'conjoint',
          players: players,
          round_timer: 30,
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
      const newRoundTimer = Math.max(0, 30 - timeSinceConjoint);
      
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
      
      // If timer reached 0, end game
      if (newRoundTimer <= 0) {
        console.log('Building timer expired, ending game');
        
        // Calculate final scores
        const players = game.players.map(player => {
          let score = 0;
          
          if (player.board) {
            player.board.forEach(feature => {
              if (game.feature_stats[feature]) {
                const stats = game.feature_stats[feature];
                score += (stats.conjoint_selections * 10) + (stats.build_selections * 5);
              }
            });
          }
          
          return { ...player, score };
        });
        
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