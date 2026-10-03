const NEWS_CONFIG = {
  // Target and limits
  TARGET_ARTICLES: 20,
  CHAR_LIMITS: {
    QUICK_SUMMARY: 130,
    WHY_IT_MATTERS: 800,
    PARAGRAPH_MAX: 500,
    MIN_CONTENT_LENGTH: 200
  },
  
  // API configuration
  API_DELAY: 1000, // 1 second between requests
  MAX_RETRIES: 3,
  
  // Tech sources (high quality publications) - EXPANDED for broader coverage
  TECH_SOURCES: [
    // Major Tech Publications
    'techcrunch', 'the-verge', 'wired', 'ars-technica', 'engadget',
    // General Tech & Business
    'tech-radar', 'the-next-web', 'venture-beat', 'recode', 'fast-company', 'fortune',
    'business-insider', 'bloomberg', 'reuters', 'associated-press', 'cnn-business',
    // AI & Deep Tech
    'mit-technology-review',
    // Additional Tech Sources
    'tech-republic', 'zdnet', 'mashable', 'gizmodo', 'lifehacker', 'digital-trends',
    // Gaming & Consumer Tech  
    'polygon', 'the-game-awards', 'gamespot', 'ign', 'kotaku',
    // Developer & Open Source
    'github-blog', 'stack-overflow-blog', 'dev-to',
    // Security & Enterprise
    'krebs-on-security', 'threatpost', 'dark-reading'
  ],
  
  // Search queries for news API - FOCUSED on educational tech content
  TECH_QUERIES: [
    // Start with AI/ML for priority (educational focus)
    '"artificial intelligence" OR "machine learning" OR "deep learning" OR "OpenAI" OR "ChatGPT" OR "GPT" OR "neural network" OR "AI model" OR "AI research"',
    
    // Educational tech terms (more specific)
    '"tech innovation" OR "tech breakthrough" OR "software development" OR "app development" OR "programming" OR "coding" OR "developer tools"',
    
    // Major tech companies (educational context - avoid defense contractors)
    '"Apple" OR "Google" OR "Microsoft" OR "Amazon Web Services" OR "Meta" OR "Tesla" OR "NVIDIA" OR "Intel" OR "Adobe" OR "Salesforce"',
    
    // Startup ecosystem (educational/business focus)
    '"tech startup" OR "startup funding" OR "venture capital" OR "Series A" OR "Series B" OR "unicorn startup" OR "IPO tech" OR "acquisition"',
    
    // Consumer tech & gadgets (educational)
    '"smartphone" OR "iPhone" OR "Android" OR "laptop" OR "tablet" OR "smartwatch" OR "consumer electronics" OR "tech review"',
    
    // Software & development (educational)
    '"open source" OR "GitHub" OR "API" OR "framework" OR "database" OR "cloud computing" OR "SaaS" OR "software platform"',
    
    // Emerging tech (educational focus)
    '"blockchain technology" OR "cryptocurrency" OR "cybersecurity" OR "IoT" OR "5G technology" OR "quantum computing" OR "robotics" OR "automation"',
    
    // Business & enterprise tech (educational)
    '"enterprise software" OR "business software" OR "digital transformation" OR "tech earnings" OR "tech industry trends"'
  ],
  
  // Enhanced keyword categories - BALANCED priorities
  TECH_KEYWORDS: {
    'AI/ML': {
      priority: 7, // Reduced from 10 to balance with other categories
      keywords: [
        'artificial intelligence', 'AI', 'machine learning', 'ML', 'neural network', 
        'deep learning', 'GPT', 'OpenAI', 'ChatGPT', 'LLM', 'computer vision', 
        'NLP', 'natural language processing', 'claude', 'gemini', 'llama', 
        'transformer', 'pytorch', 'tensorflow', 'hugging face', 'reinforcement learning',
        'generative AI', 'computer vision', 'speech recognition', 'autonomous systems',
        'foundation model', 'large language model', 'multimodal', 'diffusion model'
      ]
    },
    'Startups': {
      priority: 8, // Keep high for startup focus
      keywords: [
        'startup', 'funding', 'Series A', 'Series B', 'Series C', 'VC', 
        'venture capital', 'entrepreneur', 'unicorn', 'IPO', 'acquisition', 
        'merger', 'tech startup', 'fintech', 'edtech', 'healthtech',
        'cleantech', 'biotech', 'enterprise software', 'SaaS', 'B2B', 'B2C'
      ]
    },
    'Tech Industry': {
      priority: 8, // Increased to balance with AI/ML
      keywords: [
        'apple', 'google', 'microsoft', 'amazon', 'meta', 'tesla', 'nvidia', 
        'intel', 'amd', 'qualcomm', 'software', 'platform', 'cloud', 'enterprise', 
        'saas', 'earnings', 'stock', 'tech earnings', 'semiconductor', 'cloud computing',
        'data center', 'server', 'infrastructure', 'enterprise software'
      ]
    },
    'Cybersecurity': {
      priority: 8, // Increased priority
      keywords: [
        'cybersecurity', 'security', 'privacy', 'encryption', 'blockchain', 'cryptocurrency',
        'data protection', 'vulnerability', 'malware', 'ransomware', 'phishing', 'breach',
        'authentication', 'biometric', 'zero trust', 'endpoint security', 'network security',
        'cloud security', 'identity management', 'firewall', 'VPN', 'secure coding'
      ]
    },
    'Software Development': {
      priority: 8, // Increased priority
      keywords: [
        'programming', 'developer', 'software development', 'coding', 'open source',
        'github', 'API', 'framework', 'library', 'SDK', 'IDE', 'devops', 'agile',
        'javascript', 'python', 'react', 'node.js', 'kubernetes', 'docker', 'microservices',
        'web development', 'mobile development', 'full stack', 'backend', 'frontend'
      ]
    },
    'Gaming': {
      priority: 7, // Increased priority
      keywords: [
        'gaming', 'video game', 'game development', 'unity', 'unreal engine', 'game studio',
        'esports', 'gaming console', 'ps5', 'xbox', 'nintendo', 'steam', 'mobile game',
        'VR gaming', 'AR gaming', 'game engine', 'indie game', 'AAA game', 'streaming'
      ]
    },
    'Gadgets': {
      priority: 7, // Increased priority
      keywords: [
        'iphone', 'android', 'smartphone', 'laptop', 'tablet', 'smartwatch', 
        'earbuds', 'headphones', 'gaming', 'console', 'vr', 'ar', 'mixed reality',
        'processor', 'GPU', 'CPU', 'display', 'battery', 'camera', 'sensor',
        'wearable', 'smart home device', 'consumer electronics'
      ]
    },
    'IoT': {
      priority: 7, // Increased priority
      keywords: [
        'internet of things', 'iot', 'smart home', 'connected device', 'sensor', 
        'automation', 'smart city', 'edge computing', 'embedded', '5G', 'wireless',
        'mesh network', 'industrial IoT', 'smart grid', 'connected car', 'telematics',
        'smart building', 'smart infrastructure', 'environmental monitoring'
      ]
    },
    'Mobile Tech': {
      priority: 7, // Increased priority
      keywords: [
        'mobile app', 'app development', 'ios', 'android', 'mobile platform', 
        'app store', 'google play', 'mobile security', 'mobile payments', 'mobile UI',
        'cross platform', 'react native', 'flutter', 'mobile analytics', 'push notifications'
      ]
    },
    'Hardware': {
      priority: 7, // Increased priority
      keywords: [
        'hardware', 'semiconductor', 'chip design', 'processor architecture', 'memory',
        'storage', 'SSD', 'GPU architecture', 'CPU performance', 'benchmark', 'overclocking',
        'motherboard', 'RAM', 'cooling system', 'power supply', 'PCIe', 'USB', 'thunderbolt'
      ]
    }
  },
  
  // Keywords that indicate breakthrough/innovation
  BREAKTHROUGH_KEYWORDS: [
    'breakthrough', 'revolutionary', 'groundbreaking', 'innovative', 'first of its kind',
    'new record', 'milestone', 'pioneering', 'cutting-edge', 'state-of-the-art',
    'unprecedented', 'novel', 'discovery', 'invention', 'patent', 'research',
    'study', 'experiment', 'trial', 'prototype', 'beta', 'launch'
  ],
  
  // COMPREHENSIVE keywords to exclude - war, political, violent, and inappropriate content
  EXCLUDED_KEYWORDS: [
    // WAR & MILITARY CONTENT (CRITICAL ADDITION)
    'war', 'warfare', 'military', 'army', 'navy', 'air force', 'marines', 'soldier', 'troops',
    'combat', 'battle', 'fighting', 'conflict', 'invasion', 'attack', 'bombing', 'missile',
    'weapon', 'weapons', 'gun', 'rifle', 'ammunition', 'explosive', 'bomb', 'grenade',
    'drone strike', 'military drone', 'war drone', 'combat drone', 'surveillance drone',
    'ukraine war', 'russia ukraine', 'gaza conflict', 'israel palestine', 'syria war',
    'afghanistan war', 'iraq war', 'north korea', 'china military', 'taiwan conflict',
    'nuclear weapon', 'nuclear missile', 'ballistic missile', 'cruise missile',
    'defense contractor', 'arms dealer', 'military contract', 'defense spending',
    
    // POLITICAL CONTENT (CRITICAL ADDITION)
    'politics', 'political', 'election', 'voting', 'campaign', 'candidate', 'republican', 'democrat',
    'congress', 'senate', 'house of representatives', 'politician', 'government policy',
    'white house', 'president biden', 'trump', 'harris', 'desantis', 'obama',
    'legislative', 'regulation', 'policy debate', 'partisan', 'bipartisan',
    'supreme court', 'federal court', 'immigration policy', 'healthcare policy',
    
    // VIOLENCE & DEATH CONTENT (CRITICAL ADDITION)
    'death', 'died', 'killed', 'murder', 'shooting', 'violence', 'violent', 'assault',
    'terrorism', 'terrorist', 'extremist', 'hate crime', 'mass shooting', 'gun violence',
    'domestic violence', 'sexual assault', 'kidnapping', 'hostage', 'ransom',
    'suicide', 'overdose', 'fatal accident', 'car crash death', 'plane crash',
    
    // INAPPROPRIATE SOCIAL CONTENT (CRITICAL ADDITION)
    'scandal', 'controversy', 'arrest', 'charged with', 'indicted', 'lawsuit',
    'sexual harassment', 'discrimination', 'racism', 'sexism', 'hate speech',
    'conspiracy theory', 'misinformation', 'disinformation', 'propaganda',
    
    // EXISTING NON-TECH EXCLUSIONS (KEEP AS-IS)
    'recipe for', 'pizza dough', 'cooking tips', 'food recipe', 'grill tips', 'restaurant review',
    'sports score', 'game score', 'football game', 'basketball score', 'golf tournament', 'lakers beat',
    'fashion trend', 'beauty tips', 'makeup tutorial', 'hair styling', 'clothing style',
    'travel guide', 'vacation spots', 'real estate market', 'home buying', 'property sale',
    'fitness routine', 'workout tips', 'diet plan', 'weight loss', 'exercise routine',
    'celebrity gossip', 'movie review', 'tv show recap', 'entertainment gossip'
  ],
  
  // Engagement calculation weights
  ENGAGEMENT_WEIGHTS: {
    likeCount: 10,
    saveCount: 10, 
    shareCount: 10,
    comments: 10,
    views: 0.1
  },
  
  // Ranking priorities - BALANCED
  RANKING_PRIORITIES: {
    AI_ML_BOOST: 15,        // Reduced from 50 to balance content
    BREAKTHROUGH_BOOST: 25,  // Extra points for breakthrough keywords
    RECENCY_BOOST: 20,       // Extra points for recent articles
    SOURCE_BOOST: 15         // Extra points for premium sources
  },
  
  // Centralized fallback configurations
  FALLBACKS: {
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop',
    excerpt: 'Stay updated with the latest developments in technology and innovation.',
    content: 'This article provides insights into recent technological developments and their impact on the industry.',
    source: 'Tech News',
    summary: {
      raw: 'This article covers recent technological developments and their significance in the current market landscape.',
      quickSummary: 'Latest tech developments and their market impact covered in this comprehensive article.',
      whyItMatters: 'These developments represent significant shifts in the technology landscape that could impact future innovation and market dynamics.',
      technicalDetails: 'The article discusses various technical aspects and implementation details of recent technological advancements.',
      industryImpact: 'These changes are expected to influence industry standards and practices across multiple sectors.',
      futureImplications: 'The long-term effects of these developments may reshape how technology is integrated into daily operations.'
    }
  }
};

module.exports = { NEWS_CONFIG }; 