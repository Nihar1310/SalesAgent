#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Add the server directory to the module path
const serverDir = path.join(__dirname, '..');
require('module').globalPaths.push(path.join(serverDir, 'node_modules'));

// Load environment variables
require('dotenv').config({ path: path.join(serverDir, '..', '.env') });

// Import required modules
const Database = require('../database/db');
const Material = require('../models/Material');
const Client = require('../models/Client');
const PriceHistory = require('../models/PriceHistory');
const GmailIngestionService = require('../services/GmailIngestionService');

class HistoricalEmailImporter {
    constructor() {
        this.db = null;
        this.materialModel = null;
        this.clientModel = null;
        this.priceHistoryModel = null;
        this.gmailService = null;
        
        this.stats = {
            totalEmails: 0,
            processedEmails: 0,
            successfulEmails: 0,
            failedEmails: 0,
            skippedEmails: 0,
            newMaterials: 0,
            newClients: 0,
            newPriceEntries: 0,
            totalCost: 0,
            reviewQueueItems: 0,
            startTime: null,
            endTime: null
        };
        
        this.batchSize = 50;
        this.maxEmails = 2000; // Safety limit
        this.dateRange = {
            from: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years ago
            to: new Date()
        };
    }

    async initialize() {
        console.log('🚀 Initializing Historical Email Importer...\n');
        
        try {
            // Initialize database
            this.db = new Database();
            await this.db.connect();
            
            // Initialize models
            this.materialModel = new Material(this.db);
            this.clientModel = new Client(this.db);
            this.priceHistoryModel = new PriceHistory(this.db);
            
            // Initialize Gmail service
            this.gmailService = new GmailIngestionService(
                this.db, 
                this.materialModel, 
                this.clientModel, 
                this.priceHistoryModel
            );
            
            await this.gmailService.initialize();
            
            if (!this.gmailService.gmail) {
                throw new Error('Gmail API not authenticated. Please run authentication first.');
            }
            
            console.log('✅ Initialization complete\n');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            throw error;
        }
    }

    async importHistoricalEmails() {
        this.stats.startTime = new Date();
        
        console.log('📧 Starting historical email import...');
        console.log(`📅 Date range: ${this.dateRange.from.toDateString()} to ${this.dateRange.to.toDateString()}`);
        console.log(`📦 Batch size: ${this.batchSize}`);
        console.log(`🔢 Max emails: ${this.maxEmails}\n`);
        
        try {
            // Get list of historical emails
            const emailList = await this.getHistoricalEmails();
            this.stats.totalEmails = emailList.length;
            
            console.log(`📊 Found ${this.stats.totalEmails} historical emails\n`);
            
            if (this.stats.totalEmails === 0) {
                console.log('ℹ️  No historical emails found to process');
                return this.generateReport();
            }
            
            // Process emails in batches
            await this.processEmailsInBatches(emailList);
            
            this.stats.endTime = new Date();
            
            console.log('\n🎉 Historical import completed!');
            return this.generateReport();
            
        } catch (error) {
            console.error('\n❌ Historical import failed:', error.message);
            this.stats.endTime = new Date();
            return this.generateReport();
        }
    }

    async getHistoricalEmails() {
        console.log('🔍 Searching for historical quotation emails...');
        
        const fromDate = this.formatGmailDate(this.dateRange.from);
        const toDate = this.formatGmailDate(this.dateRange.to);
        
        // Build Gmail search query
        const queries = [
            `subject:(quotation OR quote OR price OR proposal) after:${fromDate} before:${toDate}`,
            `from:prashant body:(quotation OR quote OR price) after:${fromDate} before:${toDate}`,
            `from:anujtraders after:${fromDate} before:${toDate}`
        ];
        
        const allEmails = new Set();
        
        for (const query of queries) {
            try {
                console.log(`   Searching: ${query}`);
                
                let pageToken = null;
                let queryResults = 0;
                
                do {
                    const response = await this.gmailService.gmail.users.messages.list({
                        userId: 'me',
                        q: query,
                        maxResults: 500,
                        pageToken: pageToken
                    });
                    
                    if (response.data.messages) {
                        response.data.messages.forEach(msg => {
                            allEmails.add(msg.id);
                        });
                        queryResults += response.data.messages.length;
                    }
                    
                    pageToken = response.data.nextPageToken;
                    
                } while (pageToken && allEmails.size < this.maxEmails);
                
                console.log(`   Found: ${queryResults} emails`);
                
            } catch (error) {
                console.error(`   Error with query "${query}":`, error.message);
            }
        }
        
        const emailList = Array.from(allEmails).slice(0, this.maxEmails);
        console.log(`📧 Total unique emails: ${emailList.length}`);
        
        return emailList;
    }

