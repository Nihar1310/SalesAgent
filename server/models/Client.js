const Database = require('../database/db');

class Client {
    constructor(db) {
        this.db = db;
    }

    async create(clientData) {
        const { name, email, contact, source = 'master' } = clientData;
        const normalizedName = Database.normalizeName(name);

        const sql = `
            INSERT INTO clients (name, email, contact, source, normalized_name)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const result = await this.db.run(sql, [name, email, contact, source, normalizedName]);
        return this.findById(result.id);
    }

    async findById(id) {
        const sql = 'SELECT * FROM clients WHERE id = ?';
        return await this.db.get(sql, [id]);
    }

    async findByNormalizedName(normalizedName, source = null) {
        let sql = 'SELECT * FROM clients WHERE normalized_name = ?';
        let params = [normalizedName];
        
        if (source) {
            sql += ' AND source = ?';
            params.push(source);
        }
        
        sql += ' ORDER BY CASE WHEN source = "master" THEN 1 WHEN source = "manual_ui" THEN 2 ELSE 3 END';
        
        return await this.db.get(sql, params);
    }

    async findByEmail(email) {
        const sql = 'SELECT * FROM clients WHERE email = ? ORDER BY CASE WHEN source = "master" THEN 1 WHEN source = "manual_ui" THEN 2 ELSE 3 END';
        return await this.db.get(sql, [email]);
    }

    async findOrCreate(clientData) {
        const normalizedName = Database.normalizeName(clientData.name);
        
        // First try to find by normalized name
        let existing = await this.findByNormalizedName(normalizedName);
        
        if (existing) {
            return existing;
        }
        
        // If email provided, try to find by email
        if (clientData.email) {
            existing = await this.findByEmail(clientData.email);
            if (existing) {
                return existing;
            }
        }
        
        // Create new client
        return await this.create(clientData);
    }

    async getAll(includeSource = false) {
        let sql = 'SELECT * FROM clients ORDER BY name';
        const clients = await this.db.all(sql);
        
        if (!includeSource) {
            return clients.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email,
                contact: c.contact
            }));
        }
        
        return clients;
    }

    async bulkInsert(clientsArray, source = 'master') {
        const results = [];
        
        await this.db.transaction(async () => {
            for (const client of clientsArray) {
                try {
                    const result = await this.create({ ...client, source });
                    results.push(result);
                } catch (error) {
                    // Skip duplicates, log others
                    if (!error.message.includes('UNIQUE constraint')) {
                        console.error('Error inserting client:', client.name, error);
                    }
                }
            }
        });
        
        return results;
    }

    async update(id, updateData) {
        const { name, email, contact } = updateData;
        const normalizedName = name ? Database.normalizeName(name) : null;
        
        const setParts = [];
        const params = [];
        
        if (name) {
            setParts.push('name = ?', 'normalized_name = ?');
            params.push(name, normalizedName);
        }
        if (email !== undefined) {
            setParts.push('email = ?');
            params.push(email);
        }
        if (contact !== undefined) {
            setParts.push('contact = ?');
            params.push(contact);
        }
        
        if (setParts.length === 0) {
            throw new Error('No fields to update');
        }
        
        params.push(id);
        
        const sql = `UPDATE clients SET ${setParts.join(', ')} WHERE id = ?`;
        await this.db.run(sql, params);
        
        return this.findById(id);
    }

    async delete(id) {
        const sql = 'DELETE FROM clients WHERE id = ?';
        const result = await this.db.run(sql, [id]);
        return result.changes > 0;
    }

    async search(query) {
        const searchTerm = `%${query.toLowerCase()}%`;
        const sql = `
            SELECT * FROM clients 
            WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(contact) LIKE ?
            ORDER BY name
        `;
        return await this.db.all(sql, [searchTerm, searchTerm, searchTerm]);
    }
}

module.exports = Client;
