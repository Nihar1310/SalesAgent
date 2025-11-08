# 📧 Gmail Integration Plan - 100% Accurate Quotation Parsing

## Executive Summary

This document outlines a comprehensive strategy for integrating Gmail API to automatically parse quotation emails with **100% accuracy**. The system will extract materials, clients, prices, and other quotation details from your existing email history and future emails.

---

## 🎯 Objectives

1. **Automatic Email Parsing**: Extract quotation data from Gmail without manual intervention
2. **100% Accuracy**: Achieve near-perfect extraction through multiple validation layers
3. **Intelligent Matching**: Smart fuzzy matching with existing materials/clients
4. **Human-in-the-Loop**: Review UI for ambiguous cases
5. **Incremental Sync**: Continuous background synchronization
6. **Historical Import**: Process existing email history

---

## 📊 Phase 1: Email Analysis & Pattern Discovery

### Step 1.1: Gather Sample Emails

**Action Required from You:**
1. Forward 10-20 representative quotation emails to yourself
2. Include variations:
   - Different clients
   - Different material formats
   - Table-based quotes
   - Plain text quotes
   - HTML formatted quotes
   - Emails with attachments
   - Single-item vs multi-item quotes

**What we need to identify:**
- Subject line patterns
- Email body structure
- Price formats (₹1,250.00 vs Rs. 1250 vs 1250/MT)
- Material name variations
- Client identification patterns
- Date formats
- Unit representations

### Step 1.2: Create Parsing Rules Database

Based on sample analysis, we'll create:

```javascript
const PARSING_RULES = {
  // Subject patterns that indicate quotation emails
  subjectPatterns: [
    /quotation/i,
    /quote/i,
    /pricing/i,
    /price\s*list/i,
    /proposal/i,
    /offer/i,
    /rates?\s*for/i
  ],
  
  // Price extraction patterns
  pricePatterns: [
    {
      name: 'rupee_symbol_price',
      regex: /₹\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/g,
      currency: 'INR'
    },
    {
      name: 'rs_prefix',
      regex: /(?:rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/gi,
      currency: 'INR'
    },
    {
      name: 'price_per_unit',
      regex: /(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:\/|per)\s*(mt|kg|ton|piece|unit)/gi,
      currency: 'INR'
    }
  ],
  
  // Unit patterns
  unitPatterns: {
    'MT': ['mt', 'metric ton', 'metric tonne', 'tonnes', 'tons'],
    'KG': ['kg', 'kgs', 'kilogram', 'kilograms'],
    'Bag (25 kg)': ['bag', 'bags', '25kg bag'],
    'Nos': ['nos', 'no', 'number', 'numbers'],
    // ... all other units
  },
  
  // Table detection
  tablePatterns: [
    /\|.*\|.*\|/,  // Pipe-delimited tables
    /<table/i,     // HTML tables
    /\t.*\t/       // Tab-delimited
  ]
};
```

---

