const express = require('express');
const router = express.Router();

module.exports = (db, materialModel, clientModel, priceHistoryModel) => {
    // Get all quotes
    router.get('/', async (req, res) => {
        try {
            const { status, clientId, limit = 50 } = req.query;
            let sql = `
                SELECT q.*, c.name as client_name 
                FROM quotes q
                JOIN clients c ON q.client_id = c.id
            `;
            const params = [];

            const conditions = [];
            if (status) {
                conditions.push('q.status = ?');
                params.push(status);
            }
            if (clientId) {
                conditions.push('q.client_id = ?');
                params.push(clientId);
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            sql += ' ORDER BY q.created_at DESC LIMIT ?';
            params.push(parseInt(limit));

            const quotes = await db.all(sql, params);
            res.json(quotes);
        } catch (error) {
            console.error('Error fetching quotes:', error);
            res.status(500).json({ error: 'Failed to fetch quotes' });
        }
    });

    // Get quote by ID with line items
    router.get('/:id', async (req, res) => {
        try {
            const quote = await db.get(`
                SELECT q.*, c.name as client_name, c.email as client_email
                FROM quotes q
                JOIN clients c ON q.client_id = c.id
                WHERE q.id = ?
            `, [req.params.id]);

            if (!quote) {
                return res.status(404).json({ error: 'Quote not found' });
            }

            const items = await db.all(`
                SELECT qi.*, m.name as material_name, m.description as material_description
                FROM quote_items qi
                JOIN materials m ON qi.material_id = m.id
                WHERE qi.quote_id = ?
                ORDER BY qi.created_at
            `, [req.params.id]);

            quote.items = items;
            res.json(quote);
        } catch (error) {
            console.error('Error fetching quote:', error);
            res.status(500).json({ error: 'Failed to fetch quote' });
        }
    });

    // Create new quote
    router.post('/', async (req, res) => {
        try {
            const { clientId, quoteNumber, items, notes } = req.body;

            if (!clientId || !items || items.length === 0) {
                return res.status(400).json({ 
                    error: 'Client ID and at least one item are required' 
                });
            }

            // Calculate total
            const totalAmount = items.reduce((sum, item) => {
                return sum + (item.quantity * item.ratePerUnit) + (item.exWorks || 0);
            }, 0);

            const result = await db.transaction(async () => {
                // Create quote
                const quoteResult = await db.run(`
                    INSERT INTO quotes (client_id, quote_number, total_amount, notes, status)
                    VALUES (?, ?, ?, ?, 'draft')
                `, [clientId, quoteNumber, totalAmount, notes]);

                const quoteId = quoteResult.id;

                // Create quote items
                for (const item of items) {
                    const lineTotal = (item.quantity * item.ratePerUnit) + (item.exWorks || 0);
                    
                    await db.run(`
                        INSERT INTO quote_items 
                        (quote_id, material_id, quantity, unit, rate_per_unit, ex_works, ex_works_location, delivery_cost, delivery_terms, line_total)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        quoteId, item.materialId, item.quantity, item.unit,
                        item.ratePerUnit, item.exWorks || 0, item.exWorksLocation || null, item.deliveryCost || 0, item.deliveryTerms || 'From Ready Stock', lineTotal
                    ]);

                    // Add to price history
                    await priceHistoryModel.create({
                        materialId: item.materialId,
                        clientId: clientId,
                        ratePerUnit: item.ratePerUnit,
                        currency: 'INR',
                        unit: item.unit,
                        quantity: item.quantity,
                        exWorks: item.exWorks || 0,
                        deliveryCost: item.deliveryCost || 0,
                        quotedAt: new Date().toISOString(),
                        source: 'manual_ui'
                    });
                }

                return quoteId;
            });

            // Return the created quote
            const createdQuote = await db.get(`
                SELECT q.*, c.name as client_name
                FROM quotes q
                JOIN clients c ON q.client_id = c.id
                WHERE q.id = ?
            `, [result]);

            res.status(201).json(createdQuote);
        } catch (error) {
            console.error('Error creating quote:', error);
            res.status(500).json({ error: 'Failed to create quote' });
        }
    });

    // Update quote
    router.put('/:id', async (req, res) => {
        try {
            const { status, notes, items } = req.body;
            const quoteId = req.params.id;

            // Check if quote exists
            const existingQuote = await db.get('SELECT * FROM quotes WHERE id = ?', [quoteId]);
            if (!existingQuote) {
                return res.status(404).json({ error: 'Quote not found' });
            }

            await db.transaction(async () => {
                // Update quote basic info
                if (status !== undefined || notes !== undefined) {
                    const setParts = [];
                    const params = [];

                    if (status !== undefined) {
                        setParts.push('status = ?');
                        params.push(status);
                    }
                    if (notes !== undefined) {
                        setParts.push('notes = ?');
                        params.push(notes);
                    }

                    params.push(quoteId);
                    await db.run(`UPDATE quotes SET ${setParts.join(', ')} WHERE id = ?`, params);
                }

                // Update items if provided
                if (items && items.length > 0) {
                    // Delete existing items
                    await db.run('DELETE FROM quote_items WHERE quote_id = ?', [quoteId]);

                    // Calculate new total
                    const totalAmount = items.reduce((sum, item) => {
                        return sum + (item.quantity * item.ratePerUnit) + (item.exWorks || 0);
                    }, 0);

                    // Update total
                    await db.run('UPDATE quotes SET total_amount = ? WHERE id = ?', [totalAmount, quoteId]);

                    // Insert new items
                    for (const item of items) {
                        const lineTotal = (item.quantity * item.ratePerUnit) + (item.exWorks || 0);
                        
                        await db.run(`
                            INSERT INTO quote_items 
                            (quote_id, material_id, quantity, unit, rate_per_unit, ex_works, ex_works_location, delivery_cost, delivery_terms, line_total)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            quoteId, item.materialId, item.quantity, item.unit,
                            item.ratePerUnit, item.exWorks || 0, item.exWorksLocation || null, item.deliveryCost || 0, item.deliveryTerms || 'From Ready Stock', lineTotal
                        ]);
                    }
                }
            });

            // Return updated quote
            const updatedQuote = await db.get(`
                SELECT q.*, c.name as client_name
                FROM quotes q
                JOIN clients c ON q.client_id = c.id
                WHERE q.id = ?
            `, [quoteId]);

            res.json(updatedQuote);
        } catch (error) {
            console.error('Error updating quote:', error);
            res.status(500).json({ error: 'Failed to update quote' });
        }
    });

    // Delete quote
    router.delete('/:id', async (req, res) => {
        try {
            const result = await db.run('DELETE FROM quotes WHERE id = ?', [req.params.id]);
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Quote not found' });
            }
            res.json({ message: 'Quote deleted successfully' });
        } catch (error) {
            console.error('Error deleting quote:', error);
            res.status(500).json({ error: 'Failed to delete quote' });
        }
    });

    // Generate markdown for quote
    router.get('/:id/markdown', async (req, res) => {
        try {
            const quote = await db.get(`
                SELECT q.*, c.name as client_name, c.email as client_email
                FROM quotes q
                JOIN clients c ON q.client_id = c.id
                WHERE q.id = ?
            `, [req.params.id]);

            if (!quote) {
                return res.status(404).json({ error: 'Quote not found' });
            }

            const items = await db.all(`
                SELECT qi.*, m.name as material_name
                FROM quote_items qi
                JOIN materials m ON qi.material_id = m.id
                WHERE qi.quote_id = ?
                ORDER BY qi.created_at
            `, [req.params.id]);

            // Generate markdown
            const date = new Date(quote.created_at).toLocaleDateString();
            let markdown = `# Quotation\n\n`;
            markdown += `**Client:** ${quote.client_name}\n`;
            markdown += `**Date:** ${date}\n`;
            if (quote.quote_number) {
                markdown += `**Quote Number:** ${quote.quote_number}\n`;
            }
            markdown += `\n`;
            
            markdown += `| No | Materials | QTY | Unit | Rate/Unit | Ex Works | Delivery |\n`;
            markdown += `|----|-----------|-----|------|-----------|----------|----------|\n`;
            
            items.forEach((item, index) => {
                const exWorksDisplay = item.ex_works_location || `₹${item.ex_works.toFixed(2)}`;
                const deliveryDisplay = item.delivery_terms || 'From Ready Stock';
                markdown += `| ${index + 1} | ${item.material_name} | ${item.quantity} | ${item.unit} | ₹${item.rate_per_unit.toFixed(2)} | ${exWorksDisplay} | ${deliveryDisplay} |\n`;
            });
            
            markdown += `\n**Total Amount:** ₹${quote.total_amount.toFixed(2)}\n`;
            
            if (quote.notes) {
                markdown += `\n**Notes:** ${quote.notes}\n`;
            }

            res.json({ markdown });
        } catch (error) {
            console.error('Error generating markdown:', error);
            res.status(500).json({ error: 'Failed to generate markdown' });
        }
    });

    // Get quote statistics
    router.get('/stats/summary', async (req, res) => {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_quotes,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_quotes,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_quotes,
                    SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_quotes,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_quotes,
                    SUM(total_amount) as total_value,
                    AVG(total_amount) as avg_quote_value
                FROM quotes
            `);

            res.json(stats);
        } catch (error) {
            console.error('Error fetching quote statistics:', error);
            res.status(500).json({ error: 'Failed to fetch quote statistics' });
        }
    });

    return router;
};
