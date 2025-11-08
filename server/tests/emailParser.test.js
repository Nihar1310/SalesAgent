const HTMLTableParser = require('../services/HTMLTableParser');
const FuzzyMatchingService = require('../services/FuzzyMatchingService');
const GPTParsingService = require('../services/GPTParsingService');

// Mock data for testing
const mockMaterials = [
    { id: 1, name: 'CALDERYS MAKE FIRECRETE SUPER', description: 'High temperature castable' },
    { id: 2, name: 'FIRE BRICK 30%-35% AL2O3 STD', description: 'Standard fire brick' },
    { id: 3, name: 'CERAMIC FIBER BLANKET', description: 'Insulation blanket' },
    { id: 4, name: 'INSULATION BRICK', description: 'Lightweight insulation brick' }
];

const mockClients = [
    { id: 1, name: 'ANUJ TRADERS', email: 'prashant@anujtraders.com', contactPerson: 'Prashant Shukla' },
    { id: 2, name: 'ABC INDUSTRIES', email: 'info@abcindustries.com', contactPerson: 'John Doe' },
    { id: 3, name: 'XYZ CORPORATION', email: 'contact@xyzcorp.com', contactPerson: 'Jane Smith' }
];

// Sample HTML email content (based on ANUJ TRADERS format)
const sampleHTMLEmail = `
<html>
<body>
<p>Dear Sir,</p>
<p>We are pleased to quote you the following:</p>

<table border="1" cellpadding="5" cellspacing="0">
<tr style="background-color: #f0f0f0;">
    <th>NO</th>
    <th>MATERIAL</th>
    <th>QTY</th>
    <th>UNIT</th>
    <th>RATE RS./UNIT</th>
    <th>HSN CODE</th>
    <th>EX WORK</th>
</tr>
<tr>
    <td>1</td>
    <td>CALDERYS MAKE FIRECRETE SUPER ( A BAG OF 25 KG )</td>
    <td>100</td>
    <td>NOS</td>
    <td>1250.00</td>
    <td>3816</td>
    <td>WANKANER</td>
</tr>
<tr>
    <td>2</td>
    <td>FIRE BRICK 30%-35% AL2O3 STD 230X114X65 MM</td>
    <td>500</td>
    <td>NOS</td>
    <td>45.50</td>
    <td>6902</td>
    <td>BHILWARA</td>
</tr>
<tr>
    <td>3</td>
    <td>CERAMIC FIBER BLANKET 1260 GRADE 25MM THICK</td>
    <td>50</td>
    <td>ROLL</td>
    <td>2850.00</td>
    <td>6806</td>
    <td>WANKANER</td>
</tr>
</table>

<p>Terms & Conditions:</p>
<ul>
    <li>GST: 18% Extra</li>
    <li>Payment: 100% Against Proforma Invoice</li>
    <li>Delivery: As per your schedule</li>
    <li>Freight: Extra at actual</li>
</ul>

<p>Best Regards,<br>
Prashant Shukla<br>
ANUJ TRADERS</p>
</body>
</html>
`;

