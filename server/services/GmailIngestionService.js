const { google } = require('googleapis');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const Database = require('../database/db');
const GPTParsingService = require('./GPTParsingService');
const HTMLTableParser = require('./HTMLTableParser');
const FuzzyMatchingService = require('./FuzzyMatchingService');
const LearningService = require('./LearningService');

class GmailIngestionService {
    constructor(db, materialModel, clientModel, priceHistoryModel) {
        this.db = db;
        this.materialModel = materialModel;
        this.clientModel = clientModel;
        this.priceHistoryModel = priceHistoryModel;
        this.gmail = null;
        this.oauth2Client = null;
        this.isRunning = false;
        
        // Initialize parsing services
        this.gptParser = new GPTParsingService();
        this.htmlParser = new HTMLTableParser();
        this.fuzzyMatcher = new FuzzyMatchingService();
        this.learningService = new LearningService(db);
        
        // Initialize fuzzy matcher with data
        this.initializeFuzzyMatcher();

        this.tokenPath = path.join(__dirname, '../../data/gmail-tokens.json');
        this.maxEmailsPerRun = parseInt(process.env.GMAIL_MAX_EMAILS || '500', 10);
        this.lookbackMonths = parseInt(process.env.GMAIL_LOOKBACK_MONTHS || '18', 10);
    }

    async initializeFuzzyMatcher() {
        try {
            // Load materials and clients for fuzzy matching
            const materials = await this.materialModel.getAll();
            const clients = await this.clientModel.getAll();
            
            // Load learned aliases
            const aliases = await this.learningService.getAllAliases();
            
            // Initialize fuzzy matcher
            await this.fuzzyMatcher.initialize(materials, clients, aliases);
            
            console.log('Fuzzy matcher initialized with', materials.length, 'materials and', clients.length, 'clients');
        } catch (error) {
            console.error('Failed to initialize fuzzy matcher:', error);
        }
    }

