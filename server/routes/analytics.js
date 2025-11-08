const express = require('express');
const router = express.Router();

module.exports = (db, materialModel, clientModel, priceHistoryModel) => {
    // Dashboard overview statistics
    router.get('/dashboard', async (req, res) => {
        try {
            const [
                materialStats,
                clientStats,
                priceStats,
                quoteStats,
                recentActivity
            ] = await Promise.all([
                // Material statistics
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN source = 'master' THEN 1 ELSE 0 END) as master_count,
                        SUM(CASE WHEN source = 'gmail' THEN 1 ELSE 0 END) as gmail_count,
                        SUM(CASE WHEN source = 'manual_ui' THEN 1 ELSE 0 END) as manual_count
                    FROM materials
                `),
                
                // Client statistics
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN source = 'master' THEN 1 ELSE 0 END) as master_count,
                        SUM(CASE WHEN source = 'gmail' THEN 1 ELSE 0 END) as gmail_count,
                        SUM(CASE WHEN source = 'manual_ui' THEN 1 ELSE 0 END) as manual_count
                    FROM clients
                `),
                
                // Price history statistics
                db.get(`
                    SELECT 
                        COUNT(*) as total_entries,
                        COUNT(DISTINCT material_id) as materials_with_prices,
                        COUNT(DISTINCT client_id) as clients_with_prices,
                        AVG(rate_per_unit) as avg_rate,
                        MAX(quoted_at) as last_quote_date
                    FROM price_history
                `),
                
                // Quote statistics
                db.get(`
                    SELECT 
                        COUNT(*) as total_quotes,
                        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_quotes,
                        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_quotes,
                        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_quotes,
                        SUM(total_amount) as total_value
                    FROM quotes
                `),
                
                // Recent activity
                db.all(`
                    SELECT 
                        'price' as type,
                        ph.quoted_at as date,
                        m.name as material_name,
                        c.name as client_name,
                        ph.rate_per_unit as value
                    FROM price_history ph
                    JOIN materials m ON ph.material_id = m.id
                    JOIN clients c ON ph.client_id = c.id
                    WHERE ph.quoted_at >= datetime('now', '-30 days')
                    ORDER BY ph.quoted_at DESC
                    LIMIT 10
                `)
            ]);

            res.json({
                materials: materialStats,
                clients: clientStats,
                prices: priceStats,
                quotes: quoteStats || { total_quotes: 0, draft_quotes: 0, sent_quotes: 0, accepted_quotes: 0, total_value: 0 },
                recentActivity
            });
        } catch (error) {
            console.error('Error fetching dashboard analytics:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
        }
    });

    // Top materials by quote frequency
    router.get('/materials/top', async (req, res) => {
        try {
            const { limit = 10 } = req.query;
            const topMaterials = await db.all(`
                SELECT 
                    m.id,
                    m.name,
                    COUNT(ph.id) as quote_count,
                    AVG(ph.rate_per_unit) as avg_price,
                    MIN(ph.rate_per_unit) as min_price,
                    MAX(ph.rate_per_unit) as max_price,
                    MAX(ph.quoted_at) as last_quoted
                FROM materials m
                LEFT JOIN price_history ph ON m.id = ph.material_id
                GROUP BY m.id, m.name
                HAVING quote_count > 0
                ORDER BY quote_count DESC
                LIMIT ?
            `, [parseInt(limit)]);

            res.json(topMaterials);
        } catch (error) {
            console.error('Error fetching top materials:', error);
            res.status(500).json({ error: 'Failed to fetch top materials' });
        }
    });

    // Top clients by quote value
    router.get('/clients/top', async (req, res) => {
        try {
            const { limit = 10 } = req.query;
            const topClients = await db.all(`
                SELECT 
                    c.id,
                    c.name,
                    COUNT(ph.id) as quote_count,
                    SUM(ph.rate_per_unit * ph.quantity) as total_value,
                    AVG(ph.rate_per_unit) as avg_rate,
                    MAX(ph.quoted_at) as last_quoted
                FROM clients c
                LEFT JOIN price_history ph ON c.id = ph.client_id
                GROUP BY c.id, c.name
                HAVING quote_count > 0
                ORDER BY total_value DESC
                LIMIT ?
            `, [parseInt(limit)]);

            res.json(topClients);
        } catch (error) {
            console.error('Error fetching top clients:', error);
            res.status(500).json({ error: 'Failed to fetch top clients' });
        }
    });

    // Price trends for a material
    router.get('/materials/:id/price-trend', async (req, res) => {
        try {
            const { id } = req.params;
            const { days = 90 } = req.query;
            
            const priceTrend = await db.all(`
                SELECT 
                    DATE(ph.quoted_at) as date,
                    AVG(ph.rate_per_unit) as avg_price,
                    MIN(ph.rate_per_unit) as min_price,
                    MAX(ph.rate_per_unit) as max_price,
                    COUNT(*) as quote_count,
                    c.name as client_name
                FROM price_history ph
                JOIN clients c ON ph.client_id = c.id
                WHERE ph.material_id = ? 
                AND ph.quoted_at >= datetime('now', '-${days} days')
                GROUP BY DATE(ph.quoted_at), c.name
                ORDER BY ph.quoted_at DESC
            `, [id]);

            res.json(priceTrend);
        } catch (error) {
            console.error('Error fetching price trend:', error);
            res.status(500).json({ error: 'Failed to fetch price trend' });
        }
    });

    // Monthly quote summary
    router.get('/quotes/monthly', async (req, res) => {
        try {
            const { months = 12 } = req.query;
            
            const monthlyData = await db.all(`
                SELECT 
                    strftime('%Y-%m', created_at) as month,
                    COUNT(*) as quote_count,
                    SUM(total_amount) as total_value,
                    AVG(total_amount) as avg_value,
                    SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
                    SUM(CASE WHEN status = 'accepted' THEN total_amount ELSE 0 END) as accepted_value
                FROM quotes
                WHERE created_at >= datetime('now', '-${months} months')
                GROUP BY strftime('%Y-%m', created_at)
                ORDER BY month DESC
            `);

            res.json(monthlyData);
        } catch (error) {
            console.error('Error fetching monthly quote data:', error);
            res.status(500).json({ error: 'Failed to fetch monthly quote data' });
        }
    });

    // Gmail ingestion analytics
    router.get('/gmail/performance', async (req, res) => {
        try {
            const [
                ingestionStats,
                recentIngestions,
                errorSummary
            ] = await Promise.all([
                // Overall ingestion statistics
                db.get(`
                    SELECT 
                        COUNT(*) as total_processed,
                        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                        SUM(items_extracted) as total_items_extracted,
                        AVG(items_extracted) as avg_items_per_email,
                        MAX(processed_at) as last_processed
                    FROM gmail_ingestion_log
                `),
                
                // Recent ingestion activity
                db.all(`
                    SELECT *
                    FROM gmail_ingestion_log
                    ORDER BY processed_at DESC
                    LIMIT 20
                `),
                
                // Error summary
                db.all(`
                    SELECT 
                        error_message,
                        COUNT(*) as error_count,
                        MAX(processed_at) as last_occurrence
                    FROM gmail_ingestion_log
                    WHERE status = 'failed'
                    GROUP BY error_message
                    ORDER BY error_count DESC
                    LIMIT 10
                `)
            ]);

            res.json({
                stats: ingestionStats || { total_processed: 0, successful: 0, failed: 0, total_items_extracted: 0 },
                recentActivity: recentIngestions,
                errors: errorSummary
            });
        } catch (error) {
            console.error('Error fetching Gmail analytics:', error);
            res.status(500).json({ error: 'Failed to fetch Gmail analytics' });
        }
    });

    // Search analytics
    router.get('/search/popular', async (req, res) => {
        try {
            // This would require implementing search logging first
            // For now, return top materials and clients by activity
            const [popularMaterials, popularClients] = await Promise.all([
                db.all(`
                    SELECT 
                        m.name,
                        COUNT(ph.id) as search_count
                    FROM materials m
                    LEFT JOIN price_history ph ON m.id = ph.material_id
                    GROUP BY m.id, m.name
                    ORDER BY search_count DESC
                    LIMIT 10
                `),
                
                db.all(`
                    SELECT 
                        c.name,
                        COUNT(ph.id) as search_count
                    FROM clients c
                    LEFT JOIN price_history ph ON c.id = ph.client_id
                    GROUP BY c.id, c.name
                    ORDER BY search_count DESC
                    LIMIT 10
                `)
            ]);

            res.json({
                materials: popularMaterials,
                clients: popularClients
            });
        } catch (error) {
            console.error('Error fetching search analytics:', error);
            res.status(500).json({ error: 'Failed to fetch search analytics' });
        }
    });

    // Data quality metrics
    router.get('/data-quality', async (req, res) => {
        try {
            const [
                materialQuality,
                clientQuality,
                priceQuality
            ] = await Promise.all([
                // Material data quality
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as with_description,
                        SUM(CASE WHEN hsn_code IS NOT NULL AND hsn_code != '' THEN 1 ELSE 0 END) as with_hsn,
                        COUNT(DISTINCT normalized_name) as unique_names
                    FROM materials
                `),
                
                // Client data quality
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as with_email,
                        SUM(CASE WHEN contact IS NOT NULL AND contact != '' THEN 1 ELSE 0 END) as with_contact,
                        COUNT(DISTINCT normalized_name) as unique_names
                    FROM clients
                `),
                
                // Price data quality
                db.get(`
                    SELECT 
                        COUNT(*) as total_entries,
                        COUNT(DISTINCT material_id) as materials_covered,
                        COUNT(DISTINCT client_id) as clients_covered,
                        SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END) as with_quantity,
                        SUM(CASE WHEN ex_works > 0 THEN 1 ELSE 0 END) as with_ex_works,
                        SUM(CASE WHEN delivery_cost > 0 THEN 1 ELSE 0 END) as with_delivery_cost
                    FROM price_history
                `)
            ]);

            res.json({
                materials: materialQuality,
                clients: clientQuality,
                prices: priceQuality || { total_entries: 0, materials_covered: 0, clients_covered: 0 }
            });
        } catch (error) {
            console.error('Error fetching data quality metrics:', error);
            res.status(500).json({ error: 'Failed to fetch data quality metrics' });
        }
    });

    return router;
};


