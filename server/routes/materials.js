const express = require('express');
const router = express.Router();
const { blockStaffEdit } = require('../middleware/roleCheck');

module.exports = (materialModel) => {
    // Get all materials
    router.get('/', async (req, res) => {
        try {
            const includeSource = req.query.includeSource === 'true';
            const materials = await materialModel.getAll(includeSource);
            res.json(materials);
        } catch (error) {
            console.error('Error fetching materials:', error);
            res.status(500).json({ error: 'Failed to fetch materials' });
        }
    });

    // Get material by ID
    router.get('/:id', async (req, res) => {
        try {
            const material = await materialModel.findById(req.params.id);
            if (!material) {
                return res.status(404).json({ error: 'Material not found' });
            }
            res.json(material);
        } catch (error) {
            console.error('Error fetching material:', error);
            res.status(500).json({ error: 'Failed to fetch material' });
        }
    });

    // Create new material (admin only)
    router.post('/', blockStaffEdit, async (req, res) => {
        try {
            const { name, description, hsnCode } = req.body;
            
            if (!name) {
                return res.status(400).json({ error: 'Material name is required' });
            }

            const material = await materialModel.create({
                name,
                description,
                hsnCode,
                source: 'manual_ui'
            });

            res.status(201).json(material);
        } catch (error) {
            console.error('Error creating material:', error);
            if (error.message.includes('UNIQUE constraint')) {
                res.status(409).json({ error: 'Material with this name already exists' });
            } else {
                res.status(500).json({ error: 'Failed to create material' });
            }
        }
    });

    // Update material (admin only)
    router.put('/:id', blockStaffEdit, async (req, res) => {
        try {
            const { name, description, hsnCode } = req.body;
            
            const material = await materialModel.update(req.params.id, {
                name,
                description,
                hsnCode
            });

            if (!material) {
                return res.status(404).json({ error: 'Material not found' });
            }

            res.json(material);
        } catch (error) {
            console.error('Error updating material:', error);
            res.status(500).json({ error: 'Failed to update material' });
        }
    });

    // Delete material (admin only)
    router.delete('/:id', blockStaffEdit, async (req, res) => {
        try {
            const deleted = await materialModel.delete(req.params.id);
            if (!deleted) {
                return res.status(404).json({ error: 'Material not found' });
            }
            res.json({ message: 'Material deleted successfully' });
        } catch (error) {
            console.error('Error deleting material:', error);
            res.status(500).json({ error: 'Failed to delete material' });
        }
    });

    // Search materials
    router.get('/search/:query', async (req, res) => {
        try {
            const materials = await materialModel.search(req.params.query);
            res.json(materials);
        } catch (error) {
            console.error('Error searching materials:', error);
            res.status(500).json({ error: 'Failed to search materials' });
        }
    });

    // Merge materials - combines multiple materials into one (admin only)
    router.post('/merge', blockStaffEdit, async (req, res) => {
        try {
            const { keepMaterialId, mergeMaterialIds } = req.body;
            
            if (!keepMaterialId || !mergeMaterialIds || !Array.isArray(mergeMaterialIds) || mergeMaterialIds.length === 0) {
                return res.status(400).json({ error: 'keepMaterialId and mergeMaterialIds array are required' });
            }

            // Verify all materials exist
            const keepMaterial = await materialModel.findById(keepMaterialId);
            if (!keepMaterial) {
                return res.status(404).json({ error: 'Material to keep not found' });
            }

            // Get database instance from model
            const db = materialModel.db;

            // Start transaction
            await db.run('BEGIN TRANSACTION');

            try {
                // For each material to merge, update all price_history entries
                for (const mergeId of mergeMaterialIds) {
                    if (mergeId === keepMaterialId) continue; // Skip if same as keep

                    // Update price_history to point to kept material
                    await db.run(
                        'UPDATE price_history SET material_id = ? WHERE material_id = ?',
                        [keepMaterialId, mergeId]
                    );

                    // Delete the merged material
                    await db.run('DELETE FROM materials WHERE id = ?', [mergeId]);
                }

                await db.run('COMMIT');

                res.json({ 
                    success: true, 
                    message: `Successfully merged ${mergeMaterialIds.length} material(s) into ${keepMaterial.name}`,
                    mergedCount: mergeMaterialIds.length
                });
            } catch (error) {
                await db.run('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error merging materials:', error);
            res.status(500).json({ error: 'Failed to merge materials: ' + error.message });
        }
    });

    return router;
};