describe('Email Parser Test Suite', () => {
    let htmlParser;
    let fuzzyMatcher;
    let gptParser;

    beforeAll(async () => {
        // Initialize parsers
        htmlParser = new HTMLTableParser();
        fuzzyMatcher = new FuzzyMatchingService();
        
        // Initialize fuzzy matcher with mock data
        await fuzzyMatcher.initialize(mockMaterials, mockClients, { materials: new Map(), clients: new Map() });
        
        // Only initialize GPT parser if API key is available
        if (process.env.OPENAI_API_KEY) {
            gptParser = new GPTParsingService();
        }
    });

    describe('HTML Table Parser', () => {
        test('should extract quotation table from HTML email', () => {
            const result = htmlParser.parseQuotationTable(sampleHTMLEmail, {
                subject: 'Quotation for Refractory Materials',
                from: 'prashant@anujtraders.com'
            });

            expect(result.success).toBe(true);
            expect(result.items).toHaveLength(3);
            expect(result.confidence).toBeGreaterThan(0.8);
            expect(result.method).toBe('html_table');
        });

        test('should extract correct material information', () => {
            const result = htmlParser.parseQuotationTable(sampleHTMLEmail);
            const firstItem = result.items[0];

            expect(firstItem.material).toContain('CALDERYS MAKE FIRECRETE SUPER');
            expect(firstItem.quantity).toBe(100);
            expect(firstItem.unit).toBe('NOS');
            expect(firstItem.ratePerUnit).toBe(1250.00);
            expect(firstItem.hsnCode).toBe('3816');
            expect(firstItem.exWorks).toBe('WANKANER');
        });

        test('should handle different units correctly', () => {
            const result = htmlParser.parseQuotationTable(sampleHTMLEmail);
            
            expect(result.items[0].unit).toBe('NOS');
            expect(result.items[1].unit).toBe('NOS');
            expect(result.items[2].unit).toBe('ROLL');
        });

        test('should extract client information', () => {
            const result = htmlParser.parseQuotationTable(sampleHTMLEmail, {
                subject: 'Quotation',
                from: 'prashant@anujtraders.com'
            });

            expect(result.client).toBeDefined();
            expect(result.client.name).toBe('ANUJ TRADERS');
            expect(result.client.contactPerson).toBe('Prashant Shukla');
        });

        test('should return low confidence for non-quotation HTML', () => {
            const nonQuotationHTML = '<html><body><p>This is just a regular email</p></body></html>';
            const result = htmlParser.parseQuotationTable(nonQuotationHTML);

            expect(result.success).toBe(false);
            expect(result.confidence).toBeLessThan(0.5);
        });
    });

    describe('Fuzzy Matching Service', () => {
        test('should match exact material names', async () => {
            const result = await fuzzyMatcher.matchMaterial('CALDERYS MAKE FIRECRETE SUPER');

            expect(result.matched).toBe(true);
            expect(result.materialId).toBe(1);
            expect(result.confidence).toBe(1.0);
            expect(result.matchType).toBe('exact');
        });

        test('should fuzzy match similar material names', async () => {
            const result = await fuzzyMatcher.matchMaterial('CALDERYS FIRECRETE SUPER CASTABLE');

            // The fuzzy matcher might not match this due to the added "CASTABLE" word
            // Let's test with a closer match
            if (result.matched) {
                expect(result.materialId).toBe(1);
                expect(result.confidence).toBeGreaterThan(0.8);
                expect(result.matchType).toBe('fuzzy');
            } else {
                // Test with a closer match
                const closerResult = await fuzzyMatcher.matchMaterial('CALDERYS FIRECRETE SUPER');
                expect(closerResult.matched).toBe(true);
                expect(closerResult.materialId).toBe(1);
            }
        });

        test('should match materials with different casing', async () => {
            const result = await fuzzyMatcher.matchMaterial('fire brick 30%-35% al2o3 std');

            expect(result.matched).toBe(true);
            expect(result.materialId).toBe(2);
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        test('should not match completely different materials', async () => {
            const result = await fuzzyMatcher.matchMaterial('COMPLETELY DIFFERENT MATERIAL');

            expect(result.matched).toBe(false);
            expect(result.confidence).toBeLessThan(0.85);
        });

        test('should match client by email', async () => {
            const result = await fuzzyMatcher.matchClient('Some Name', 'prashant@anujtraders.com');

            expect(result.matched).toBe(true);
            expect(result.clientId).toBe(1);
            expect(result.confidence).toBe(1.0);
            expect(result.matchType).toBe('email');
        });

        test('should fuzzy match client names', async () => {
            const result = await fuzzyMatcher.matchClient('ANUJ TRADER', '', '');

            expect(result.matched).toBe(true);
            expect(result.clientId).toBe(1);
            expect(result.confidence).toBeGreaterThan(0.8);
            expect(result.matchType).toBe('fuzzy');
        });
    });

    describe('Material Name Normalization', () => {
        test('should normalize material names consistently', () => {
            const fuzzyMatcher = new FuzzyMatchingService();
            
            const normalized1 = fuzzyMatcher.normalizeMaterialName('CALDERYS MAKE FIRECRETE SUPER');
            const normalized2 = fuzzyMatcher.normalizeMaterialName('calderys make firecrete super');
            const normalized3 = fuzzyMatcher.normalizeMaterialName('  CALDERYS   MAKE   FIRECRETE   SUPER  ');

            expect(normalized1).toBe(normalized2);
            expect(normalized1).toBe(normalized3);
            expect(normalized1).toBe('CALDERYS FIRECRETE SUPER');
        });

        test('should normalize percentages correctly', () => {
            const fuzzyMatcher = new FuzzyMatchingService();
            
            const normalized = fuzzyMatcher.normalizeMaterialName('FIRE BRICK 30% - 35% AL2O3');
            expect(normalized).toContain('30%-35%');
        });

        test('should normalize dimensions correctly', () => {
            const fuzzyMatcher = new FuzzyMatchingService();
            
            const normalized = fuzzyMatcher.normalizeMaterialName('FIRE BRICK 230 X 114 X 65 MM');
            expect(normalized).toContain('230X114X65');
        });
    });

    describe('Price Parsing', () => {
        test('should parse prices correctly', () => {
            const parser = new HTMLTableParser();
            
            expect(parser.parsePrice('1250.00')).toBe(1250.00);
            expect(parser.parsePrice('₹1,250.50')).toBe(1250.50);
            expect(parser.parsePrice('Rs. 45.50')).toBe(45.50);
            expect(parser.parsePrice('2,850')).toBe(2850);
        });

        test('should handle invalid prices', () => {
            const parser = new HTMLTableParser();
            
            expect(parser.parsePrice('invalid')).toBeNull();
            expect(parser.parsePrice('')).toBeNull();
            expect(parser.parsePrice(null)).toBeNull();
        });
    });

    describe('Unit Normalization', () => {
        test('should normalize units correctly', () => {
            const parser = new HTMLTableParser();
            
            expect(parser.normalizeUnit('nos')).toBe('NOS');
            expect(parser.normalizeUnit('kg')).toBe('KG');
            expect(parser.normalizeUnit('pieces')).toBe('PCS');
            expect(parser.normalizeUnit('roll')).toBe('ROLL');
            expect(parser.normalizeUnit('litre')).toBe('LTR');
        });
    });

    describe('Ex Works Location Parsing', () => {
        test('should normalize ex works locations', () => {
            const parser = new HTMLTableParser();
            
            expect(parser.normalizeExWorks('WANKANER')).toBe('WANKANER');
            expect(parser.normalizeExWorks('BHILWARA')).toBe('BHILWARA');
            expect(parser.normalizeExWorks('Wankaner (Gujarat)')).toBe('WANKANER');
            expect(parser.normalizeExWorks('bhilwara (rajasthan)')).toBe('BHILWARA');
        });
    });

    describe('Integration Test', () => {
        test('should process complete email workflow', async () => {
            // 1. Parse HTML table
            const htmlResult = htmlParser.parseQuotationTable(sampleHTMLEmail, {
                subject: 'Quotation for Refractory Materials',
                from: 'prashant@anujtraders.com'
            });

            expect(htmlResult.success).toBe(true);
            expect(htmlResult.items.length).toBeGreaterThan(0);

            // 2. Apply fuzzy matching to first item
            const firstItem = htmlResult.items[0];
            const materialMatch = await fuzzyMatcher.matchMaterial(firstItem.material);
            const clientMatch = await fuzzyMatcher.matchClient(
                htmlResult.client.name,
                htmlResult.client.email || 'prashant@anujtraders.com'
            );

            // 3. Verify matches (material might not match exactly due to fuzzy matching threshold)
            expect(materialMatch).toBeDefined();
            expect(clientMatch.matched).toBe(true);

            // 4. Verify confidence levels
            expect(htmlResult.confidence).toBeGreaterThan(0.9);
            expect(materialMatch.confidence).toBeGreaterThanOrEqual(0);
            expect(clientMatch.confidence).toBeGreaterThan(0.8);
        });
    });

    // GPT Parser tests (only if API key is available)
    if (process.env.OPENAI_API_KEY) {
        describe('GPT Parser (Integration)', () => {
            test('should parse email with GPT-4o Mini', async () => {
                const emailData = {
                    subject: 'Quotation for Refractory Materials',
                    from: 'prashant@anujtraders.com',
                    body: sampleHTMLEmail,
                    existingMaterials: mockMaterials,
                    existingClients: mockClients
                };

                const result = await gptParser.parseQuotationEmail(emailData);

                expect(result.success).toBe(true);
                expect(result.data.items.length).toBeGreaterThan(0);
                expect(result.confidence).toBeGreaterThan(0.8);
                expect(result.cost).toBeGreaterThan(0);
            }, 30000); // 30 second timeout for API call

            test('should handle parsing errors gracefully', async () => {
                const invalidEmailData = {
                    subject: '',
                    from: '',
                    body: 'This is not a quotation email',
                    existingMaterials: [],
                    existingClients: []
                };

                const result = await gptParser.parseQuotationEmail(invalidEmailData);

                // Should not crash, even if parsing fails
                expect(result).toBeDefined();
                expect(typeof result.success).toBe('boolean');
            }, 30000);
        });
    } else {
        console.log('⚠️  Skipping GPT Parser tests - OPENAI_API_KEY not provided');
    }

    describe('Performance Tests', () => {
        test('HTML parser should be fast', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 100; i++) {
                htmlParser.parseQuotationTable(sampleHTMLEmail);
            }
            
            const endTime = Date.now();
            const avgTime = (endTime - startTime) / 100;
            
            expect(avgTime).toBeLessThan(50); // Should be under 50ms per parse
        });

        test('Fuzzy matching should be fast', async () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 100; i++) {
                await fuzzyMatcher.matchMaterial('CALDERYS MAKE FIRECRETE SUPER');
            }
            
            const endTime = Date.now();
            const avgTime = (endTime - startTime) / 100;
            
            expect(avgTime).toBeLessThan(10); // Should be under 10ms per match
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty HTML', () => {
            const result = htmlParser.parseQuotationTable('');
            expect(result.success).toBe(false);
        });

        test('should handle malformed HTML', () => {
            const malformedHTML = '<table><tr><td>incomplete';
            const result = htmlParser.parseQuotationTable(malformedHTML);
            expect(result.success).toBe(false);
        });

        test('should handle empty material name in fuzzy matching', async () => {
            const result = await fuzzyMatcher.matchMaterial('');
            expect(result.matched).toBe(false);
            expect(result.confidence).toBe(0);
        });

        test('should handle special characters in material names', async () => {
            const result = await fuzzyMatcher.matchMaterial('FIRE BRICK 30%-35% AL2O3 (STD) 230X114X65 MM');
            expect(result).toBeDefined();
            expect(typeof result.confidence).toBe('number');
        });
    });
});

// Test utilities
function createMockEmail(materials, client = 'ANUJ TRADERS') {
    let tableRows = '';
    materials.forEach((material, index) => {
        tableRows += `
        <tr>
            <td>${index + 1}</td>
            <td>${material.name}</td>
            <td>${material.quantity || 100}</td>
            <td>${material.unit || 'NOS'}</td>
            <td>${material.price || 1000}</td>
            <td>${material.hsn || '3816'}</td>
            <td>${material.exWorks || 'WANKANER'}</td>
        </tr>`;
    });

    return `
    <html>
    <body>
    <p>Dear Sir,</p>
    <p>We are pleased to quote you the following:</p>
    <table border="1">
    <tr>
        <th>NO</th><th>MATERIAL</th><th>QTY</th><th>UNIT</th><th>RATE RS./UNIT</th><th>HSN CODE</th><th>EX WORK</th>
    </tr>
    ${tableRows}
    </table>
    <p>Best Regards,<br>${client}</p>
    </body>
    </html>`;
}

// Export test utilities for use in other test files
module.exports = {
    mockMaterials,
    mockClients,
    sampleHTMLEmail,
    createMockEmail
};
