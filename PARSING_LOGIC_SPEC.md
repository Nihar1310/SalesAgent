# 📊 Email Parsing Logic Specification - 100% Accuracy Target

## Overview

This document defines the comprehensive parsing logic to extract quotation data from Gmail emails with near-perfect accuracy.

---

## Input: Raw Email

```javascript
{
  messageId: "abc123",
  threadId: "thread456",
  subject: "Quotation for AR Bricks",
  from: "John Doe <john@example.com>",
  date: "2024-11-06T10:30:00Z",
  body: {
    html: "<html>...</html>",
    text: "Plain text version..."
  },
  attachments: [
    { filename: "quote.pdf", mimeType: "application/pdf" }
  ]
}
```

## Output: Structured Data

```javascript
{
  confidence: 0.95,
  client: {
    id: 123,              // Matched existing client
    name: "ABC Company",
    email: "john@example.com",
    matched: true,
    confidence: 1.0
  },
  items: [
    {
      material: {
        id: 456,          // Matched existing material
        name: "AR Bricks",
        matched: true,
        confidence: 0.92,
        originalText: "A.R. Bricks 40%"
      },
      quantity: 25,
      unit: "MT",
      ratePerUnit: 1250.00,
      currency: "INR",
      exWorks: "Wankaner (Gujarat)",
      deliveryTerms: "From Ready Stock",
      confidence: 0.90
    }
  ],
  metadata: {
    quotationDate: "2024-11-06",
    validUntil: "2024-12-06",
    referenceNumber: "Q-2024-001"
  },
  needsReview: false,
  warnings: []
}
```

---

## Parsing Pipeline

### Stage 1: Email Preprocessing

```javascript
class EmailPreprocessor {
  preprocess(rawEmail) {
    return {
      // 1. Extract clean text from HTML
      cleanText: this.htmlToText(rawEmail.body.html),
      
      // 2. Remove email signature
      bodyWithoutSignature: this.removeSignature(rawEmail.body.text),
      
      // 3. Extract tables
      tables: this.extractTables(rawEmail.body.html),
      
      // 4. Identify quoted/forwarded content
      quotedContent: this.extractQuotedContent(rawEmail.body.text),
      
      // 5. Parse attachments (PDF/Excel)
      attachmentData: this.parseAttachments(rawEmail.attachments),
      
      // 6. Normalize formatting
      normalized: this.normalizeText(rawEmail.body.text)
    };
  }
  
  htmlToText(html) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, headers, footers
    $('script, style, header, footer, nav').remove();
    
    // Convert tables to readable format
    $('table').each((i, table) => {
      const tableText = this.tableToText(table);
      $(table).replaceWith(`\n${tableText}\n`);
    });
    
    // Get text and normalize whitespace
    return $.text()
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
  
  removeSignature(text) {
    const signaturePatterns = [
      /^--\s*$/m,
      /^regards,?$/im,
      /^best regards,?$/im,
      /^thanks,?$/im,
      /^thank you,?$/im
    ];
    
    for (const pattern of signaturePatterns) {
      const match = text.search(pattern);
      if (match !== -1) {
        return text.substring(0, match).trim();
      }
    }
    
    return text;
  }
}
```

### Stage 2: Quotation Detection