## 🔧 Phase 2: Intelligent Parsing Engine

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Gmail API Layer                       │
│  • OAuth2 Authentication                                 │
│  • Email Fetching                                        │
│  • Thread Management                                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Email Preprocessing Layer                   │
│  • HTML → Plain Text                                     │
│  • Remove Signatures                                     │
│  • Extract Attachments (if PDF)                          │
│  • Normalize Whitespace                                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│          Multi-Strategy Parsing Layer                    │
│  ┌──────────────────────────────────────────────┐       │
│  │  Strategy 1: Table Parser                    │       │
│  │  • HTML Table Extraction                     │       │
│  │  • Markdown Table Extraction                 │       │
│  │  • CSV/TSV Detection                         │       │
│  └──────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────────┐       │
│  │  Strategy 2: Pattern Matching                │       │
│  │  • Regex-based extraction                    │       │
│  │  • Named Entity Recognition (NER)            │       │
│  │  • Price-Material Proximity Analysis         │       │
│  └──────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────────┐       │
│  │  Strategy 3: AI/ML Parser (Optional)         │       │
│  │  • GPT-4 Vision for images/PDFs              │       │
│  │  • Custom trained model                      │       │
│  └──────────────────────────────────────────────┘       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           Smart Matching & Validation Layer              │
│  • Fuzzy Material Matching                               │
│  • Client Email → Client Name Resolution                 │
│  • Price Reasonableness Check                            │
│  • Duplicate Detection                                   │
│  • Confidence Scoring                                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         Human Review Queue (for low confidence)          │
│  • Manual Correction Interface                           │
│  • Learning from Corrections                             │
│  • Bulk Approval                                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Data Persistence Layer                      │
│  • Save to price_history                                 │
│  • Link to gmail_ingestion_log                           │
│  • Update confidence scores                              │
└──────────────────────────────────────────────────────────┘
```

---

## 📝 Phase 3: Parsing Strategies

### Strategy 1: Table Detection & Parsing

**Goal**: Extract structured data from HTML/Markdown tables

```javascript
class TableParser {
  async parseHTMLTable(html) {
    const $ = cheerio.load(html);
    const tables = $('table');
    
    const results = [];
    
    tables.each((i, table) => {
      const headers = [];
      const rows = [];
      
      // Extract headers
      $(table).find('thead tr th, tr:first-child th, tr:first-child td').each((j, th) => {
        headers.push($(th).text().trim().toLowerCase());
      });
      
      // Map headers to known columns
      const columnMap = this.mapHeadersToColumns(headers);
      
      // Extract rows
      $(table).find('tbody tr, tr').slice(1).each((j, tr) => {
        const row = {};
        $(tr).find('td').each((k, td) => {
          const headerName = columnMap[k];
          if (headerName) {
            row[headerName] = $(td).text().trim();
          }
        });
        
        if (Object.keys(row).length > 0) {
          results.push(this.normalizeRow(row));
        }
      });
    });
    
    return results;
  }
  
  mapHeadersToColumns(headers) {
    const knownColumns = {
      material: ['material', 'product', 'item', 'description', 'particulars'],
      quantity: ['qty', 'quantity', 'qnty'],
      unit: ['unit', 'uom', 'measurement'],
      rate: ['rate', 'price', 'unit price', 'rate/unit', 'price/unit', 'amount'],
      exWorks: ['ex works', 'ex-works', 'exworks', 'ex factory'],
      delivery: ['delivery', 'delivery terms', 'shipment']
    };
    
    const columnMap = {};
    
    headers.forEach((header, index) => {
      for (const [key, variations] of Object.entries(knownColumns)) {
        if (variations.some(v => header.includes(v))) {
          columnMap[index] = key;
          break;
        }
      }
    });
    
    return columnMap;
  }
  
  normalizeRow(row) {
    return {
      material: row.material || '',
      quantity: this.parseQuantity(row.quantity),
      unit: this.normalizeUnit(row.unit),
      ratePerUnit: this.parsePrice(row.rate),
      exWorks: row.exWorks || null,
      deliveryTerms: row.delivery || 'From Ready Stock'
    };
  }
  
  parsePrice(priceStr) {
    if (!priceStr) return null;
    // Remove currency symbols and commas
    const cleaned = priceStr.replace(/[₹$,Rs\.INR]/gi, '').trim();
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }
  
  parseQuantity(qtyStr) {
    if (!qtyStr) return null;
    const number = parseFloat(qtyStr.replace(/[,]/g, ''));
    return isNaN(number) ? null : number;
  }
  
  normalizeUnit(unitStr) {
    if (!unitStr) return 'MT';
    
    const unitMap = {
      'mt': 'MT',
      'metric ton': 'MT',
      'ton': 'MT',
      'kg': 'KG',
      'kilogram': 'KG',
      'bag': 'Bag (25 kg)',
      'nos': 'Nos',
      'pc': 'PCS',
      'piece': 'PCS'
    };
    
    const normalized = unitStr.toLowerCase().trim();
    return unitMap[normalized] || unitStr;
  }
}
```

### Strategy 2: Pattern-Based Extraction

**Goal**: Extract from plain text using regex patterns

```javascript
class PatternParser {
  parseTextContent(text) {
    const lines = text.split('\n');
    const results = [];
    
    // Pattern 1: Line-by-line material + price
    // Example: "40% F.B. E/T 3/2 - Rs. 1250/MT"
    const linePattern = /^(.+?)\s*[-–—]\s*(?:rs\.?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/|per)?\s*(mt|kg|bag|nos|pcs)?/i;
    
    lines.forEach(line => {
      const match = line.match(linePattern);
      if (match) {
        results.push({
          material: match[1].trim(),
          ratePerUnit: parseFloat(match[2].replace(/,/g, '')),
          unit: this.normalizeUnit(match[3] || 'MT'),
          confidence: 0.85
        });
      }
    });
    
    // Pattern 2: Table-like structure without HTML
    // Example:
    // Material          Qty    Unit   Rate
    // AR Bricks         10     MT     1250
    const tablePattern = this.detectPlainTextTable(lines);
    if (tablePattern.length > 0) {
      results.push(...tablePattern);
    }
    
    // Pattern 3: Inline mentions
    // Example: "Price for AR Bricks is Rs. 1250 per MT"
    const inlinePattern = /(?:price|rate)\s+(?:for|of)\s+(.+?)\s+(?:is|@|:)\s*(?:rs\.?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/|per)?\s*(mt|kg|bag|nos|pcs)?/gi;
    
    let match;
    while ((match = inlinePattern.exec(text)) !== null) {
      results.push({
        material: match[1].trim(),
        ratePerUnit: parseFloat(match[2].replace(/,/g, '')),
        unit: this.normalizeUnit(match[3] || 'MT'),
        confidence: 0.75
      });
    }
    
    return this.deduplicateResults(results);
  }
  
