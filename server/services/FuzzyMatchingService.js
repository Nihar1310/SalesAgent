const Fuse = require('fuse.js');

class FuzzyMatchingService {
  constructor() {
    this.materialFuse = null;
    this.clientFuse = null;
    this.materialAliases = new Map(); // For learned aliases
    this.clientAliases = new Map();
    
    // Fuse.js options for materials
    this.materialOptions = {
      keys: ['name', 'description'],
      threshold: 0.3, // Lower = more strict matching
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 3,
      ignoreLocation: true,
      ignoreFieldNorm: true
    };
    
    // Fuse.js options for clients
    this.clientOptions = {
      keys: ['name', 'email', 'contactPerson'],
      threshold: 0.4, // Slightly more lenient for client names
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
      ignoreFieldNorm: true
    };
  }

  async initialize(materials, clients, aliases = {}) {
    // Initialize material search index
    this.materialFuse = new Fuse(materials, this.materialOptions);
    
    // Initialize client search index
    this.clientFuse = new Fuse(clients, this.clientOptions);
    
    // Load aliases if provided
    if (aliases.materials) {
      this.materialAliases = new Map(aliases.materials);
    }
    if (aliases.clients) {
      this.clientAliases = new Map(aliases.clients);
    }
    
    console.log(`FuzzyMatchingService initialized with ${materials.length} materials and ${clients.length} clients`);
  }

  async matchMaterial(extractedName, options = {}) {
    if (!extractedName || !this.materialFuse) {
      return { materialId: null, confidence: 0, matched: false, candidates: [] };
    }
    
    const normalizedName = this.normalizeMaterialName(extractedName);
    
    // 1. Check for exact alias match first
    if (this.materialAliases.has(normalizedName)) {
      const materialId = this.materialAliases.get(normalizedName);
      return {
        materialId: materialId,
        confidence: 1.0,
        matched: true,
        matchType: 'alias',
        originalText: extractedName,
        normalizedText: normalizedName,
        candidates: []
      };
    }
    
    // 2. Try exact name match
    const exactMatch = this.findExactMaterialMatch(normalizedName);
    if (exactMatch) {
      return {
        materialId: exactMatch.id,
        confidence: 1.0,
        matched: true,
        matchType: 'exact',
        originalText: extractedName,
        normalizedText: normalizedName,
        matchedMaterial: exactMatch,
        candidates: []
      };
    }
    
    // 3. Fuzzy search
    const results = this.materialFuse.search(normalizedName);
    const candidates = results.slice(0, 5).map(result => ({
      material: result.item,
      confidence: 1 - result.score, // Fuse.js score is distance, we want similarity
      score: result.score,
      matches: result.matches
    }));
    
    // 4. Apply business logic for material matching
    const bestMatch = this.selectBestMaterialMatch(candidates, extractedName, options);
    
    if (bestMatch && bestMatch.confidence >= (options.threshold || 0.85)) {
      return {
        materialId: bestMatch.material.id,
        confidence: bestMatch.confidence,
        matched: true,
        matchType: 'fuzzy',
        originalText: extractedName,
        normalizedText: normalizedName,
        matchedMaterial: bestMatch.material,
        candidates: candidates
      };
    }
    
    // 5. No good match found
    return {
      materialId: null,
      confidence: bestMatch ? bestMatch.confidence : 0,
      matched: false,
      matchType: 'none',
      originalText: extractedName,
      normalizedText: normalizedName,
      candidates: candidates
    };
  }

  async matchClient(name, email = '', domain = '', options = {}) {
    if (!this.clientFuse) {
      return { clientId: null, confidence: 0, matched: false, candidates: [] };
    }
    
    // 1. Try email exact match first (most reliable)
    if (email) {
      const emailMatch = this.findClientByEmail(email);
      if (emailMatch) {
        return {
          clientId: emailMatch.id,
          confidence: 1.0,
          matched: true,
          matchType: 'email',
          originalText: name,
          matchedClient: emailMatch,
          candidates: []
        };
      }
    }
    
    // 2. Try domain match
    if (domain) {
      const domainMatch = this.findClientByDomain(domain);
      if (domainMatch) {
        return {
          clientId: domainMatch.id,
          confidence: 0.95,
          matched: true,
          matchType: 'domain',
          originalText: name,
          matchedClient: domainMatch,
          candidates: []
        };
      }
    }
    
    // 3. Check aliases
    const normalizedName = this.normalizeClientName(name);
    if (this.clientAliases.has(normalizedName)) {
      const clientId = this.clientAliases.get(normalizedName);
      return {
        clientId: clientId,
        confidence: 1.0,
        matched: true,
        matchType: 'alias',
        originalText: name,
        normalizedText: normalizedName,
        candidates: []
      };
    }
    
    // 4. Fuzzy search by name
    const results = this.clientFuse.search(normalizedName);
    const candidates = results.slice(0, 5).map(result => ({
      client: result.item,
      confidence: 1 - result.score,
      score: result.score,
      matches: result.matches
    }));
    
    const bestMatch = this.selectBestClientMatch(candidates, name, options);
    
    if (bestMatch && bestMatch.confidence >= (options.threshold || 0.85)) {
      return {
        clientId: bestMatch.client.id,
        confidence: bestMatch.confidence,
        matched: true,
        matchType: 'fuzzy',
        originalText: name,
        normalizedText: normalizedName,
        matchedClient: bestMatch.client,
        candidates: candidates
      };
    }
    
    return {
      clientId: null,
      confidence: bestMatch ? bestMatch.confidence : 0,
      matched: false,
      matchType: 'none',
      originalText: name,
      normalizedText: normalizedName,
      candidates: candidates
    };
  }