```javascript
class QuotationDetector {
  isQuotationEmail(email) {
    const indicators = [
      // Subject line keywords
      {
        type: 'subject',
        patterns: [
          /quotation/i,
          /quote\s+(?:for|no\.?|#)/i,
          /price\s+list/i,
          /pricing/i,
          /proposal/i,
          /offer/i,
          /rates?\s+for/i
        ],
        weight: 0.4
      },
      
      // Body content keywords
      {
        type: 'body',
        patterns: [
          /please\s+find\s+(?:the\s+)?(?:quotation|quote|price)/i,
          /(?:our|revised)\s+(?:quotation|quote|pricing)/i,
          /(?:rate|price)\s+per\s+(?:mt|kg|ton|unit)/i,
          /\b(?:total|grand\s+total)\s*:?\s*₹/i
        ],
        weight: 0.3
      },
      
      // Table presence
      {
        type: 'structure',
        patterns: [
          /<table/i,
          /\|.*\|.*\|/,  // Markdown table
          /sr\.?\s*no/i   // Serial number column
        ],
        weight: 0.2
      },
      
      // Price mentions
      {
        type: 'price',
        patterns: [
          /₹\s*\d+/,
          /rs\.?\s*\d+/i,
          /inr\s*\d+/i,
          /\d+\s*(?:\/|per)\s*(?:mt|kg|ton)/i
        ],
        weight: 0.1
      }
    ];
    
    let score = 0;
    const matches = [];
    
    for (const indicator of indicators) {
      const text = indicator.type === 'subject' ? email.subject : 
                   indicator.type === 'body' ? email.body.text :
                   email.body.html;
      
      for (const pattern of indicator.patterns) {
        if (pattern.test(text)) {
          score += indicator.weight;
          matches.push({ type: indicator.type, pattern: pattern.source });
          break;  // Only count once per type
        }
      }
    }
    
    return {
      isQuotation: score >= 0.5,
      confidence: score,
      matches: matches
    };
  }
}
```

### Stage 3: Multi-Strategy Parsing

```javascript
class MultiStrategyParser {
  async parse(preprocessedEmail) {
    const strategies = [
      new HTMLTableStrategy(),
      new MarkdownTableStrategy(),
      new StructuredTextStrategy(),
      new PatternMatchingStrategy(),
      new ProximityBasedStrategy()
    ];
    
    const results = [];
    
    for (const strategy of strategies) {
      try {
        const result = await strategy.parse(preprocessedEmail);
        if (result.items.length > 0) {
          results.push({
            strategy: strategy.name,
            confidence: result.confidence,
            items: result.items
          });
        }
      } catch (error) {
        console.error(`Strategy ${strategy.name} failed:`, error);
      }
    }
    
    // Merge and deduplicate results
    return this.mergeResults(results);
  }
  
  mergeResults(results) {
    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);
    
    // Take highest confidence result as base
    const merged = { ...results[0] };
    
    // Cross-validate with other strategies
    for (let i = 1; i < results.length; i++) {
      this.crossValidate(merged, results[i]);
    }
    
    return merged;
  }
  
  crossValidate(primary, secondary) {
    // If multiple strategies agree on an item, increase confidence
    // If they disagree, flag for review
    
    for (const primaryItem of primary.items) {
      const matches = secondary.items.filter(item => 
        this.isSameMaterial(primaryItem.material, item.material) &&
        Math.abs(primaryItem.ratePerUnit - item.ratePerUnit) < 10
      );
      
      if (matches.length > 0) {
        primaryItem.confidence = Math.min(1.0, primaryItem.confidence + 0.1);
        primaryItem.validated = true;
      }
    }
  }
}
```

### Stage 4: HTML Table Strategy

