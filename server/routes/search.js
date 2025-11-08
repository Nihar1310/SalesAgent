const express = require('express');
const router = express.Router();

module.exports = (db, materialModel, clientModel, priceHistoryModel) => {
    // Global search across all entities
    router.get('/global', async (req, res) => {
        try {
            const { q, limit = 20 } = req.query;
            
            if (!q || q.trim().length < 2) {
                return res.status(400).json({ error: 'Query must be at least 2 characters long' });
            }

            const searchTerm = `%${q.toLowerCase()}%`;
            
            const [materials, clients, priceHistory] = await Promise.all([
                // Search materials
                db.all(`
                    SELECT 
                        'material' as type,
                        id,
                        name as title,
                        description as subtitle,
                        source,
                        created_at
                    FROM materials 
                    WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?
                    ORDER BY 
                        CASE WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END,
                        name
                    LIMIT ?
                `, [searchTerm, searchTerm, `${q.toLowerCase()}%`, Math.floor(limit / 3)]),
                
                // Search clients
                db.all(`
                    SELECT 
                        'client' as type,
                        id,
                        name as title,
                        email as subtitle,
                        source,
                        created_at
                    FROM clients 
                    WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?
                    ORDER BY 
                        CASE WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END,
                        name
                    LIMIT ?
                `, [searchTerm, searchTerm, `${q.toLowerCase()}%`, Math.floor(limit / 3)]),
                
                // Search price history (recent quotes)
                db.all(`
                    SELECT 
                        'quote' as type,
                        ph.id,
                        m.name || ' - ' || c.name as title,
                        '₹' || ph.rate_per_unit || ' per ' || ph.unit as subtitle,
                        ph.source,
                        ph.quoted_at as created_at
                    FROM price_history ph
                    JOIN materials m ON ph.material_id = m.id
                    JOIN clients c ON ph.client_id = c.id
                    WHERE LOWER(m.name) LIKE ? OR LOWER(c.name) LIKE ?
                    ORDER BY ph.quoted_at DESC
                    LIMIT ?
                `, [searchTerm, searchTerm, Math.floor(limit / 3)])
            ]);

            const results = [...materials, ...clients, ...priceHistory]
                .sort((a, b) => {
                    // Prioritize exact matches
                    const aExact = a.title.toLowerCase().includes(q.toLowerCase());
                    const bExact = b.title.toLowerCase().includes(q.toLowerCase());
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    
                    // Then by recency
                    return new Date(b.created_at) - new Date(a.created_at);
                })
                .slice(0, limit);

            res.json({
                query: q,
                total: results.length,
                results: results
            });
        } catch (error) {
            console.error('Error performing global search:', error);
            res.status(500).json({ error: 'Search failed' });
        }
    });

    // Advanced material search
    router.get('/materials', async (req, res) => {
        try {
            const { 
                q, 
                source, 
                hasDescription, 
                hasHsn, 
                hasPrices,
                sortBy = 'name',
                sortOrder = 'asc',
                limit = 50,
                offset = 0
            } = req.query;

            let sql = `
                SELECT 
                    m.*,
                    COUNT(ph.id) as quote_count,
                    AVG(ph.rate_per_unit) as avg_price,
                    MAX(ph.quoted_at) as last_quoted
                FROM materials m
                LEFT JOIN price_history ph ON m.id = ph.material_id
            `;
            
            const conditions = [];
            const params = [];

            // Text search
            if (q && q.trim().length > 0) {
                conditions.push('(LOWER(m.name) LIKE ? OR LOWER(m.description) LIKE ?)');
                const searchTerm = `%${q.toLowerCase()}%`;
                params.push(searchTerm, searchTerm);
            }

            // Source filter
            if (source) {
                conditions.push('m.source = ?');
                params.push(source);
            }

            // Description filter
            if (hasDescription === 'true') {
                conditions.push('m.description IS NOT NULL AND m.description != ""');
            } else if (hasDescription === 'false') {
                conditions.push('(m.description IS NULL OR m.description = "")');
            }

            // HSN filter
            if (hasHsn === 'true') {
                conditions.push('m.hsn_code IS NOT NULL AND m.hsn_code != ""');
            } else if (hasHsn === 'false') {
                conditions.push('(m.hsn_code IS NULL OR m.hsn_code = "")');
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            sql += ' GROUP BY m.id, m.name, m.description, m.hsn_code, m.source, m.created_at, m.updated_at';

            // Price filter (after GROUP BY)
            if (hasPrices === 'true') {
                sql += ' HAVING quote_count > 0';
            } else if (hasPrices === 'false') {
                sql += ' HAVING quote_count = 0';
            }

            // Sorting
            const validSortFields = ['name', 'created_at', 'quote_count', 'avg_price', 'last_quoted'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
            const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
            
            sql += ` ORDER BY ${sortField} ${order}`;
            sql += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const materials = await db.all(sql, params);

            // Get total count for pagination
            let countSql = 'SELECT COUNT(DISTINCT m.id) as total FROM materials m';
            if (conditions.length > 0) {
                countSql += ' WHERE ' + conditions.join(' AND ');
            }
            
            const countResult = await db.get(countSql, params.slice(0, -2)); // Remove limit/offset params
            
            res.json({
                materials,
                pagination: {
                    total: countResult.total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: (parseInt(offset) + parseInt(limit)) < countResult.total
                }
            });
        } catch (error) {
            console.error('Error searching materials:', error);
            res.status(500).json({ error: 'Material search failed' });
        }
    });

    // Advanced client search
    router.get('/clients', async (req, res) => {
        try {
            const { 
                q, 
                source, 
                hasEmail, 
                hasContact, 
                hasQuotes,
                sortBy = 'name',
                sortOrder = 'asc',
                limit = 50,
                offset = 0
            } = req.query;

            let sql = `
                SELECT 
                    c.*,
                    COUNT(ph.id) as quote_count,
                    SUM(ph.rate_per_unit * ph.quantity) as total_value,
                    MAX(ph.quoted_at) as last_quoted
                FROM clients c
                LEFT JOIN price_history ph ON c.id = ph.client_id
            `;
            
            const conditions = [];
            const params = [];

            // Text search
            if (q && q.trim().length > 0) {
                conditions.push('(LOWER(c.name) LIKE ? OR LOWER(c.email) LIKE ? OR LOWER(c.contact) LIKE ?)');
                const searchTerm = `%${q.toLowerCase()}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            // Source filter
            if (source) {
                conditions.push('c.source = ?');
                params.push(source);
            }

            // Email filter
            if (hasEmail === 'true') {
                conditions.push('c.email IS NOT NULL AND c.email != ""');
            } else if (hasEmail === 'false') {
                conditions.push('(c.email IS NULL OR c.email = "")');
            }

            // Contact filter
            if (hasContact === 'true') {
                conditions.push('c.contact IS NOT NULL AND c.contact != ""');
            } else if (hasContact === 'false') {
                conditions.push('(c.contact IS NULL OR c.contact = "")');
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            sql += ' GROUP BY c.id, c.name, c.email, c.contact, c.source, c.created_at, c.updated_at';

            // Quotes filter (after GROUP BY)
            if (hasQuotes === 'true') {
                sql += ' HAVING quote_count > 0';
            } else if (hasQuotes === 'false') {
                sql += ' HAVING quote_count = 0';
            }

            // Sorting
            const validSortFields = ['name', 'created_at', 'quote_count', 'total_value', 'last_quoted'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
            const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
            
            sql += ` ORDER BY ${sortField} ${order}`;
            sql += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const clients = await db.all(sql, params);

            // Get total count for pagination
            let countSql = 'SELECT COUNT(DISTINCT c.id) as total FROM clients c';
            if (conditions.length > 0) {
                countSql += ' WHERE ' + conditions.join(' AND ');
            }
            
            const countResult = await db.get(countSql, params.slice(0, -2));
            
            res.json({
                clients,
                pagination: {
                    total: countResult.total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: (parseInt(offset) + parseInt(limit)) < countResult.total
                }
            });
        } catch (error) {
            console.error('Error searching clients:', error);
            res.status(500).json({ error: 'Client search failed' });
        }
    });

    // Price history search
    router.get('/prices', async (req, res) => {
        try {
            const { 
                materialId,
                clientId,
                minPrice,
                maxPrice,
                dateFrom,
                dateTo,
                source,
                sortBy = 'quoted_at',
                sortOrder = 'desc',
                limit = 50,
                offset = 0
            } = req.query;

            let sql = `
                SELECT 
                    ph.*,
                    m.name as material_name,
                    c.name as client_name
                FROM price_history ph
                JOIN materials m ON ph.material_id = m.id
                JOIN clients c ON ph.client_id = c.id
            `;
            
            const conditions = [];
            const params = [];

            // Material filter
            if (materialId) {
                conditions.push('ph.material_id = ?');
                params.push(materialId);
            }

            // Client filter
            if (clientId) {
                conditions.push('ph.client_id = ?');
                params.push(clientId);
            }

            // Price range filter
            if (minPrice) {
                conditions.push('ph.rate_per_unit >= ?');
                params.push(parseFloat(minPrice));
            }
            if (maxPrice) {
                conditions.push('ph.rate_per_unit <= ?');
                params.push(parseFloat(maxPrice));
            }

            // Date range filter
            if (dateFrom) {
                conditions.push('ph.quoted_at >= ?');
                params.push(dateFrom);
            }
            if (dateTo) {
                conditions.push('ph.quoted_at <= ?');
                params.push(dateTo);
            }

            // Source filter
            if (source) {
                conditions.push('ph.source = ?');
                params.push(source);
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            // Sorting
            const validSortFields = ['quoted_at', 'rate_per_unit', 'quantity', 'material_name', 'client_name'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'quoted_at';
            const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
            
            sql += ` ORDER BY ${sortField} ${order}`;
            sql += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const prices = await db.all(sql, params);

            // Get total count
            let countSql = 'SELECT COUNT(*) as total FROM price_history ph';
            if (conditions.length > 0) {
                countSql += ' WHERE ' + conditions.join(' AND ');
            }
            
            const countResult = await db.get(countSql, params.slice(0, -2));
            
            res.json({
                prices,
                pagination: {
                    total: countResult.total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: (parseInt(offset) + parseInt(limit)) < countResult.total
                }
            });
        } catch (error) {
            console.error('Error searching price history:', error);
            res.status(500).json({ error: 'Price search failed' });
        }
    });

    // Search suggestions/autocomplete
    router.get('/suggestions', async (req, res) => {
        try {
            const { q, type = 'all', limit = 10 } = req.query;
            
            if (!q || q.trim().length < 1) {
                return res.json({ suggestions: [] });
            }

            const searchTerm = `${q.toLowerCase()}%`;
            const suggestions = [];

            if (type === 'all' || type === 'materials') {
                const materials = await db.all(`
                    SELECT 'material' as type, name as value, id
                    FROM materials 
                    WHERE LOWER(name) LIKE ?
                    ORDER BY name
                    LIMIT ?
                `, [searchTerm, Math.floor(limit / 2)]);
                suggestions.push(...materials);
            }

            if (type === 'all' || type === 'clients') {
                const clients = await db.all(`
                    SELECT 'client' as type, name as value, id
                    FROM clients 
                    WHERE LOWER(name) LIKE ?
                    ORDER BY name
                    LIMIT ?
                `, [searchTerm, Math.floor(limit / 2)]);
                suggestions.push(...clients);
            }

            res.json({ 
                suggestions: suggestions.slice(0, limit)
            });
        } catch (error) {
            console.error('Error fetching search suggestions:', error);
            res.status(500).json({ error: 'Failed to fetch suggestions' });
        }
    });

    return router;
};


