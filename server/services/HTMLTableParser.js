const cheerio = require('cheerio');

class HTMLTableParser {
  constructor() {
    this.name = 'HTMLTableParser';
  }

  parseQuotationTable(html, emailMetadata = {}) {
    try {
      const $ = cheerio.load(html);
      const items = [];
      
      // Find the quotation table
      const table = this.findQuotationTable($);
      
      if (!table || table.length === 0) {
        return {
          success: false,
          items: [],
          confidence: 0,
          method: 'html_table',
          error: 'No quotation table found'
        };
      }
      
      // Extract headers and map columns
      const headers = this.extractHeaders(table, $);
      const columnMap = this.mapColumns(headers);
      
      if (!columnMap.material || !columnMap.rate) {
        return {
          success: false,
          items: [],
          confidence: 0.3,
          method: 'html_table',
          error: 'Required columns (MATERIAL, RATE) not found'
        };
      }
      
      // Extract data rows
      const rows = table.find('tbody tr, tr').slice(1); // Skip header row
      
      rows.each((index, row) => {
        const cells = $(row).find('td, th');
        
        if (cells.length === 0) return; // Skip empty rows
        
        const item = this.extractRowData(cells, columnMap, $);
        
        if (item && item.material && item.ratePerUnit > 0) {
          items.push({
            ...item,
            confidence: this.calculateItemConfidence(item),
            extractionMethod: 'html_table'
          });
        }
      });
      
      // Extract client information from email metadata
      const client = this.extractClientInfo(emailMetadata);
      
      return {
        success: true,
        items: items,
        client: client,
        confidence: this.calculateOverallConfidence(items, columnMap),
        method: 'html_table',
        stats: {
          totalRows: rows.length,
          extractedItems: items.length,
          columnsFound: Object.keys(columnMap).length
        }
      };
      
    } catch (error) {
      console.error('HTML table parsing error:', error);
      return {
        success: false,
        items: [],
        confidence: 0,
        method: 'html_table',
        error: error.message
      };
    }
  }

  findQuotationTable($) {
    // Look for tables that contain quotation-like headers
    let bestTable = null;
    let bestScore = 0;
    
    $('table').each((i, table) => {
      const tableText = $(table).text().toLowerCase();
      let score = 0;
      
      // Score based on presence of key headers
      if (tableText.includes('material')) score += 3;
      if (tableText.includes('rate') || tableText.includes('price')) score += 3;
      if (tableText.includes('qty') || tableText.includes('quantity')) score += 2;
      if (tableText.includes('unit')) score += 2;
      if (tableText.includes('hsn')) score += 1;
      if (tableText.includes('ex work')) score += 1;
      
      // Prefer tables with more rows (actual data)
      const rowCount = $(table).find('tr').length;
      if (rowCount > 2) score += Math.min(rowCount - 2, 5);
      
      if (score > bestScore) {
        bestScore = score;
        bestTable = $(table);
      }
    });
    return bestTable;
  }

  extractHeaders(table, $) {
    const headers = [];
    
    // Try different header row patterns
    const headerSelectors = [
      'thead tr:first-child th',
      'thead tr:first-child td',
      'tr:first-child th',
      'tr:first-child td'
    ];
    
    for (const selector of headerSelectors) {
      const headerCells = table.find(selector);
      if (headerCells.length > 0) {
        headerCells.each((i, cell) => {
          headers.push($(cell).text().trim().toLowerCase());
        });
        break;
      }
    }
    
    return headers;
  }

