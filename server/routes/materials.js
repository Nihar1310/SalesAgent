const express = require('express');
const router = express.Router();

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

    // Create new material
    router.post('/', async (req, res) => {
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

    // Update material
    router.put('/:id', async (req, res) => {
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

    // Delete material
    router.delete('/:id', async (req, res) => {
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

    return router;
};