```javascript
class HTMLTableStrategy {
  constructor() {
    this.name = 'HTMLTableStrategy';
  }
  
  parse(email) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(email.body.html);
    
    const items = [];
    
    $('table').each((i, table) => {
      // Detect if this is a quotation table
      const headers = this.extractHeaders($(table));
      const columnMap = this.mapColumns(headers);
      
      if (!columnMap.material || !columnMap.rate) {
        return; // Not a quotation table
      }
      
      // Extract rows
      $(table).find('tbody tr, tr').each((j, row) => {
        const cells = $(row).find('td, th');
        
        if (cells.length === 0 || j === 0) return; // Skip header row
        
        const item = this.extractRow(cells, columnMap);
        
        if (item && item.material && item.ratePerUnit > 0) {
          items.push({
            ...item,
            confidence: 0.9,  // High confidence for table data
            extractionMethod: 'html_table'
          });
        }
      });
    });
    
    return {
      items: items,
      confidence: items.length > 0 ? 0.9 : 0
    };
  }
  
  extractHeaders(table) {
    const headers = [];
    
    table.find('thead tr th, tr:first-child th, tr:first-child td').each((i, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });
    
    return headers;
  }
  
  mapColumns(headers) {
    const columnKeywords = {
      material: ['material', 'product', 'item', 'description', 'particulars', 'name'],
      quantity: ['qty', 'quantity', 'qnty', 'quan'],
      unit: ['unit', 'uom', 'measure'],
      rate: ['rate', 'price', 'unit price', 'rate/unit', 'price/unit', 'amount', 'cost'],
      exWorks: ['ex works', 'ex-works', 'exworks', 'ex factory', 'ex-factory'],
      delivery: ['delivery', 'delivery terms', 'shipment', 'logistics']
    };
    
    const columnMap = {};
    
    headers.forEach((header, index) => {
      for (const [key, keywords] of Object.entries(columnKeywords)) {
        if (keywords.some(kw => header.includes(kw))) {
          columnMap[key] = index;
          break;
        }
      }
    });
    
    return columnMap;
  }
  
  extractRow(cells, columnMap) {
    const getValue = (key) => {
      if (columnMap[key] === undefined) return null;
      return $(cells[columnMap[key]]).text().trim();
    };
    
    return {
      material: getValue('material'),
      quantity: this.parseNumber(getValue('quantity')),
      unit: this.normalizeUnit(getValue('unit')),
      ratePerUnit: this.parsePrice(getValue('rate')),
      exWorks: getValue('exWorks'),
      deliveryTerms: getValue('delivery') || 'From Ready Stock'
    };
  }
  
  parsePrice(str) {
    if (!str) return null;
    const cleaned = str.replace(/[₹$,Rs\.INR]/gi, '').trim();
    return parseFloat(cleaned) || null;
  }
  
  parseNumber(str) {
    if (!str) return null;
    return parseFloat(str.replace(/,/g, '')) || null;
  }
  
  normalizeUnit(str) {
    if (!str) return 'MT';
    
    const unitMap = {
      'mt': 'MT',
      'metric ton': 'MT',
      'ton': 'MT',
      'kg': 'KG',
      'bag': 'Bag (25 kg)',
      'nos': 'Nos',
      'pc': 'PCS'
    };
    
    return unitMap[str.toLowerCase()] || str;
  }
}
```

### Stage 5: Pattern Matching Strategy

```javascript
class PatternMatchingStrategy {
  constructor() {
    this.name = 'PatternMatchingStrategy';
  }
  
  parse(email) {
    const text = email.bodyWithoutSignature;
    const items = [];
    
    // Pattern 1: "Material - Price/Unit"
    // Example: "AR Bricks 40% - Rs. 1250/MT"
    const pattern1 = /^(.+?)\s*[-–—]\s*(?:rs\.?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/|per)?\s*(mt|kg|bag|nos|pcs)?/gim;
    
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      items.push({
        material: match[1].trim(),
        ratePerUnit: this.parsePrice(match[2]),
        unit: this.normalizeUnit(match[3] || 'MT'),
        confidence: 0.75,
        extractionMethod: 'pattern_dash_separator'
      });
    }
    
    // Pattern 2: "Material @ Price"
    // Example: "AR Bricks @ 1250 per MT"
    const pattern2 = /(.+?)\s+@\s*(?:rs\.?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/|per)?\s*(mt|kg|bag|nos|pcs)?/gim;
    
    while ((match = pattern2.exec(text)) !== null) {
      items.push({
        material: match[1].trim(),
        ratePerUnit: this.parsePrice(match[2]),
        unit: this.normalizeUnit(match[3] || 'MT'),
        confidence: 0.80,
        extractionMethod: 'pattern_at_symbol'
      });
    }
    
    // Pattern 3: "Price for Material"
    // Example: "Price for AR Bricks is Rs. 1250/MT"
    const pattern3 = /(?:price|rate)\s+(?:for|of)\s+(.+?)\s+(?:is|:|@)\s*(?:rs\.?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/|per)?\s*(mt|kg|bag|nos|pcs)?/gim;
    
    while ((match = pattern3.exec(text)) !== null) {
      items.push({
        material: match[1].trim(),
        ratePerUnit: this.parsePrice(match[2]),
        unit: this.normalizeUnit(match[3] || 'MT'),
        confidence: 0.70,
        extractionMethod: 'pattern_price_for'
      });
    }
    
    return {
      items: this.deduplicateItems(items),
      confidence: items.length > 0 ? 0.75 : 0
    };
  }
  
  deduplicateItems(items) {
    const seen = new Map();
    
    return items.filter(item => {
      const key = `${item.material.toLowerCase()}-${item.ratePerUnit}`;
      if (seen.has(key)) {
        // Keep the one with higher confidence
        const existing = seen.get(key);
        if (item.confidence > existing.confidence) {
          seen.set(key, item);
          return true;
        }
        return false;
      }
      seen.set(key, item);
      return true;
    });
  }
}
```

