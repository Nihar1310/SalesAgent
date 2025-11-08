const Database = require('../database/db');

class PriceHistory {
    constructor(db) {
        this.db = db;
    }

    async create(priceData) {
        const {
            materialId,
            clientId,
            ratePerUnit,
            currency = 'INR',
            unit,
            quantity,
            exWorks,
            deliveryCost,
            quotedAt,
            source = 'manual_ui',
            emailThreadId
        } = priceData;

        const sql = `
            INSERT INTO price_history 
            (material_id, client_id, rate_per_unit, currency, unit, quantity, 
             ex_works, delivery_cost, quoted_at, source, email_thread_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await this.db.run(sql, [
            materialId, clientId, ratePerUnit, currency, unit, quantity,
            exWorks, deliveryCost, quotedAt, source, emailThreadId
        ]);
        
        return this.findById(result.id);
    }

    async findById(id) {
        const sql = `
            SELECT ph.*, m.name as material_name, c.name as client_name
            FROM price_history ph
            JOIN materials m ON ph.material_id = m.id
            JOIN clients c ON ph.client_id = c.id
            WHERE ph.id = ?
        `;
        return await this.db.get(sql, [id]);
    }

    async getLatestPrice(materialId, clientId = null) {
        let sql, params;
        
        if (clientId) {
            // First try to find price for this specific client + material
            sql = `
                SELECT ph.*, m.name as material_name, c.name as client_name
                FROM price_history ph
                JOIN materials m ON ph.material_id = m.id
                JOIN clients c ON ph.client_id = c.id
                WHERE ph.material_id = ? AND ph.client_id = ?
                ORDER BY ph.quoted_at DESC
                LIMIT 1
            `;
            params = [materialId, clientId];
            
            const clientSpecificPrice = await this.db.get(sql, params);
            if (clientSpecificPrice) {
                return clientSpecificPrice;
            }
        }
        
        // Fallback to latest price for this material (any client)
        sql = `
            SELECT ph.*, m.name as material_name, c.name as client_name
            FROM price_history ph
            JOIN materials m ON ph.material_id = m.id
            JOIN clients c ON ph.client_id = c.id
            WHERE ph.material_id = ?
            ORDER BY ph.quoted_at DESC
            LIMIT 1
        `;
        params = [materialId];
        
        return await this.db.get(sql, params);
    }

    async getPriceHistory(materialId, clientId = null, limit = 10) {
        let sql = `
            SELECT ph.*, m.name as material_name, c.name as client_name
            FROM price_history ph
            JOIN materials m ON ph.material_id = m.id
            JOIN clients c ON ph.client_id = c.id
            WHERE ph.material_id = ?
        `;
        let params = [materialId];
        
        if (clientId) {
            sql += ' AND ph.client_id = ?';
            params.push(clientId);
        }
        
        sql += ' ORDER BY ph.quoted_at DESC LIMIT ?';
        params.push(limit);
        
        return await this.db.all(sql, params);
    }

    async getClientPriceHistory(clientId, limit = 50) {
        const sql = `
            SELECT ph.*, m.name as material_name, c.name as client_name
            FROM price_history ph
            JOIN materials m ON ph.material_id = m.id
            JOIN clients c ON ph.client_id = c.id
            WHERE ph.client_id = ?
            ORDER BY ph.quoted_at DESC
            LIMIT ?
        `;
        
        return await this.db.all(sql, [clientId, limit]);
    }

    async bulkInsert(priceHistoryArray) {
        const results = [];
        
        await this.db.transaction(async () => {
            for (const priceData of priceHistoryArray) {
                try {
                    const result = await this.create(priceData);
                    results.push(result);
                } catch (error) {
                    console.error('Error inserting price history:', error);
                }
            }
        });
        
        return results;
    }

    async getRecentActivity(days = 30, limit = 100) {
        const sql = `
            SELECT ph.*, m.name as material_name, c.name as client_name
            FROM price_history ph
            JOIN materials m ON ph.material_id = m.id
            JOIN clients c ON ph.client_id = c.id
            WHERE ph.quoted_at >= datetime('now', '-${days} days')
            ORDER BY ph.quoted_at DESC
            LIMIT ?
        `;
        
        return await this.db.all(sql, [limit]);
    }

    async getMaterialStats(materialId) {
        const sql = `
            SELECT 
                COUNT(*) as quote_count,
                MIN(rate_per_unit) as min_price,
                MAX(rate_per_unit) as max_price,
                AVG(rate_per_unit) as avg_price,
                COUNT(DISTINCT client_id) as client_count,
                MAX(quoted_at) as last_quoted
            FROM price_history 
            WHERE material_id = ?
        `;
        
        return await this.db.get(sql, [materialId]);
    }

    async getClientStats(clientId) {
        const sql = `
            SELECT 
                COUNT(*) as quote_count,
                COUNT(DISTINCT material_id) as material_count,
                SUM(rate_per_unit * quantity) as total_value,
                MAX(quoted_at) as last_quoted
            FROM price_history 
            WHERE client_id = ?
        `;
        
        return await this.db.get(sql, [clientId]);
    }

    async delete(id) {
        const sql = 'DELETE FROM price_history WHERE id = ?';
        const result = await this.db.run(sql, [id]);
        return result.changes > 0;
    }
}

module.exports = PriceHistory;
