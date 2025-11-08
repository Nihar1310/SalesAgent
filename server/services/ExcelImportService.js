const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class ExcelImportService {
    constructor(db, materialModel, clientModel) {
        this.db = db;
        this.materialModel = materialModel;
        this.clientModel = clientModel;
    }

    async importFromFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const workbook = XLSX.readFile(filePath);
            const result = {
                materials: { imported: 0, skipped: 0, errors: [] },
                clients: { imported: 0, skipped: 0, errors: [] }
            };

            // Import materials if sheet exists (check multiple possible names)
            const materialSheetNames = ['Materials', 'materials', 'Products', 'products', 'Items', 'items'];
            const materialSheetName = workbook.SheetNames.find(name => 
                materialSheetNames.includes(name)
            );
            if (materialSheetName) {
                const materialsResult = await this.importMaterials(workbook.Sheets[materialSheetName]);
                result.materials = materialsResult;
            }

            // Import clients if sheet exists (check multiple possible names)
            const clientSheetNames = ['Clients', 'clients', 'Memory', 'memory', 'Customers', 'customers'];
            const clientSheetName = workbook.SheetNames.find(name => 
                clientSheetNames.includes(name)
            );
            if (clientSheetName) {
                const clientsResult = await this.importClients(workbook.Sheets[clientSheetName]);
                result.clients = clientsResult;
            }

            // If no specific sheets found, try to import from first sheet
            if (result.materials.imported === 0 && result.clients.imported === 0) {
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(firstSheet);
                
                // Try to detect if it's materials or clients based on columns
                if (data.length > 0) {
                    const firstRow = data[0];
                    const columns = Object.keys(firstRow).map(k => k.toLowerCase());
                    
                    if (columns.includes('material') || columns.includes('product') || columns.includes('item')) {
                        result.materials = await this.importMaterialsFromData(data);
                    } else if (columns.includes('client') || columns.includes('customer') || columns.includes('company')) {
                        result.clients = await this.importClientsFromData(data);
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('Excel import error:', error);
            throw error;
        }
    }

    async importMaterials(worksheet) {
        const data = XLSX.utils.sheet_to_json(worksheet);
        return await this.importMaterialsFromData(data);
    }

    async importMaterialsFromData(data) {
        const result = { imported: 0, skipped: 0, errors: [] };
        
        for (const row of data) {
            try {
                const material = this.parseMaterialRow(row);
                if (material.name) {
                    await this.materialModel.create(material);
                    result.imported++;
                } else {
                    result.skipped++;
                }
            } catch (error) {
                result.errors.push({
                    row: row,
                    error: error.message
                });
                if (error.message.includes('UNIQUE constraint')) {
                    result.skipped++;
                } else {
                    console.error('Material import error:', error);
                }
            }
        }
        
        return result;
    }

    async importClients(worksheet) {
        const data = XLSX.utils.sheet_to_json(worksheet);
        return await this.importClientsFromData(data);
    }

    async importClientsFromData(data) {
        const result = { imported: 0, skipped: 0, errors: [] };
        
        for (const row of data) {
            try {
                const client = this.parseClientRow(row);
                if (client.name) {
                    await this.clientModel.create(client);
                    result.imported++;
                } else {
                    result.skipped++;
                }
            } catch (error) {
                result.errors.push({
                    row: row,
                    error: error.message
                });
                if (error.message.includes('UNIQUE constraint')) {
                    result.skipped++;
                } else {
                    console.error('Client import error:', error);
                }
            }
        }
        
        return result;
    }

    parseMaterialRow(row) {
        // Try different possible column names for materials
        const nameFields = ['name', 'material', 'product', 'item', 'material_name', 'product_name'];
        const descFields = ['description', 'desc', 'details', 'material_description'];
        const hsnFields = ['hsn', 'hsn_code', 'hsncode', 'code'];
        const idFields = ['id', 'material_id', 'product_id', 'item_id'];

        const name = this.findFieldValue(row, nameFields);
        const description = this.findFieldValue(row, descFields);
        const hsnCode = this.findFieldValue(row, hsnFields);
        const materialId = this.findFieldValue(row, idFields);

        return {
            name: name ? String(name).trim() : null,
            description: description ? String(description).trim() : null,
            hsnCode: hsnCode ? String(hsnCode).trim() : null,
            materialId: materialId ? String(materialId).trim() : null,
            source: 'master'
        };
    }

    parseClientRow(row) {
        // Try different possible column names for clients
        const nameFields = ['name', 'client', 'customer', 'company', 'client_name', 'customer_name', 'company_name'];
        const emailFields = ['email', 'email_address', 'mail', 'email_hint'];
        const contactFields = ['contact', 'phone', 'mobile', 'telephone', 'contact_number', 'phone_number'];
        const idFields = ['id', 'client_id', 'customer_id', 'company_id'];

        const name = this.findFieldValue(row, nameFields);
        const email = this.findFieldValue(row, emailFields);
        const contact = this.findFieldValue(row, contactFields);
        const clientId = this.findFieldValue(row, idFields);

        // Handle email_hint field - convert domain to potential email
        let processedEmail = email;
        if (email && !email.includes('@') && email.includes('.')) {
            // If it's just a domain like "aiaengineering.com", we'll store it as is
            // The user can update it later with actual email addresses
            processedEmail = email;
        }

        return {
            name: name ? String(name).trim() : null,
            email: processedEmail ? String(processedEmail).trim() : null,
            contact: contact ? String(contact).trim() : null,
            clientId: clientId ? String(clientId).trim() : null,
            source: 'master'
        };
    }

    findFieldValue(row, possibleFields) {
        for (const field of possibleFields) {
            // Try exact match first
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
            
            // Try case-insensitive match
            const keys = Object.keys(row);
            const matchingKey = keys.find(key => key.toLowerCase() === field.toLowerCase());
            if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null && row[matchingKey] !== '') {
                return row[matchingKey];
            }
        }
        return null;
    }

    // Method to get sheet info for debugging
    getWorkbookInfo(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const info = {
                sheetNames: workbook.SheetNames,
                sheets: {}
            };

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                info.sheets[sheetName] = {
                    rowCount: data.length,
                    headers: data[0] || [],
                    sampleData: data.slice(0, 3)
                };
            });

            return info;
        } catch (error) {
            throw new Error(`Error reading workbook: ${error.message}`);
        }
    }
}

module.exports = ExcelImportService;
