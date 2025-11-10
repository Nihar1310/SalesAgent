const express = require('express');
const router = express.Router();
const { blockStaffEdit } = require('../middleware/roleCheck');

module.exports = (clientModel) => {
    // Get all clients
    router.get('/', async (req, res) => {
        try {
            const includeSource = req.query.includeSource === 'true';
            const clients = await clientModel.getAll(includeSource);
            res.json(clients);
        } catch (error) {
            console.error('Error fetching clients:', error);
            res.status(500).json({ error: 'Failed to fetch clients' });
        }
    });

    // Get client by ID
    router.get('/:id', async (req, res) => {
        try {
            const client = await clientModel.findById(req.params.id);
            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }
            res.json(client);
        } catch (error) {
            console.error('Error fetching client:', error);
            res.status(500).json({ error: 'Failed to fetch client' });
        }
    });

    // Create new client (admin only)
    router.post('/', blockStaffEdit, async (req, res) => {
        try {
            const { name, email, contact } = req.body;
            
            if (!name) {
                return res.status(400).json({ error: 'Client name is required' });
            }

            const client = await clientModel.create({
                name,
                email,
                contact,
                source: 'manual_ui'
            });

            res.status(201).json(client);
        } catch (error) {
            console.error('Error creating client:', error);
            if (error.message.includes('UNIQUE constraint')) {
                res.status(409).json({ error: 'Client with this name already exists' });
            } else {
                res.status(500).json({ error: 'Failed to create client' });
            }
        }
    });

    // Update client (admin only)
    router.put('/:id', blockStaffEdit, async (req, res) => {
        try {
            const { name, email, contact } = req.body;
            
            const client = await clientModel.update(req.params.id, {
                name,
                email,
                contact
            });

            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json(client);
        } catch (error) {
            console.error('Error updating client:', error);
            res.status(500).json({ error: 'Failed to update client' });
        }
    });

    // Delete client (admin only)
    router.delete('/:id', blockStaffEdit, async (req, res) => {
        try {
            const deleted = await clientModel.delete(req.params.id);
            if (!deleted) {
                return res.status(404).json({ error: 'Client not found' });
            }
            res.json({ message: 'Client deleted successfully' });
        } catch (error) {
            console.error('Error deleting client:', error);
            res.status(500).json({ error: 'Failed to delete client' });
        }
    });

    // Search clients
    router.get('/search/:query', async (req, res) => {
        try {
            const clients = await clientModel.search(req.params.query);
            res.json(clients);
        } catch (error) {
            console.error('Error searching clients:', error);
            res.status(500).json({ error: 'Failed to search clients' });
        }
    });

    return router;
};