    async initialize() {
        try {
            // Initialize OAuth2 client
            this.oauth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                process.env.GMAIL_REDIRECT_URI
            );

            // Check if we have stored credentials
            // In production, you'd load this from a secure store
            const tokens = await this.loadStoredTokens();
            if (tokens) {
                this.oauth2Client.setCredentials(tokens);
                this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
                console.log('Gmail API initialized successfully');
            } else {
                console.log('Gmail API credentials not found. Please authenticate first.');
            }
        } catch (error) {
            console.error('Failed to initialize Gmail API:', error);
        }
    }

    async loadStoredTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) {
                const raw = fs.readFileSync(this.tokenPath, 'utf8');
                return JSON.parse(raw);
            }
        } catch (error) {
            console.error('Failed to load Gmail tokens:', error);
        }
        return null;
    }

    async saveTokens(tokens) {
        try {
            fs.mkdirSync(path.dirname(this.tokenPath), { recursive: true });
            fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
            console.log('Gmail tokens saved to disk');
        } catch (error) {
            console.error('Failed to save Gmail tokens:', error);
        }
    }

    getAuthUrl() {
        if (!this.oauth2Client) {
            throw new Error('OAuth2 client not initialized');
        }

        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
        });
    }

    async handleAuthCallback(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            await this.saveTokens(tokens);
            
            this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
            console.log('Gmail authentication successful');
            
            return true;
        } catch (error) {
            console.error('Gmail authentication failed:', error);
            throw error;
        }
    }

    async runIngestion() {
        if (!this.gmail) {
            console.log('Gmail API not authenticated. Skipping ingestion.');
            return { success: false, error: 'Not authenticated' };
        }

        if (this.isRunning) {
            console.log('Ingestion already running. Skipping.');
            return { success: false, error: 'Already running' };
        }

        this.isRunning = true;
        console.log('Starting Gmail ingestion...');

        try {
            const result = await this.processQuotationEmails();
            console.log('Gmail ingestion completed:', result);
            return result;
        } catch (error) {
            console.error('Gmail ingestion failed:', error);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }

    async processQuotationEmails() {
        const result = {
            success: true,
            processedEmails: 0,
            newMaterials: 0,
            newClients: 0,
            newPriceEntries: 0,
            errors: []
        };

        const lookbackQueryDate = this.getLookbackQueryDate();
        const baseQuery = '(subject:(quotation OR quote OR price OR proposal) OR body:(quotation OR quote OR price))';
        const query = lookbackQueryDate ? `${baseQuery} after:${lookbackQueryDate}` : baseQuery;

        let pageToken = null;
        let processedCount = 0;

        try {
            do {
                const response = await this.gmail.users.messages.list({
                    userId: 'me',
                    q: query,
                    maxResults: 100,
                    pageToken: pageToken || undefined
                });

                const messages = response.data.messages || [];

                for (const message of messages) {
                    if (processedCount >= this.maxEmailsPerRun) {
                        pageToken = null;
                        break;
                    }

                    try {
                        const existing = await this.db.get(
                            'SELECT id FROM gmail_ingestion_log WHERE message_id = ?',
                            [message.id]
                        );

                        if (existing) {
                            continue;
                        }

                        const emailResult = await this.processEmail(message.id);
                        processedCount++;
                        result.processedEmails++;
                        result.newMaterials += emailResult.newMaterials;
                        result.newClients += emailResult.newClients;
                        result.newPriceEntries += emailResult.newPriceEntries;
                    } catch (error) {
                        console.error(`Error processing email ${message.id}:`, error);
                        result.errors.push({
                            messageId: message.id,
                            error: error.message
                        });
                    }
                }

                pageToken = response.data.nextPageToken;
            } while (pageToken);

        } catch (error) {
            result.success = false;
            result.error = error.message;
        }

        return result;
    }

    getLookbackQueryDate() {
        if (!this.lookbackMonths || this.lookbackMonths <= 0) {
            return null;
        }

        const lookbackDate = new Date();
        lookbackDate.setMonth(lookbackDate.getMonth() - this.lookbackMonths);
        return this.formatQueryDate(lookbackDate);
    }

    formatQueryDate(date) {
        return date.toISOString().split('T')[0].replace(/-/g, '/');
    }

    normalizeEmailDate(dateStr) {
        if (!dateStr) return null;
        const parsed = new Date(dateStr);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed.toISOString();
    }

    async processEmail(messageId) {
        const startTime = Date.now();
        const result = {
            newMaterials: 0,
            newClients: 0,
            newPriceEntries: 0,
            method: 'unknown',
            confidence: 0,
            cost: 0
        };

        try {
            // Get email details
            const message = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            const headers = message.data.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const to = headers.find(h => h.name === 'To')?.value || '';
            const rawDate = headers.find(h => h.name === 'Date')?.value || '';
            const sentAt = this.normalizeEmailDate(rawDate);
            const threadId = message.data.threadId;

            // Extract email body (both HTML and plain text)
            const emailBody = this.extractEmailBody(message.data.payload);
            
            // Prepare email data for parsing
            const emailData = {
                subject,
                from,
                to,
                date: rawDate,
                sentAt,
                body: emailBody.html || emailBody.plain,
                existingMaterials: await this.materialModel.getAll(),
                existingClients: await this.clientModel.getAll()
            };

            // HYBRID PARSING PIPELINE
            let parsingResult = null;
            
            // 1. Try HTML table parser first (fast and cost-effective)
            if (emailBody.html) {
                console.log(`Trying HTML table parser for email ${messageId}`);
                const htmlResult = this.htmlParser.parseQuotationTable(emailBody.html, {
                    subject,
                    from,
                    to,
                    date: rawDate
                });
                
                if (htmlResult.success && htmlResult.confidence >= 0.95) {
                    console.log(`HTML parser succeeded with confidence ${htmlResult.confidence}`);
                    parsingResult = htmlResult;
                    result.method = 'html_table';
                    result.confidence = htmlResult.confidence;
                }
            }
            
            // 2. If HTML parser failed or low confidence, use GPT-4o Mini
            if (!parsingResult || parsingResult.confidence < 0.95) {
                console.log(`Using GPT-4o Mini for email ${messageId} (HTML confidence: ${parsingResult?.confidence || 0})`);
                const gptResult = await this.gptParser.parseQuotationEmail(emailData);
                
                if (gptResult.success) {
                    // 3. Cross-validate if both parsers succeeded
                    if (parsingResult && parsingResult.success) {
                        parsingResult = this.crossValidate(parsingResult, gptResult);
                        result.method = 'hybrid';
                    } else {
                        parsingResult = gptResult.data;
                        result.method = 'gpt-4o-mini';
                    }
                    result.confidence = gptResult.confidence;
                    result.cost = gptResult.cost;
                }
            }

            if (!parsingResult || !parsingResult.items || parsingResult.items.length === 0) {
                console.log(`No quotation data found in email ${messageId}`);
                await this.logProcessingResult(messageId, threadId, subject, from, 0, 'success', result.method, result.confidence, Date.now() - startTime, result.cost);
                return result;
            }

            parsingResult.metadata = parsingResult.metadata || {};
            if (!parsingResult.metadata.quotationDate && sentAt) {
                parsingResult.metadata.quotationDate = sentAt;
            }
            parsingResult.metadata.emailDate = parsingResult.metadata.emailDate || sentAt || null;
            parsingResult.client = parsingResult.client || {};
            if (!parsingResult.client.email && to) {
                parsingResult.client.email = to;
            }

            // 4. Apply fuzzy matching to materials and clients
            const processedData = await this.saveWithFuzzyMatching(parsingResult, threadId, parsingResult.metadata?.quotationDate || sentAt);
            
            result.newMaterials = processedData.newMaterials;
            result.newClients = processedData.newClients;
            result.newPriceEntries = processedData.newPriceEntries;

            // 5. Check if needs human review (low confidence)
            if (result.confidence < 0.90) {
                await this.addToReviewQueue(messageId, threadId, subject, from, parsingResult, result.confidence, result.method);
            }

            // Log successful processing
            await this.logProcessingResult(messageId, threadId, subject, from, parsingResult.items.length, 'success', result.method, result.confidence, Date.now() - startTime, result.cost);
            
            // Record learning data
            await this.learningService.recordParsingSuccess(messageId, result.method, result.confidence, parsingResult.items.length);

        } catch (error) {
            console.error(`Error processing email ${messageId}:`, error);
            
            // Log failed processing
            await this.logProcessingResult(messageId, null, null, null, 0, 'failed', result.method, 0, Date.now() - startTime, result.cost, error.message);
            
            // Record failure for learning
            await this.learningService.recordParsingFailure(messageId, result.method, error.message);
            
            throw error;
        }

        return result;
    }

    extractEmailBody(payload) {
        const result = {
            html: '',
            plain: ''
        };
        
        const extractFromPart = (part) => {
            if (part.body && part.body.data) {
                const content = Buffer.from(part.body.data, 'base64').toString();
                if (part.mimeType === 'text/html') {
                    result.html += content;
                } else if (part.mimeType === 'text/plain') {
                    result.plain += content;
                }
            }
        };
        
        if (payload.body && payload.body.data) {
            extractFromPart(payload);
        } else if (payload.parts) {
            for (const part of payload.parts) {
                if (part.parts) {
                    // Handle nested parts (multipart/alternative)
                    for (const subPart of part.parts) {
                        extractFromPart(subPart);
                    }
                } else {
                    extractFromPart(part);
                }
            }
        }
        
        return result;
    }

    crossValidate(htmlResult, gptResult) {
        // Cross-validate results from HTML parser and GPT
        // For now, prefer GPT result if both succeeded, but use HTML confidence boost
        const result = gptResult.data;
        
        // Boost confidence if both parsers agree on item count
        if (htmlResult.items.length === gptResult.data.items.length) {
            result.confidence = Math.min(1.0, result.confidence + 0.05);
        }
        
        // Use HTML parser's high-confidence items where possible
        if (htmlResult.confidence > gptResult.confidence) {
            // Could implement more sophisticated merging logic here
            console.log('HTML parser had higher confidence, considering hybrid approach');
        }

        result.metadata = result.metadata || {};
        result.client = result.client || {};
        if (htmlResult.metadata) {
            if (!result.metadata.quotationDate && htmlResult.metadata.quotationDate) {
                result.metadata.quotationDate = htmlResult.metadata.quotationDate;
            }
            if (!result.metadata.emailDate && htmlResult.metadata.emailDate) {
                result.metadata.emailDate = htmlResult.metadata.emailDate;
            }
        }

        if (!result.client?.email && htmlResult.client?.email) {
            result.client.email = htmlResult.client.email;
        }
        if (!result.client?.name && htmlResult.client?.name) {
            result.client.name = htmlResult.client.name;
        }
        
        return result;
    }

    async saveWithFuzzyMatching(parsingResult, threadId, emailDate = null) {
        const result = {
            newMaterials: 0,
            newClients: 0,
            newPriceEntries: 0
        };

        try {
            // Process client with fuzzy matching
            let clientId = null;
            if (parsingResult.client) {
                const clientMatch = await this.fuzzyMatcher.matchClient(
                    parsingResult.client.name,
                    parsingResult.client.email,
                    parsingResult.client.email ? parsingResult.client.email.split('@')[1] : ''
                );

                if (clientMatch.matched) {
                    clientId = clientMatch.clientId;
                    console.log(`Matched client: "${parsingResult.client.name}" -> ${clientMatch.matchedClient?.name} (${clientMatch.confidence})`);
                } else {
                    const normalizedName = Database.normalizeName(parsingResult.client.name);
                    try {
                        const newClient = await this.clientModel.create({
                            name: parsingResult.client.name,
                            email: parsingResult.client.email || '',
                            contact: parsingResult.client.contactPerson || '',
                            source: 'gmail'
                        });
                        clientId = newClient.id;
                        result.newClients++;
                        console.log(`Created new client: ${parsingResult.client.name}`);
                    } catch (error) {
                        if (error.message.includes('UNIQUE constraint')) {
                            const existingClient =
                                (parsingResult.client.email && await this.clientModel.findByEmail(parsingResult.client.email)) ||
                                await this.clientModel.findByNormalizedName(normalizedName, 'gmail') ||
                                await this.clientModel.findByNormalizedName(normalizedName);

                            if (existingClient) {
                                clientId = existingClient.id;
                                console.log(`Reusing existing client: ${existingClient.name}`);
                            } else {
                                throw error;
                            }
                        } else {
                            throw error;
                        }
                    }
                }
            }

            // Process materials and prices with fuzzy matching
            for (const item of parsingResult.items) {
                let materialId = null;
                
                const materialMatch = await this.fuzzyMatcher.matchMaterial(item.material);
                
                if (materialMatch.matched) {
                    materialId = materialMatch.materialId;
                    console.log(`Matched material: "${item.material}" -> ${materialMatch.matchedMaterial?.name} (${materialMatch.confidence})`);
                } else {
                    const normalizedMaterialName = Database.normalizeName(item.material);
                    try {
                        const newMaterial = await this.materialModel.create({
                            name: item.material,
                            description: '',
                            hsnCode: item.hsnCode || null,
                            source: 'gmail'
                        });
                        materialId = newMaterial.id;
                        result.newMaterials++;
                        console.log(`Created new material: ${item.material}`);
                    } catch (error) {
                        if (error.message.includes('UNIQUE constraint')) {
                            const existingMaterial =
                                await this.materialModel.findByNormalizedName(normalizedMaterialName, 'gmail') ||
                                await this.materialModel.findByNormalizedName(normalizedMaterialName);

                            if (existingMaterial) {
                                materialId = existingMaterial.id;
                                console.log(`Reusing existing material: ${existingMaterial.name}`);
                            } else {
                                throw error;
                            }
                        } else {
                            throw error;
                        }
                    }
                }

                // Create price history entry
                if (materialId && clientId && item.ratePerUnit > 0) {
                    const itemQuotedAt = this.normalizeEmailDate(item.quotedAt);
                    const quotedAt =
                        itemQuotedAt ||
                        parsingResult.metadata?.quotationDate ||
                        emailDate ||
                        parsingResult.metadata?.emailDate ||
                        new Date().toISOString();

                    await this.priceHistoryModel.create({
                        materialId: materialId,
                        clientId: clientId,
                        ratePerUnit: item.ratePerUnit,
                        currency: item.currency || 'INR',
                        unit: item.unit || 'MT',
                        quantity: item.quantity || null,
                        exWorksLocation: item.exWorks || null,
                        quotedAt,
                        source: 'gmail',
                        emailThreadId: threadId
                    });
                    result.newPriceEntries++;
                }
            }

        } catch (error) {
            console.error('Error in saveWithFuzzyMatching:', error);
            throw error;
        }

        return result;
    }

    async addToReviewQueue(messageId, threadId, subject, from, extractedData, confidence, method) {
        try {
            await this.db.run(
                `INSERT INTO review_queue (email_id, thread_id, subject, sender_email, extracted_data, confidence, method, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [messageId, threadId, subject, from, JSON.stringify(extractedData), confidence, method]
            );
            console.log(`Added email ${messageId} to review queue (confidence: ${confidence})`);
        } catch (error) {
            console.error('Error adding to review queue:', error);
        }
    }

    async logProcessingResult(messageId, threadId, subject, from, itemsExtracted, status, method, confidence, processingTime, cost, errorMessage = null) {
        try {
            // Log to gmail_ingestion_log
            await this.db.run(
                `INSERT INTO gmail_ingestion_log 
                 (thread_id, message_id, subject, sender_email, items_extracted, status, error_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [threadId, messageId, subject, from, itemsExtracted, status, errorMessage]
            );

            // Log to parsing_history for analytics
            if (status === 'success') {
                await this.db.run(
                    `INSERT INTO parsing_history 
                     (email_id, method, confidence, items_extracted, processing_time_ms, cost_usd)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [messageId, method, confidence, itemsExtracted, processingTime, cost]
                );
            }
        } catch (error) {
            console.error('Error logging processing result:', error);
        }
    }

    parseQuotationFromEmail(body, subject, from) {
        // Basic parsing logic - in production, this would be much more sophisticated
        const quotationData = {
            client: this.extractClientFromEmail(from, body),
            items: [],
            date: new Date().toISOString()
        };

        // Look for price patterns in the email
        const pricePatterns = [
            /(\w+.*?)\s+(?:rs\.?|₹|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi,
            /(\w+.*?)\s+(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rs\.?|₹|inr)/gi,
            /(\w+.*?)\s+@\s*(?:rs\.?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi
        ];

        for (const pattern of pricePatterns) {
            let match;
            while ((match = pattern.exec(body)) !== null) {
                const materialName = match[1].trim();
                const price = parseFloat(match[2].replace(/,/g, ''));
                
                if (materialName.length > 2 && price > 0) {
                    quotationData.items.push({
                        material: { name: materialName },
                        price: price,
                        currency: 'INR',
                        unit: 'MT',
                        quantity: 1
                    });
                }
            }
        }

        return quotationData;
    }

    extractClientFromEmail(from, body) {
        // Extract client name from email address or signature
        const emailMatch = from.match(/^(.*?)\s*<(.+?)>$/);
        let clientName = emailMatch ? emailMatch[1].trim() : from;
        
        // Clean up common email prefixes
        clientName = clientName.replace(/^(mr\.?|ms\.?|mrs\.?|dr\.?)\s+/i, '');
        
        return {
            name: clientName,
            email: emailMatch ? emailMatch[2] : from
        };
    }

    async processClientFromEmail(clientData) {
        const existing = await this.clientModel.findOrCreate({
            ...clientData,
            source: 'gmail'
        });
        
        return {
            id: existing.id,
            isNew: existing.source === 'gmail' && !existing.id
        };
    }

    async processMaterialFromEmail(materialData) {
        const existing = await this.materialModel.findOrCreate({
            ...materialData,
            source: 'gmail'
        });
        
        return {
            id: existing.id,
            isNew: existing.source === 'gmail' && !existing.id
        };
    }

    startScheduledIngestion() {
        // Run daily at 9 AM
        cron.schedule('0 9 * * *', () => {
            console.log('Running scheduled Gmail ingestion...');
            this.runIngestion();
        });
        
        console.log('Gmail ingestion scheduled to run daily at 9 AM');
    }

    stopScheduledIngestion() {
        cron.destroy();
        console.log('Gmail ingestion scheduling stopped');
    }
}

module.exports = GmailIngestionService;