### Stage 6: Fuzzy Matching & Validation

```javascript
class FuzzyMatcher {
  constructor(materials, clients) {
    this.materials = materials;
    this.clients = clients;
    
    // Create search index
    this.materialIndex = this.createSearchIndex(materials);
    this.clientIndex = this.createSearchIndex(clients);
  }
  
  createSearchIndex(items) {
    // Normalize and create variations
    const index = new Map();
    
    for (const item of items) {
      const normalized = this.normalize(item.name);
      
      // Add exact match
      index.set(normalized, item);
      
      // Add variations
      const variations = this.generateVariations(item.name);
      for (const variation of variations) {
        if (!index.has(variation)) {
          index.set(variation, item);
        }
      }
    }
    
    return index;
  }
  
  normalize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  generateVariations(text) {
    const variations = new Set();
    
    // Add original
    variations.add(this.normalize(text));
    
    // Remove common words
    const withoutCommon = text.replace(/\b(the|a|an|and|or|for)\b/gi, ' ');
    variations.add(this.normalize(withoutCommon));
    
    // Remove percentages
    const withoutPercent = text.replace(/\d+%/g, '');
    variations.add(this.normalize(withoutPercent));
    
    // Abbreviations
    variations.add(this.normalize(text.replace(/\bpercent\b/gi, '%')));
    
    return Array.from(variations);
  }
  
  matchMaterial(extractedName) {
    const normalized = this.normalize(extractedName);
    
    // Try exact match first
    if (this.materialIndex.has(normalized)) {
      return {
        materialId: this.materialIndex.get(normalized).id,
        matchedName: this.materialIndex.get(normalized).name,
        confidence: 1.0,
        method: 'exact'
      };
    }
    
    // Try fuzzy matching
    const stringSimilarity = require('string-similarity');
    const materialNames = this.materials.map(m => m.name);
    const matches = stringSimilarity.findBestMatch(extractedName, materialNames);
    
    if (matches.bestMatch.rating > 0.85) {
      return {
        materialId: this.materials.find(m => m.name === matches.bestMatch.target).id,
        matchedName: matches.bestMatch.target,
        confidence: matches.bestMatch.rating,
        method: 'fuzzy_high'
      };
    } else if (matches.bestMatch.rating > 0.6) {
      return {
        materialId: null,
        needsReview: true,
        suggestions: matches.ratings.slice(0, 5).map(r => ({
          id: this.materials.find(m => m.name === r.target).id,
          name: r.target,
          similarity: r.rating
        })),
        confidence: matches.bestMatch.rating,
        method: 'fuzzy_medium'
      };
    } else {
      return {
        materialId: null,
        isNew: true,
        suggestedName: extractedName,
        confidence: 0,
        method: 'no_match'
      };
    }
  }
  
  validatePrice(price, materialName) {
    // Get historical prices for this material
    const material = this.materials.find(m => 
      this.normalize(m.name) === this.normalize(materialName)
    );
    
    if (!material || !material.priceHistory) {
      return {
        valid: true,
        confidence: 0.5,
        reason: 'No historical data'
      };
    }
    
    const historicalPrices = material.priceHistory.map(p => p.rate_per_unit);
    const avg = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
    const stdDev = Math.sqrt(
      historicalPrices.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / historicalPrices.length
    );
    
    const deviation = Math.abs(price - avg);
    const zScore = deviation / stdDev;
    
    if (zScore < 1) {
      return {
        valid: true,
        confidence: 1.0,
        reason: 'Within normal range'
      };
    } else if (zScore < 2) {
      return {
        valid: true,
        confidence: 0.7,
        reason: 'Slightly outside normal range',
        warning: `Price deviates ${(deviation/avg*100).toFixed(0)}% from average`
      };
    } else {
      return {
        valid: false,
        confidence: 0.3,
        reason: 'Significantly outside normal range',
        warning: `Price deviates ${(deviation/avg*100).toFixed(0)}% from average`,
        needsReview: true
      };
    }
  }
}
```

