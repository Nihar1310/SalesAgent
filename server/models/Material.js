const Database = require('../database/db');

class Material {
    constructor(db) {
        this.db = db;
    }

    async create(materialData) {
        const { name, description, hsnCode, source = 'master' } = materialData;
        const normalizedName = Database.normalizeName(name);

        const sql = `
            INSERT INTO materials (name, description, hsn_code, source, normalized_name)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const result = await this.db.run(sql, [name, description, hsnCode, source, normalizedName]);
        return this.findById(result.id);
    }

    async findById(id) {
        const sql = 'SELECT * FROM materials WHERE id = ?';
        return await this.db.get(sql, [id]);
    }

    async findByNormalizedName(normalizedName, source = null) {
        let sql = 'SELECT * FROM materials WHERE normalized_name = ?';
        let params = [normalizedName];
        
        if (source) {
            sql += ' AND source = ?';
            params.push(source);
        }
        
        sql += ' ORDER BY CASE WHEN source = "master" THEN 1 WHEN source = "manual_ui" THEN 2 ELSE 3 END';
        
        return await this.db.get(sql, params);
    }

    async findOrCreate(materialData) {
        const normalizedName = Database.normalizeName(materialData.name);
        
        // First try to find existing material
        let existing = await this.findByNormalizedName(normalizedName);
        
        if (existing) {
            return existing;
        }
        
        // Create new material
        return await this.create(materialData);
    }

    async getAll(includeSource = false) {
        let sql = 'SELECT * FROM materials ORDER BY name';
        const materials = await this.db.all(sql);
        
        if (!includeSource) {
            return materials.map(m => ({
                id: m.id,
                name: m.name,
                description: m.description,
                hsnCode: m.hsn_code
            }));
        }
        
        return materials;
    }

    async bulkInsert(materialsArray, source = 'master') {
        const results = [];
        
        await this.db.transaction(async () => {
            for (const material of materialsArray) {
                try {
                    const result = await this.create({ ...material, source });
                    results.push(result);
                } catch (error) {
                    // Skip duplicates, log others
                    if (!error.message.includes('UNIQUE constraint')) {
                        console.error('Error inserting material:', material.name, error);
                    }
                }
            }
        });
        
        return results;
    }

    async update(id, updateData) {
        const { name, description, hsnCode } = updateData;
        const normalizedName = name ? Database.normalizeName(name) : null;
        
        const setParts = [];
        const params = [];
        
        if (name) {
            setParts.push('name = ?', 'normalized_name = ?');
            params.push(name, normalizedName);
        }
        if (description !== undefined) {
            setParts.push('description = ?');
            params.push(description);
        }
        if (hsnCode !== undefined) {
            setParts.push('hsn_code = ?');
            params.push(hsnCode);
        }
        
        if (setParts.length === 0) {
            throw new Error('No fields to update');
        }
        
        params.push(id);
        
        const sql = `UPDATE materials SET ${setParts.join(', ')} WHERE id = ?`;
        await this.db.run(sql, params);
        
        return this.findById(id);
    }

    async delete(id) {
        const sql = 'DELETE FROM materials WHERE id = ?';
        const result = await this.db.run(sql, [id]);
        return result.changes > 0;
    }

    async search(query) {
        const searchTerm = `%${query.toLowerCase()}%`;
        const sql = `
            SELECT * FROM materials 
            WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?
            ORDER BY name
        `;
        return await this.db.all(sql, [searchTerm, searchTerm]);
    }
}

module.exports = Material;