  normalizeMaterialName(name) {
    if (!name) return '';
    
    return name
      .toUpperCase()
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common prefixes/suffixes that might vary
      .replace(/^(CALDERYS\s+MAKE\s+)/i, 'CALDERYS ')
      // Normalize percentage formats
      .replace(/(\d+)\s*%\s*-\s*(\d+)\s*%/g, '$1%-$2%')
      // Normalize dimensions
      .replace(/(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)/g, '$1X$2X$3')
      // Remove extra punctuation
      .replace(/[^\w\s%-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeClientName(name) {
    if (!name) return '';
    
    return name
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ')
      // Remove common business suffixes
      .replace(/\b(PVT\.?\s*LTD\.?|LTD\.?|PRIVATE\s+LIMITED|LIMITED|COMPANY|CO\.?|CORP\.?|CORPORATION|INC\.?)\b/gi, '')
      // Remove common prefixes
      .replace(/^(M\/S\.?\s*|MESSRS\.?\s*)/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  findExactMaterialMatch(normalizedName) {
    // This would ideally use the database, but for now we'll use the Fuse index
    const materials = this.materialFuse._docs;
    return materials.find(material => 
      this.normalizeMaterialName(material.name) === normalizedName
    );
  }

  findClientByEmail(email) {
    const clients = this.clientFuse._docs;
    return clients.find(client => 
      client.email && client.email.toLowerCase() === email.toLowerCase()
    );
  }

  findClientByDomain(domain) {
    const clients = this.clientFuse._docs;
    return clients.find(client => {
      if (!client.email) return false;
      const clientDomain = client.email.split('@')[1];
      return clientDomain && clientDomain.toLowerCase() === domain.toLowerCase();
    });
  }

  selectBestMaterialMatch(candidates, originalText, options = {}) {
    if (!candidates || candidates.length === 0) return null;
    
    let bestMatch = candidates[0];
    
    // Apply business rules for material matching
    for (const candidate of candidates) {
      const material = candidate.material;
      
      // Boost confidence for known product categories
      if (this.isKnownProductCategory(originalText, material.name)) {
        candidate.confidence += 0.1;
      }
      
      // Boost confidence for exact word matches
      if (this.hasExactWordMatches(originalText, material.name)) {
        candidate.confidence += 0.05;
      }
      
      // Penalize very different lengths (might be wrong match)
      const lengthRatio = Math.min(originalText.length, material.name.length) / 
                         Math.max(originalText.length, material.name.length);
      if (lengthRatio < 0.5) {
        candidate.confidence -= 0.1;
      }
      
      if (candidate.confidence > bestMatch.confidence) {
        bestMatch = candidate;
      }
    }
    
    return bestMatch;
  }

  selectBestClientMatch(candidates, originalText, options = {}) {
    if (!candidates || candidates.length === 0) return null;
    
    let bestMatch = candidates[0];
    
    // Apply business rules for client matching
    for (const candidate of candidates) {
      const client = candidate.client;
      
      // Boost confidence for exact word matches
      if (this.hasExactWordMatches(originalText, client.name)) {
        candidate.confidence += 0.1;
      }
      
      // Boost confidence if contact person matches
      if (client.contactPerson && originalText.includes(client.contactPerson)) {
        candidate.confidence += 0.05;
      }
      
      if (candidate.confidence > bestMatch.confidence) {
        bestMatch = candidate;
      }
    }
    
    return bestMatch;
  }

  isKnownProductCategory(originalText, materialName) {
    const categories = [
      'CALDERYS', 'FIRE BRICK', 'CERAMIC', 'INSULATION', 
      'REFRACTORY', 'CASTABLE', 'MORTAR'
    ];
    
    const originalUpper = originalText.toUpperCase();
    const materialUpper = materialName.toUpperCase();
    
    return categories.some(category => 
      originalUpper.includes(category) && materialUpper.includes(category)
    );
  }

  hasExactWordMatches(text1, text2) {
    const words1 = text1.toUpperCase().split(/\s+/);
    const words2 = text2.toUpperCase().split(/\s+/);
    
    const commonWords = words1.filter(word => 
      word.length > 2 && words2.includes(word)
    );
    
    return commonWords.length >= 2;
  }

  // Learning methods
  async addMaterialAlias(originalText, materialId) {
    const normalized = this.normalizeMaterialName(originalText);
    this.materialAliases.set(normalized, materialId);
    
    // In a real implementation, this would save to database
    console.log(`Added material alias: "${normalized}" -> ${materialId}`);
  }

  async addClientAlias(originalText, clientId) {
    const normalized = this.normalizeClientName(originalText);
    this.clientAliases.set(normalized, clientId);
    
    console.log(`Added client alias: "${normalized}" -> ${clientId}`);
  }

  // Statistics and debugging
  getStats() {
    return {
      materialsIndexed: this.materialFuse ? this.materialFuse._docs.length : 0,
      clientsIndexed: this.clientFuse ? this.clientFuse._docs.length : 0,
      materialAliases: this.materialAliases.size,
      clientAliases: this.clientAliases.size
    };
  }

  // Test method for debugging
  async testMatching(materialName, clientName) {
    console.log('\n=== FUZZY MATCHING TEST ===');
    
    if (materialName) {
      console.log(`\nTesting material: "${materialName}"`);
      const materialResult = await this.matchMaterial(materialName);
      console.log('Material result:', materialResult);
    }
    
    if (clientName) {
      console.log(`\nTesting client: "${clientName}"`);
      const clientResult = await this.matchClient(clientName);
      console.log('Client result:', clientResult);
    }
  }
}

module.exports = FuzzyMatchingService;