---

## Confidence Scoring System

```javascript
function calculateOverallConfidence(result) {
  let score = 0;
  let factors = 0;
  
  // Factor 1: Extraction method (30%)
  const methodScores = {
    'html_table': 0.95,
    'markdown_table': 0.90,
    'pattern_at_symbol': 0.85,
    'pattern_dash_separator': 0.80,
    'pattern_price_for': 0.75,
    'proximity_based': 0.70
  };
  score += (methodScores[result.extractionMethod] || 0.5) * 0.3;
  
  // Factor 2: Material match (25%)
  if (result.material.matched) {
    score += result.material.confidence * 0.25;
  }
  
  // Factor 3: Client match (15%)
  if (result.client.matched) {
    score += result.client.confidence * 0.15;
  }
  
  // Factor 4: Price validation (15%)
  const priceValidation = validatePrice(result.ratePerUnit, result.material.name);
  score += priceValidation.confidence * 0.15;
  
  // Factor 5: Cross-validation (15%)
  if (result.validated) {
    score += 0.15;
  }
  
  return {
    score: score,
    needsReview: score < 0.8,
    autoApprove: score >= 0.9
  };
}
```

---

## Decision Matrix

| Confidence Score | Action | Explanation |
|-----------------|--------|-------------|
| **0.90 - 1.00** | Auto-approve | Very high confidence, save directly |
| **0.75 - 0.89** | Quick review | High confidence, show for 1-click approval |
| **0.60 - 0.74** | Detailed review | Medium confidence, needs correction |
| **0.00 - 0.59** | Manual entry | Low confidence, treat as new |

---

## Learning & Improvement Loop

```javascript
class LearningSystem {
  async learnFromCorrection(original, corrected) {
    // 1. If material name was corrected, add to aliases
    if (original.material !== corrected.material) {
      await this.addMaterialAlias(original.material, corrected.material);
    }
    
    // 2. If price pattern was missed, add to patterns
    if (original.extractionMethod === 'manual') {
      const pattern = this.detectPattern(original.context, corrected.ratePerUnit);
      if (pattern) {
        await this.addParsingPattern(pattern);
      }
    }
    
    // 3. Update confidence scores
    await this.updateConfidenceWeights(original, corrected);
    
    // 4. Retrain fuzzy matcher with new data
    await this.retrainMatcher();
  }
}
```

---

## Testing Strategy

### Unit Tests

```javascript
describe('Email Parser', () => {
  test('should extract from HTML table', () => {
    const email = createTestEmail({
      html: '<table><tr><th>Material</th><th>Rate</th></tr><tr><td>AR Bricks</td><td>1250</td></tr></table>'
    });
    
    const result = parser.parse(email);
    
    expect(result.items).toHaveLength(1);
    expect(result.items[0].material).toBe('AR Bricks');
    expect(result.items[0].ratePerUnit).toBe(1250);
  });
  
  test('should handle various price formats', () => {
    const formats = [
      'Rs. 1250',
      '₹1,250.00',
      'INR 1250',
      '1250/MT',
      '1250 per MT'
    ];
    
    formats.forEach(format => {
      const price = parser.parsePrice(format);
      expect(price).toBe(1250);
    });
  });
});
```

---

## Success Criteria

✅ **>95% automatic extraction accuracy**  
✅ **>90% material match rate**  
✅ **>95% client match rate**  
✅ **<10% manual review rate**  
✅ **<5s processing time per email**

---

**Ready to implement?** Start with the setup guide and we'll build this step by step!