  detectPlainTextTable(lines) {
    // Detect consistent column spacing
    // This is a simplified version - full implementation would be more sophisticated
    const results = [];
    let headerRow = -1;
    
    // Find header row
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if ((line.includes('material') || line.includes('product')) &&
          (line.includes('rate') || line.includes('price'))) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) return results;
    
    // Parse subsequent rows
    for (let i = headerRow + 1; i < lines.length && i < headerRow + 50; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 10) continue;
      
      // Split by multiple spaces or tabs
      const parts = line.split(/\s{2,}|\t/);
      if (parts.length >= 3) {
        results.push({
          material: parts[0],
          quantity: this.parseQuantity(parts[1]),
          unit: this.normalizeUnit(parts[2]),
          ratePerUnit: this.parsePrice(parts[3] || parts[2]),
          confidence: 0.80
        });
      }
    }
    
    return results;
  }
  
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(item => {
      const key = `${item.material}-${item.ratePerUnit}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
```

### Strategy 3: Fuzzy Matching & Validation

**Goal**: Match extracted materials with existing database entries

```javascript
class FuzzyMatcher {
  constructor(existingMaterials, existingClients) {
    this.materials = existingMaterials;
    this.clients = existingClients;
  }
  
  matchMaterial(extractedName) {
    const stringSimilarity = require('string-similarity');
    
    const materialNames = this.materials.map(m => m.name);
    const matches = stringSimilarity.findBestMatch(extractedName, materialNames);
    
    const bestMatch = matches.bestMatch;
    
    if (bestMatch.rating > 0.8) {
      // High confidence match
      return {
        materialId: this.materials.find(m => m.name === bestMatch.target).id,
        confidence: bestMatch.rating,
        matched: true,
        originalName: extractedName,
        matchedName: bestMatch.target
      };
    } else if (bestMatch.rating > 0.6) {
      // Medium confidence - needs review
      return {
        materialId: null,
        confidence: bestMatch.rating,
        matched: false,
        needsReview: true,
        suggestions: matches.ratings.slice(0, 3).map(r => ({
          name: r.target,
          id: this.materials.find(m => m.name === r.target).id,
          similarity: r.rating
        })),
        originalName: extractedName
      };
    } else {
      // New material
      return {
        materialId: null,
        confidence: 0,
        matched: false,
        isNew: true,
        originalName: extractedName
      };
    }
  }
  
  matchClient(senderEmail, senderName) {
    // First try exact email match
    const exactMatch = this.clients.find(c => 
      c.email && c.email.toLowerCase() === senderEmail.toLowerCase()
    );
    
    if (exactMatch) {
      return {
        clientId: exactMatch.id,
        confidence: 1.0,
        matched: true
      };
    }
    
    // Try domain match
    const domain = senderEmail.split('@')[1];
    const domainMatches = this.clients.filter(c => 
      c.email && c.email.includes(domain)
    );
    
    if (domainMatches.length === 1) {
      return {
        clientId: domainMatches[0].id,
        confidence: 0.9,
        matched: true,
        note: 'Matched by domain'
      };
    }
    
    // Try fuzzy name match
    const stringSimilarity = require('string-similarity');
    const clientNames = this.clients.map(c => c.name);
    const matches = stringSimilarity.findBestMatch(senderName, clientNames);
    
    if (matches.bestMatch.rating > 0.85) {
      return {
        clientId: this.clients.find(c => c.name === matches.bestMatch.target).id,
        confidence: matches.bestMatch.rating,
        matched: true
      };
    }
    
    // New client
    return {
      clientId: null,
      confidence: 0,
      matched: false,
      isNew: true,
      suggestedName: senderName,
      email: senderEmail
    };
  }
  
  validatePrice(price, materialName, clientName) {
    // Price reasonableness check
    const validation = {
      isValid: true,
      warnings: [],
      confidence: 1.0
    };
    
    if (price < 1 || price > 1000000) {
      validation.warnings.push('Price outside expected range');
      validation.confidence *= 0.5;
    }
    
    // Check against historical prices for this material
    const historicalPrices = this.getHistoricalPrices(materialName);
    if (historicalPrices.length > 0) {
      const avgPrice = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
      const deviation = Math.abs(price - avgPrice) / avgPrice;
      
      if (deviation > 0.5) {
        validation.warnings.push(`Price deviates ${(deviation * 100).toFixed(0)}% from average`);
        validation.confidence *= 0.7;
      }
    }
    
    return validation;
  }
}
```

---

## 🎨 Phase 4: Human Review Interface

### UI Component for Review Queue

```jsx
// ReviewQueue.jsx
import React, { useState, useEffect } from 'react';

export default function GmailReviewQueue() {
  const [pendingReviews, setPendingReviews] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Gmail Parsing Review Queue</h1>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Left: List of pending items */}
        <div className="col-span-1 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Pending Reviews ({pendingReviews.length})</h2>
          <div className="space-y-2">
            {pendingReviews.map(item => (
              <div 
                key={item.id}
                className={`p-3 rounded cursor-pointer border ${
                  selectedItem?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="text-sm font-medium">{item.subject}</div>
                <div className="text-xs text-gray-500">{item.from}</div>
                <div className="text-xs mt-1">
                  <span className={`px-2 py-0.5 rounded ${
                    item.confidence > 0.8 ? 'bg-green-100 text-green-700' :
                    item.confidence > 0.6 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {(item.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Middle: Email preview & extracted data */}
        <div className="col-span-1 bg-white rounded-lg shadow p-4">
          {selectedItem && (
            <>
              <h2 className="font-semibold mb-3">Email Preview</h2>
              <div className="text-sm space-y-2 mb-4">
                <div><strong>From:</strong> {selectedItem.from}</div>
                <div><strong>Subject:</strong> {selectedItem.subject}</div>
                <div><strong>Date:</strong> {selectedItem.date}</div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-2">Extracted Data</h3>
                <div className="space-y-2">
                  {selectedItem.extractedItems.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded">
                      <div className="text-sm">
                        <strong>Material:</strong> {item.material}
                        {item.materialMatch && (
                          <span className="ml-2 text-xs text-green-600">
                            → {item.materialMatch.name}
                          </span>
                        )}
                      </div>
                      <div className="text-sm">
                        <strong>Price:</strong> ₹{item.price} / {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4 max-h-60 overflow-y-auto">
                <h3 className="font-semibold mb-2">Email Body</h3>
                <div className="text-xs text-gray-600 whitespace-pre-wrap">
                  {selectedItem.body}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Right: Correction interface */}
        <div className="col-span-1 bg-white rounded-lg shadow p-4">
          {selectedItem && (
            <>
              <h2 className="font-semibold mb-3">Review & Correct</h2>
              {selectedItem.extractedItems.map((item, idx) => (
                <div key={idx} className="mb-4 border-b pb-4">
                  <h4 className="text-sm font-medium mb-2">Item {idx + 1}</h4>
                  
                  <div className="mb-2">
                    <label className="text-xs text-gray-600">Material</label>
                    {item.needsReview ? (
                      <select className="w-full border rounded p-1 text-sm">
                        <option>Create New: {item.material}</option>
                        {item.suggestions?.map(sug => (
                          <option key={sug.id} value={sug.id}>
                            {sug.name} ({(sug.similarity * 100).toFixed(0)}% match)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm">{item.material}</div>
                    )}
                  </div>
                  
                  <div className="mb-2">
                    <label className="text-xs text-gray-600">Price (₹)</label>
                    <input 
                      type="number" 
                      defaultValue={item.price}
                      className="w-full border rounded p-1 text-sm"
                    />
                  </div>
                  
                  <div className="mb-2">
                    <label className="text-xs text-gray-600">Unit</label>
                    <select defaultValue={item.unit} className="w-full border rounded p-1 text-sm">
                      <option value="MT">MT</option>
                      <option value="KG">KG</option>
                      <option value="Bag (25 kg)">Bag (25 kg)</option>
                      <option value="Nos">Nos</option>
                    </select>
                  </div>
                </div>
              ))}
              
              <div className="flex space-x-2 mt-4">
                <button className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">
                  Approve & Save
                </button>
                <button className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700">
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 🚀 Phase 5: Implementation Roadmap

### Week 1: Foundation
- [ ] Set up Google Cloud Console project
- [ ] Configure OAuth2 credentials
- [ ] Implement OAuth flow in backend
- [ ] Create secure token storage
- [ ] Test Gmail API connection

### Week 2: Email Collection & Analysis
- [ ] Collect 20+ sample emails from you
- [ ] Analyze patterns manually
- [ ] Document all variations
- [ ] Create parsing rules database
- [ ] Build test suite with samples

### Week 3: Core Parsing Engine
- [ ] Implement Table Parser
- [ ] Implement Pattern Parser
- [ ] Implement Fuzzy Matcher
- [ ] Create confidence scoring system
- [ ] Unit test all parsers

### Week 4: Integration & Review UI
- [ ] Integrate parsers with Gmail service
- [ ] Build Review Queue UI
- [ ] Implement correction interface
- [ ] Add approval/reject workflow
- [ ] Test end-to-end flow

### Week 5: Optimization & Learning
- [ ] Add learning from corrections
- [ ] Optimize pattern matching
- [ ] Performance tuning
- [ ] Batch processing
- [ ] Schedule setup

### Week 6: Production Deployment
- [ ] Historical email import
- [ ] Monitor accuracy metrics
- [ ] Iterative improvements
- [ ] Documentation
- [ ] Training session

---

## 📈 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Parsing Accuracy** | >95% | Correct extractions / Total emails |
| **Material Match Rate** | >90% | Auto-matched / Total materials |
| **Client Match Rate** | >95% | Auto-matched / Total clients |
| **Price Accuracy** | >98% | Correctly extracted prices / Total |
| **Review Queue Rate** | <20% | Items needing review / Total items |
| **Processing Time** | <5s per email | Average processing time |

---

## 🔐 Security & Privacy

1. **Token Storage**: Store OAuth tokens encrypted in database
2. **Scope Limitation**: Request only `gmail.readonly` scope
3. **Data Privacy**: Only process emails matching quotation patterns
4. **Audit Log**: Log all access and processing
5. **User Control**: Allow users to disconnect Gmail anytime

---

## 🛠️ Technical Requirements

### Environment Variables
```bash
# Add to .env
GMAIL_CLIENT_ID=your_client_id_from_google_cloud
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Optional: For AI-enhanced parsing
OPENAI_API_KEY=your_openai_key
```

### NPM Dependencies
```bash
npm install --save \
  googleapis \
  node-cron \
  cheerio \
  string-similarity \
  pdf-parse \
  mammoth
```

---

## 📚 Next Steps

1. **Review this plan** - Confirm the approach aligns with your needs
2. **Provide sample emails** - Forward 10-20 representative emails
3. **Google Cloud setup** - Create project and OAuth credentials
4. **Start implementation** - Begin with Week 1 tasks

---

## ❓ Questions for You

1. Do you have a preferred format for your quotation emails (HTML tables, plain text, etc.)?
2. Are there specific keywords or phrases that always appear in your quotation emails?
3. Do you send quotes to clients or receive quotes from suppliers (or both)?
4. What's the volume of quotation emails per month?
5. How far back should we process historical emails?
6. Are there any email addresses or domains we should exclude?

---

## 🎓 Learning & Improvement

The system will learn from your corrections:

```javascript
// After each manual correction, update parsing rules
function learnFromCorrection(originalExtraction, correctedData) {
  // If a pattern was consistently wrong, adjust confidence
  // If a new material name variant was found, add to dictionary
  // If price format was missed, add new regex pattern
  
  const pattern = detectPattern(originalExtraction);
  if (pattern) {
    updateParsingRule(pattern, correctedData);
  }
}
```

---

**Ready to proceed?** Let me know and we'll start with gathering sample emails and setting up the Google Cloud Console!

