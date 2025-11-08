const Database = require('../database/db');
const Material = require('../models/Material');
const Client = require('../models/Client');
const PriceHistory = require('../models/PriceHistory');

describe('Models Tests', () => {
    let db, materialModel, clientModel, priceHistoryModel;

    beforeAll(async () => {
        // Use in-memory database for testing
        process.env.DATABASE_PATH = ':memory:';
        db = new Database();
        await db.connect();
        
        materialModel = new Material(db);
        clientModel = new Client(db);
        priceHistoryModel = new PriceHistory(db);
    });

    afterAll(async () => {
        await db.close();
    });

    describe('Material Model', () => {
        test('should create a material', async () => {
            const materialData = {
                name: 'Test Material',
                description: 'Test Description',
                hsnCode: '12345'
            };

            const material = await materialModel.create(materialData);
            
            expect(material).toBeDefined();
            expect(material.name).toBe(materialData.name);
            expect(material.description).toBe(materialData.description);
            expect(material.hsn_code).toBe(materialData.hsnCode);
            expect(material.source).toBe('master');
        });

        test('should find material by normalized name', async () => {
            const material = await materialModel.findByNormalizedName('test material');
            expect(material).toBeDefined();
            expect(material.name).toBe('Test Material');
        });

        test('should get all materials', async () => {
            const materials = await materialModel.getAll();
            expect(materials.length).toBeGreaterThan(0);
        });
    });

    describe('Client Model', () => {
        test('should create a client', async () => {
            const clientData = {
                name: 'Test Client',
                email: 'test@example.com',
                contact: '1234567890'
            };

            const client = await clientModel.create(clientData);
            
            expect(client).toBeDefined();
            expect(client.name).toBe(clientData.name);
            expect(client.email).toBe(clientData.email);
            expect(client.contact).toBe(clientData.contact);
            expect(client.source).toBe('master');
        });

        test('should find client by email', async () => {
            const client = await clientModel.findByEmail('test@example.com');
            expect(client).toBeDefined();
            expect(client.name).toBe('Test Client');
        });
    });

    describe('Price History Model', () => {
        let materialId, clientId;

        beforeAll(async () => {
            const material = await materialModel.findByNormalizedName('test material');
            const client = await clientModel.findByEmail('test@example.com');
            materialId = material.id;
            clientId = client.id;
        });

        test('should create price history entry', async () => {
            const priceData = {
                materialId,
                clientId,
                ratePerUnit: 1000.50,
                currency: 'INR',
                unit: 'MT',
                quantity: 10,
                quotedAt: new Date().toISOString()
            };

            const priceEntry = await priceHistoryModel.create(priceData);
            
            expect(priceEntry).toBeDefined();
            expect(priceEntry.rate_per_unit).toBe(priceData.ratePerUnit);
            expect(priceEntry.material_name).toBe('Test Material');
            expect(priceEntry.client_name).toBe('Test Client');
        });

        test('should get latest price', async () => {
            const latestPrice = await priceHistoryModel.getLatestPrice(materialId, clientId);
            
            expect(latestPrice).toBeDefined();
            expect(latestPrice.rate_per_unit).toBe(1000.50);
            expect(latestPrice.material_name).toBe('Test Material');
        });

        test('should get price history', async () => {
            const history = await priceHistoryModel.getPriceHistory(materialId, clientId);
            
            expect(history).toBeDefined();
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].rate_per_unit).toBe(1000.50);
        });
    });
});
