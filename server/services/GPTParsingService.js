const OpenAI = require('openai');

class GPTParsingService {
  constructor() {
    // Make OpenAI optional - only initialize if API key is provided
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.enabled = true;
    } else {
      this.openai = null;
      this.enabled = false;
      console.warn('⚠️  GPT Parsing Service: OpenAI API key not found. GPT-4o Mini parsing will be disabled.');
    }
    
    this.model = 'gpt-4o-mini';
    this.maxTokens = 2000;
    this.stats = {
      totalCalls: 0,
      totalCost: 0,
      totalTokens: 0
    };
  }

  async parseQuotationEmail(emailData) {
    const { subject, from, to, date, sentAt, body, existingMaterials, existingClients } = emailData;
    
    // Return error if OpenAI is not enabled
    if (!this.enabled || !this.openai) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
        tokensUsed: 0,
        cost: 0,
        confidence: 0,
        method: 'gpt-4o-mini'
      };
    }
    
    try {
      // Prepare context about existing materials and clients for fuzzy matching
      const materialsList = existingMaterials.slice(0, 50).map(m => m.name).join(', ');
      const clientsList = existingClients.slice(0, 30).map(c => c.name).join(', ');
      
      const prompt = this.buildPrompt(subject, from, to, date, body, materialsList, clientsList);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,  // Low temperature for consistent extraction
        max_tokens: this.maxTokens
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      
      // Update statistics
      this.stats.totalCalls++;
      this.stats.totalTokens += response.usage.total_tokens;
      this.stats.totalCost += this.calculateCost(response.usage);
      
      const fallbackDate = sentAt || this.normalizeDate(date);

      return {
        success: true,
        data: this.normalizeGPTOutput(result, fallbackDate),
        tokensUsed: response.usage.total_tokens,
        cost: this.calculateCost(response.usage),
        confidence: result.confidence || 0.95,
        method: 'gpt-4o-mini'
      };
      
    } catch (error) {
      console.error('GPT parsing failed:', error);
      return {
        success: false,
        error: error.message,
        tokensUsed: 0,
        cost: 0,
        confidence: 0,
        method: 'gpt-4o-mini'
      };
    }
  }

  getSystemPrompt() {
    return `You are an expert quotation data extractor for ANUJ TRADERS sales system.
Your task is to extract structured quotation data from emails with EXTREME ACCURACY.

EMAIL FORMAT CHARACTERISTICS:
- HTML table with columns: NO, MATERIAL, QTY, UNIT, RATE RS./UNIT, HSN CODE, EX WORK
- Materials include: Calderys products, Fire Bricks, Ceramic items, Insulation materials
- Units: KG, NOS (pieces), BOX, LTR (liters), ROLL
- Ex Works locations: WANKANER, BHILWARA
- Sender: Prashant Shukla / ANUJ TRADERS

CRITICAL RULES:
1. Extract ALL materials/products mentioned with prices from the table
2. Match material names to existing database entries when possible (fuzzy matching)
3. Extract prices in INR (Indian Rupees) - all prices are in INR
4. Identify units correctly (KG, NOS, BOX, LTR, ROLL)
5. Extract client information from sender email
6. Include Ex Works locations if mentioned (WANKANER, BHILWARA)
7. Extract HSN codes for tax classification
8. Handle special cases: "( A BAG OF 25 KG )", "( 1 BOX = 17 NOS )"
9. If information is ambiguous, set confidence lower
10. NEVER hallucinate data - if uncertain, mark as null

SPECIAL MATERIAL HANDLING:
- "CALDERYS MAKE" products: Keep full specification including bag size
- Fire Bricks: Include percentage grade (30%-35%, 25%-27%)
- Fire Bricks: Include type (STD, S.A., E.A.) and dimensions
- Ceramic products: Include specifications and dimensions
- When material includes "(A BAG OF 25 KG)" - unit is bags, quantity is number of bags

OUTPUT FORMAT (JSON):
{
  "confidence": 0.95,
  "client": {
    "name": "Client Company Name",
    "email": "client@example.com",
    "contactPerson": "Contact Name",
    "matchedId": null,
    "isNew": true
  },
  "items": [
    {
      "material": "Full Material Name with Specifications",
      "materialMatchedId": null,
      "materialIsNew": true,
      "quantity": 25.5,
      "unit": "KG|NOS|BOX|LTR|ROLL",
      "ratePerUnit": 1250.00,
      "currency": "INR",
      "hsnCode": "3816",
      "exWorks": "WANKANER" or null,
      "deliveryTerms": "As per your schedule",
      "confidence": 0.95
    }
  ],
  "terms": {
    "gst": "18%",
    "payment": "100% Against Proforma Invoice",
    "delivery": "As per your schedule",
    "freight": "Extra at actual"
  },
  "metadata": {
    "quotationDate": "2024-11-06",
    "referenceNumber": null,
    "validUntil": null
  }
}`;
  }

  buildPrompt(subject, from, to, date, body, materialsList, clientsList) {
    return `EXTRACT QUOTATION DATA FROM THIS ANUJ TRADERS EMAIL:

===== EMAIL METADATA =====
Subject: ${subject}
From: ${from}
To: ${to}
Date: ${date}

===== EMAIL BODY =====
${body}

===== EXISTING MATERIALS IN DATABASE (for fuzzy matching) =====
${materialsList}

===== EXISTING CLIENTS IN DATABASE (for fuzzy matching) =====
${clientsList}

===== YOUR TASK =====
1. Extract ALL quotation items from the HTML table (material + price + quantity + unit + HSN + Ex Works)
2. Match materials to existing database entries using fuzzy matching
3. Identify the client company/person using the TO header above. Use the TO recipient as the default client unless the email explicitly specifies a different recipient.
4. Extract all pricing details and specifications
5. Include HSN codes and Ex Works locations
6. Extract terms from email footer (GST, Payment, Delivery, Freight)
7. Set confidence scores based on clarity of information
8. Return valid JSON ONLY

EXTRACT NOW:`;
  }

  normalizeGPTOutput(gptResult, fallbackDate) {
    const metadata = { ...(gptResult.metadata || {}) };
    const normalizedMetadataDate = this.normalizeDate(metadata.quotationDate);
    const normalizedFallbackDate = this.normalizeDate(fallbackDate);
    const quotationDate = normalizedMetadataDate || normalizedFallbackDate || null;
    if (quotationDate) {
      metadata.quotationDate = quotationDate;
      metadata.emailDate = metadata.emailDate || quotationDate;
    } else {
      metadata.quotationDate = null;
    }

    return {
      confidence: gptResult.confidence || 0.9,
      client: {
        name: gptResult.client?.name || 'Unknown',
        email: gptResult.client?.email || '',
        contactPerson: gptResult.client?.contactPerson || '',
        matchedId: gptResult.client?.matchedId || null,
        isNew: gptResult.client?.isNew !== false
      },
      items: (gptResult.items || []).map(item => ({
        material: item.material || '',
        materialMatchedId: item.materialMatchedId || null,
        materialIsNew: item.materialIsNew !== false,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'MT',
        ratePerUnit: parseFloat(item.ratePerUnit) || 0,
        currency: item.currency || 'INR',
        hsnCode: item.hsnCode || null,
        exWorks: item.exWorks || null,
        deliveryTerms: item.deliveryTerms || 'As per your schedule',
        confidence: item.confidence || 0.9
      })),
      terms: gptResult.terms || {
        gst: '18%',
        payment: '100% Against Proforma Invoice',
        delivery: 'As per your schedule',
        freight: 'Extra at actual'
      },
      metadata
    };
  }

  normalizeDate(dateValue) {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  calculateCost(usage) {
    // GPT-4o Mini pricing: $0.15 per 1M input tokens, $0.60 per 1M output tokens
    const inputCost = (usage.prompt_tokens / 1000000) * 0.15;
    const outputCost = (usage.completion_tokens / 1000000) * 0.60;
    return inputCost + outputCost;
  }

  getStats() {
    return {
      totalCalls: this.stats.totalCalls,
      totalTokens: this.stats.totalTokens,
      totalCost: this.stats.totalCost,
      avgCostPerCall: this.stats.totalCalls > 0 ? this.stats.totalCost / this.stats.totalCalls : 0,
      avgTokensPerCall: this.stats.totalCalls > 0 ? this.stats.totalTokens / this.stats.totalCalls : 0
    };
  }

  resetStats() {
    this.stats = {
      totalCalls: 0,
      totalCost: 0,
      totalTokens: 0
    };
  }
}

module.exports = GPTParsingService;