  mapColumns(headers) {
    // Order matters - more specific patterns first
    const columnKeywords = {
      rate: ['rate rs./unit', 'rs./unit', 'rs/unit', 'rate/unit', 'price/unit', 'unit price', 'rate', 'price', 'amount'],
      exWorks: ['ex work', 'ex works', 'ex-works', 'exworks', 'ex factory', 'location'],
      hsn: ['hsn code', 'hsn', 'code', 'tax code'],
      quantity: ['qty', 'quantity', 'qnty', 'quan'],
      unit: ['unit', 'uom', 'measure'],
      material: ['material', 'product', 'item', 'description', 'particulars'],
      no: ['no', 'sr', 'serial', '#']
    };
    
    const columnMap = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      
      for (const [key, keywords] of Object.entries(columnKeywords)) {
        // Check for exact matches first, then partial matches
        const exactMatch = keywords.find(kw => normalizedHeader === kw);
        const partialMatch = keywords.find(kw => normalizedHeader.includes(kw));
        
        if (exactMatch || partialMatch) {
          columnMap[key] = index;
          break;
        }
      }
    });
    return columnMap;
  }

  extractRowData(cells, columnMap, $) {
    const getValue = (key) => {
      if (columnMap[key] === undefined) return null;
      return $(cells[columnMap[key]]).text().trim();
    };
    
    const material = getValue('material');
    const quantity = getValue('quantity');
    const unit = getValue('unit');
    const rate = getValue('rate');
    const hsn = getValue('hsn');
    const exWorks = getValue('exWorks');
    
    // Skip rows that don't have essential data
    if (!material || !rate) return null;
    
    return {
      material: this.cleanMaterialName(material),
      quantity: this.parseNumber(quantity),
      unit: this.normalizeUnit(unit),
      ratePerUnit: this.parsePrice(rate),
      currency: 'INR',
      hsnCode: hsn || null,
      exWorks: this.normalizeExWorks(exWorks),
      deliveryTerms: 'As per your schedule' // Default for ANUJ TRADERS
    };
  }

  cleanMaterialName(material) {
    if (!material) return '';
    
    // Remove extra whitespace and normalize
    return material
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase(); // ANUJ TRADERS uses uppercase
  }

  parsePrice(priceStr) {
    if (!priceStr) return null;
    
    // Remove currency symbols and extra text, but keep numbers, commas, and dots
    let cleaned = priceStr
      .replace(/₹/g, '') // Remove rupee symbol
      .replace(/Rs\.?/gi, '') // Remove Rs or Rs.
      .replace(/INR/gi, '') // Remove INR
      .replace(/\$/g, '') // Remove dollar
      .replace(/[^\d,.-]/g, '') // Keep only digits, commas, dots, and minus
      .replace(/,/g, '') // Remove commas
      .trim();
    
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }

  parseNumber(numStr) {
    if (!numStr) return null;
    
    const cleaned = numStr.replace(/[,]/g, '');
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }

  normalizeUnit(unitStr) {
    if (!unitStr) return 'MT';
    
    const unitMap = {
      'kg': 'KG',
      'kilogram': 'KG',
      'kgs': 'KG',
      'nos': 'NOS',
      'no': 'NOS',
      'number': 'NOS',
      'numbers': 'NOS',
      'pcs': 'PCS',
      'pc': 'PCS',
      'piece': 'PCS',
      'pieces': 'PCS',
      'box': 'BOX',
      'boxes': 'BOX',
      'ltr': 'LTR',
      'litre': 'LTR',
      'liter': 'LTR',
      'litres': 'LTR',
      'liters': 'LTR',
      'roll': 'ROLL',
      'rolls': 'ROLL',
      'mt': 'MT',
      'metric ton': 'MT',
      'ton': 'MT',
      'tonne': 'MT'
    };
    
    const normalized = unitStr.toLowerCase().trim();
    return unitMap[normalized] || unitStr.toUpperCase();
  }

  normalizeExWorks(exWorksStr) {
    if (!exWorksStr || exWorksStr.trim() === '') return null;
    
    const normalized = exWorksStr.toUpperCase().trim();
    
    // Known ANUJ TRADERS locations
    const locationMap = {
      'WANKANER': 'WANKANER',
      'BHILWARA': 'BHILWARA',
      'WANKANER (GUJARAT)': 'WANKANER',
      'BHILWARA (RAJASTHAN)': 'BHILWARA'
    };
    
    // Check for exact matches first
    for (const [key, value] of Object.entries(locationMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }
    
    return normalized;
  }

  extractClientInfo(emailMetadata) {
    const { from, subject } = emailMetadata;
    
    // Default client info for ANUJ TRADERS emails
    return {
      name: 'ANUJ TRADERS',
      email: from || '',
      contactPerson: 'Prashant Shukla',
      matchedId: null,
      isNew: false // Will be determined by fuzzy matching
    };
  }

  calculateItemConfidence(item) {
    let confidence = 0.9; // Base confidence for HTML table extraction
    
    // Reduce confidence for missing data
    if (!item.quantity) confidence -= 0.1;
    if (!item.unit || item.unit === 'MT') confidence -= 0.05; // MT is default, might be wrong
    if (!item.hsnCode) confidence -= 0.05;
    if (!item.exWorks) confidence -= 0.05;
    
    // Increase confidence for well-structured data
    if (item.material.includes('CALDERYS') || item.material.includes('FIRE BRICK')) {
      confidence += 0.05; // Known product types
    }
    
    if (item.hsnCode && item.hsnCode.length === 4) {
      confidence += 0.05; // Valid HSN code format
    }
    
    return Math.max(0.5, Math.min(1.0, confidence));
  }

  calculateOverallConfidence(items, columnMap) {
    if (items.length === 0) return 0;
    
    // Base confidence from column mapping
    let confidence = 0.7;
    
    // Increase confidence based on found columns
    const requiredColumns = ['material', 'rate'];
    const optionalColumns = ['quantity', 'unit', 'hsn', 'exWorks'];
    
    requiredColumns.forEach(col => {
      if (columnMap[col] !== undefined) confidence += 0.1;
    });
    
    optionalColumns.forEach(col => {
      if (columnMap[col] !== undefined) confidence += 0.05;
    });
    
    // Average item confidence
    const avgItemConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
    confidence = (confidence + avgItemConfidence) / 2;
    
    // Bonus for multiple items (more likely to be a real quotation)
    if (items.length > 3) confidence += 0.05;
    
    return Math.min(1.0, confidence);
  }

  // Test method for debugging
  debugTable(html) {
    const $ = cheerio.load(html);
    const table = this.findQuotationTable($);
    
    if (!table) {
      console.log('No table found');
      return;
    }
    
    console.log('Table found with', table.find('tr').length, 'rows');
    
    const headers = this.extractHeaders(table, $);
    console.log('Headers:', headers);
    
    const columnMap = this.mapColumns(headers);
    console.log('Column mapping:', columnMap);
    
    table.find('tr').each((i, row) => {
      const cells = $(row).find('td, th');
      console.log(`Row ${i}:`, cells.map((j, cell) => $(cell).text().trim()).get());
    });
  }
}

module.exports = HTMLTableParser;
