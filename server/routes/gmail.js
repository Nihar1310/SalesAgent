const express = require('express');
const router = express.Router();

module.exports = (gmailService) => {
    // Get Gmail authentication URL
    router.get('/auth-url', (req, res) => {
        try {
            const authUrl = gmailService.getAuthUrl();
            res.json({ authUrl });
        } catch (error) {
            console.error('Error getting auth URL:', error);
            res.status(500).json({ error: 'Failed to get authentication URL' });
        }
    });

    // Handle OAuth callback
    router.post('/auth-callback', async (req, res) => {
        try {
            const { code } = req.body;
            if (!code) {
                return res.status(400).json({ error: 'Authorization code required' });
            }

            await gmailService.handleAuthCallback(code);
            res.json({ message: 'Gmail authentication successful' });
        } catch (error) {
            console.error('Error handling auth callback:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    });

    // Manually trigger ingestion
    router.post('/ingest', async (req, res) => {
        try {
            const result = await gmailService.runIngestion();
            res.json(result);
        } catch (error) {
            console.error('Error running ingestion:', error);
            res.status(500).json({ error: 'Ingestion failed' });
        }
    });

    // Get ingestion status/history
    router.get('/ingestion-log', async (req, res) => {
        try {
            const { limit = 50 } = req.query;
            const logs = await gmailService.db.all(
                'SELECT * FROM gmail_ingestion_log ORDER BY processed_at DESC LIMIT ?',
                [parseInt(limit)]
            );
            res.json(logs);
        } catch (error) {
            console.error('Error fetching ingestion log:', error);
            res.status(500).json({ error: 'Failed to fetch ingestion log' });
        }
    });

    // Get ingestion statistics
    router.get('/stats', async (req, res) => {
        try {
            const stats = await gmailService.db.get(`
                SELECT 
                    COUNT(*) as total_processed,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(items_extracted) as total_items_extracted,
                    MAX(processed_at) as last_processed
                FROM gmail_ingestion_log
            `);
            
            res.json(stats);
        } catch (error) {
            console.error('Error fetching ingestion stats:', error);
            res.status(500).json({ error: 'Failed to fetch ingestion statistics' });
        }
    });

    // Get review queue items
    router.get('/review-queue', async (req, res) => {
        try {
            const { status = 'pending', search = '', limit = 100 } = req.query;
            
            let query = `
                SELECT * FROM review_queue 
                WHERE 1=1
            `;
            const params = [];
            
            if (status !== 'all') {
                query += ' AND status = ?';
                params.push(status);
            }
            
            if (search) {
                query += ' AND (subject LIKE ? OR sender_email LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            
            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(parseInt(limit));
            
            const items = await gmailService.db.all(query, params);
            
            res.json({ items });
        } catch (error) {
            console.error('Error fetching review queue:', error);
            res.status(500).json({ error: 'Failed to fetch review queue' });
        }
    });

    // Approve a review queue item
    router.post('/review-queue/:id/approve', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Get the item
            const item = await gmailService.db.get(
                'SELECT * FROM review_queue WHERE id = ?',
                [id]
            );
            
            if (!item) {
                return res.status(404).json({ error: 'Review item not found' });
            }
            
            // Parse extracted data and save it
            const extractedData = JSON.parse(item.extracted_data);
            await gmailService.saveWithFuzzyMatching(extractedData, item.thread_id);
            
            // Update review queue item
            await gmailService.db.run(
                `UPDATE review_queue 
                 SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = 'user'
                 WHERE id = ?`,
                [id]
            );
            
            // Learn from approval (high confidence)
            await gmailService.learningService.recordParsingSuccess(
                item.email_id, 
                item.method, 
                1.0, // Boost confidence since human approved
                extractedData.items?.length || 0
            );
            
            res.json({ message: 'Item approved and saved successfully' });
        } catch (error) {
            console.error('Error approving review item:', error);
            res.status(500).json({ error: 'Failed to approve item' });
        }
    });

    // Reject a review queue item
    router.post('/review-queue/:id/reject', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Update review queue item
            const result = await gmailService.db.run(
                `UPDATE review_queue 
                 SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = 'user'
                 WHERE id = ?`,
                [id]
            );
            
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Review item not found' });
            }
            
            res.json({ message: 'Item rejected successfully' });
        } catch (error) {
            console.error('Error rejecting review item:', error);
            res.status(500).json({ error: 'Failed to reject item' });
        }
    });

    // Correct and save a review queue item
    router.post('/review-queue/:id/correct', async (req, res) => {
        try {
            const { id } = req.params;
            const { corrections } = req.body;
            
            // Get the item
            const item = await gmailService.db.get(
                'SELECT * FROM review_queue WHERE id = ?',
                [id]
            );
            
            if (!item) {
                return res.status(404).json({ error: 'Review item not found' });
            }
            
            // Parse and apply corrections to extracted data
            const extractedData = JSON.parse(item.extracted_data);
            const correctedData = { ...extractedData, ...corrections };
            
            // Save corrected data
            await gmailService.saveWithFuzzyMatching(correctedData, item.thread_id);
            
            // Update review queue item
            await gmailService.db.run(
                `UPDATE review_queue 
                 SET status = 'corrected', reviewed_at = datetime('now'), reviewed_by = 'user', corrections = ?
                 WHERE id = ?`,
                [JSON.stringify(corrections), id]
            );
            
            // Learn from corrections
            if (corrections.materials) {
                for (const [originalText, correctedMaterialId] of Object.entries(corrections.materials)) {
                    await gmailService.learningService.learnFromCorrection(originalText, correctedMaterialId);
                }
            }
            
            if (corrections.clients) {
                for (const [originalText, correctedClientId] of Object.entries(corrections.clients)) {
                    await gmailService.learningService.learnClientAlias(originalText, correctedClientId);
                }
            }
            
            res.json({ message: 'Item corrected and saved successfully' });
        } catch (error) {
            console.error('Error correcting review item:', error);
            res.status(500).json({ error: 'Failed to correct item' });
        }
    });

    // Get review queue statistics
    router.get('/review-queue/stats', async (req, res) => {
        try {
            const stats = await gmailService.db.get(`
                SELECT 
                    COUNT(*) as total_items,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN status = 'corrected' THEN 1 ELSE 0 END) as corrected,
                    AVG(confidence) as avg_confidence
                FROM review_queue
            `);
            
            res.json(stats);
        } catch (error) {
            console.error('Error fetching review queue stats:', error);
            res.status(500).json({ error: 'Failed to fetch review queue statistics' });
        }
    });

    return router;
};