    async processEmailsInBatches(emailList) {
        const totalBatches = Math.ceil(emailList.length / this.batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batchStart = batchIndex * this.batchSize;
            const batchEnd = Math.min(batchStart + this.batchSize, emailList.length);
            const batch = emailList.slice(batchStart, batchEnd);
            
            console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} emails)`);
            
            const batchStats = await this.processBatch(batch, batchIndex + 1);
            
            // Update overall stats
            this.stats.processedEmails += batchStats.processed;
            this.stats.successfulEmails += batchStats.successful;
            this.stats.failedEmails += batchStats.failed;
            this.stats.skippedEmails += batchStats.skipped;
            this.stats.newMaterials += batchStats.newMaterials;
            this.stats.newClients += batchStats.newClients;
            this.stats.newPriceEntries += batchStats.newPriceEntries;
            this.stats.totalCost += batchStats.cost;
            this.stats.reviewQueueItems += batchStats.reviewQueueItems;
            
            // Progress report
            const progress = ((batchIndex + 1) / totalBatches * 100).toFixed(1);
            console.log(`   ✅ Batch complete: ${batchStats.successful}/${batch.length} successful`);
            console.log(`   📊 Overall progress: ${progress}% (${this.stats.processedEmails}/${this.stats.totalEmails})`);
            console.log(`   💰 Cost so far: $${this.stats.totalCost.toFixed(4)}`);
            
            // Small delay between batches to avoid rate limits
            if (batchIndex < totalBatches - 1) {
                await this.sleep(1000);
            }
        }
    }

    async processBatch(emailIds, batchNumber) {
        const batchStats = {
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            newMaterials: 0,
            newClients: 0,
            newPriceEntries: 0,
            cost: 0,
            reviewQueueItems: 0
        };
        
        for (let i = 0; i < emailIds.length; i++) {
            const emailId = emailIds[i];
            
            try {
                // Check if already processed
                const existing = await this.db.get(
                    'SELECT id FROM gmail_ingestion_log WHERE message_id = ?',
                    [emailId]
                );
                
                if (existing) {
                    batchStats.skipped++;
                    continue;
                }
                
                // Process the email
                const result = await this.gmailService.processEmail(emailId);
                
                batchStats.processed++;
                batchStats.successful++;
                batchStats.newMaterials += result.newMaterials || 0;
                batchStats.newClients += result.newClients || 0;
                batchStats.newPriceEntries += result.newPriceEntries || 0;
                batchStats.cost += result.cost || 0;
                
                // Check if added to review queue
                if (result.confidence < 0.90) {
                    batchStats.reviewQueueItems++;
                }
                
                // Progress indicator within batch
                if ((i + 1) % 10 === 0 || i === emailIds.length - 1) {
                    process.stdout.write(`   📧 ${i + 1}/${emailIds.length} emails processed\r`);
                }
                
            } catch (error) {
                batchStats.processed++;
                batchStats.failed++;
                console.error(`\n   ❌ Error processing email ${emailId}:`, error.message);
            }
        }
        
        console.log(); // New line after progress indicator
        return batchStats;
    }

    formatGmailDate(date) {
        return date.toISOString().split('T')[0].replace(/-/g, '/');
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        const duration = this.stats.endTime ? 
            (this.stats.endTime - this.stats.startTime) / 1000 : 0;
        
        const report = {
            summary: {
                totalEmails: this.stats.totalEmails,
                processedEmails: this.stats.processedEmails,
                successfulEmails: this.stats.successfulEmails,
                failedEmails: this.stats.failedEmails,
                skippedEmails: this.stats.skippedEmails,
                successRate: this.stats.processedEmails > 0 ? 
                    (this.stats.successfulEmails / this.stats.processedEmails * 100).toFixed(1) + '%' : '0%'
            },
            dataExtracted: {
                newMaterials: this.stats.newMaterials,
                newClients: this.stats.newClients,
                newPriceEntries: this.stats.newPriceEntries,
                reviewQueueItems: this.stats.reviewQueueItems
            },
            performance: {
                totalCost: '$' + this.stats.totalCost.toFixed(4),
                avgCostPerEmail: this.stats.processedEmails > 0 ? 
                    '$' + (this.stats.totalCost / this.stats.processedEmails).toFixed(6) : '$0',
                processingTime: duration > 0 ? `${Math.round(duration)}s` : 'N/A',
                emailsPerSecond: duration > 0 ? 
                    (this.stats.processedEmails / duration).toFixed(2) : 'N/A'
            },
            recommendations: this.generateRecommendations()
        };
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 HISTORICAL IMPORT REPORT');
        console.log('='.repeat(60));
        
        console.log('\n📈 SUMMARY:');
        Object.entries(report.summary).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        
        console.log('\n📦 DATA EXTRACTED:');
        Object.entries(report.dataExtracted).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        
        console.log('\n⚡ PERFORMANCE:');
        Object.entries(report.performance).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        
        if (report.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            report.recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Save report to file
        const reportPath = path.join(__dirname, '..', '..', 'historical_import_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
        
        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.stats.reviewQueueItems > this.stats.successfulEmails * 0.1) {
            recommendations.push('High number of items in review queue - consider reviewing parsing rules');
        }
        
        if (this.stats.failedEmails > this.stats.processedEmails * 0.05) {
            recommendations.push('High failure rate - check error logs and improve error handling');
        }
        
        if (this.stats.totalCost > 5.0) {
            recommendations.push('High processing cost - consider optimizing HTML parser to reduce GPT usage');
        }
        
        if (this.stats.newMaterials > this.stats.newPriceEntries * 0.5) {
            recommendations.push('Many new materials without prices - review material extraction logic');
        }
        
        if (this.stats.reviewQueueItems > 0) {
            recommendations.push(`Review ${this.stats.reviewQueueItems} items in the review queue to improve future accuracy`);
        }
        
        return recommendations;
    }

    async cleanup() {
        if (this.db) {
            await this.db.close();
        }
    }
}

// Main execution
async function main() {
    const importer = new HistoricalEmailImporter();
    
    try {
        await importer.initialize();
        const report = await importer.importHistoricalEmails();
        
        console.log('\n✅ Import completed successfully!');
        
        if (report.dataExtracted.reviewQueueItems > 0) {
            console.log(`\n🔍 Next steps: Review ${report.dataExtracted.reviewQueueItems} items in the Gmail Review Queue`);
            console.log('   Visit: http://localhost:3000/gmail-review');
        }
        
    } catch (error) {
        console.error('\n💥 Import failed:', error.message);
        process.exit(1);
    } finally {
        await importer.cleanup();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n⏹️  Import interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\n⏹️  Import terminated');
    process.exit(0);
});

// Run the import
if (require.main === module) {
    main().catch(console.error);
}

module.exports = HistoricalEmailImporter;


