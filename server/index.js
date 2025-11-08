require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Database and Models
const Database = require('./database/db');
const Material = require('./models/Material');
const Client = require('./models/Client');
const PriceHistory = require('./models/PriceHistory');

// Services
const ExcelImportService = require('./services/ExcelImportService');
const GmailIngestionService = require('./services/GmailIngestionService');

// Routes
const materialsRoutes = require('./routes/materials');
const clientsRoutes = require('./routes/clients');
const importRoutes = require('./routes/import');
const gmailRoutes = require('./routes/gmail');
const quotesRoutes = require('./routes/quotes');
const analyticsRoutes = require('./routes/analytics');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Initialize database and models
let db, materialModel, clientModel, priceHistoryModel, excelImportService, gmailService;

async function initializeApp() {
    try {
        // Initialize database
        db = new Database();
        await db.connect();
        
        // Initialize models
        materialModel = new Material(db);
        clientModel = new Client(db);
        priceHistoryModel = new PriceHistory(db);
        
        // Initialize services
        excelImportService = new ExcelImportService(db, materialModel, clientModel);
        gmailService = new GmailIngestionService(db, materialModel, clientModel, priceHistoryModel);
        
        // Initialize Gmail service
        await gmailService.initialize();
        
        // Start scheduled ingestion if in production
        if (process.env.NODE_ENV === 'production') {
            gmailService.startScheduledIngestion();
        }
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        process.exit(1);
    }
}

// API Routes
app.use('/api/materials', (req, res, next) => {
    if (!materialModel) {
        return res.status(503).json({ error: 'Service not ready' });
    }
    materialsRoutes(materialModel)(req, res, next);
});

app.use('/api/clients', (req, res, next) => {
    if (!clientModel) {
        return res.status(503).json({ error: 'Service not ready' });
    }
    clientsRoutes(clientModel)(req, res, next);
});

app.use('/api/import', (req, res, next) => {
    if (!excelImportService) {
        return res.status(503).json({ error: 'Service not ready' });
    }
    importRoutes(excelImportService)(req, res, next);
});

app.use('/api/gmail', (req, res, next) => {
    if (!gmailService) {
        return res.status(503).json({ error: 'Service not ready' });
    }
    gmailRoutes(gmailService)(req, res, next);
});

app.use('/api/quotes', (req, res, next) => {
    if (!db || !materialModel || !clientModel || !priceHistoryModel) {
        return res.status(503).json({ error: 'Service not ready' });
    }
    quotesRoutes(db, materialModel, clientModel, priceHistoryModel)(req, res, next);
});

app.use('/api/analytics', (req, res, next) => {
    if (!db || !materialModel || !clientModel || !priceHistoryModel) {
        return res.status(503).json({ error: 'Service not ready' });
    }
    analyticsRoutes(db, materialModel, clientModel, priceHistoryModel)(req, res, next);
});

app.use('/api/search', (req, res, next) => {
    if (!db || !materialModel || !clientModel || !priceHistoryModel) {
        return res.status(503).json({ error: 'Service not ready' });
    }
    searchRoutes(db, materialModel, clientModel, priceHistoryModel)(req, res, next);
});

// Price history routes
app.get('/api/price-history/material/:materialId', async (req, res) => {
    try {
        const { materialId } = req.params;
        const { clientId, limit = 10 } = req.query;
        
        const history = await priceHistoryModel.getPriceHistory(
            materialId, 
            clientId || null, 
            parseInt(limit)
        );
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching price history:', error);
        res.status(500).json({ error: 'Failed to fetch price history' });
    }
});

app.get('/api/price-history/latest/:materialId', async (req, res) => {
    try {
        const { materialId } = req.params;
        const { clientId } = req.query;
        
        const latestPrice = await priceHistoryModel.getLatestPrice(
            materialId, 
            clientId || null
        );
        
        if (!latestPrice) {
            return res.json({ price: null, message: 'No price history found' });
        }
        
        res.json(latestPrice);
    } catch (error) {
        console.error('Error fetching latest price:', error);
        res.status(500).json({ error: 'Failed to fetch latest price' });
    }
});

app.post('/api/price-history', async (req, res) => {
    try {
        const priceData = req.body;
        const result = await priceHistoryModel.create(priceData);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating price history:', error);
        res.status(500).json({ error: 'Failed to create price history' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: db ? 'connected' : 'disconnected'
    });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    if (db) {
        await db.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    if (db) {
        await db.close();
    }
    process.exit(0);
});

// Start server
initializeApp().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
});

module.exports = app;
