const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel and CSV files are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

module.exports = (excelImportService) => {
    // Import master data from Memory.xlsx
    router.post('/master-data', async (req, res) => {
        try {
            const memoryFilePath = path.join(__dirname, '../../Memory.xlsx');
            
            if (!fs.existsSync(memoryFilePath)) {
                return res.status(404).json({ 
                    error: 'Memory.xlsx file not found. Please ensure it exists in the project root.' 
                });
            }

            const result = await excelImportService.importFromFile(memoryFilePath);
            
            res.json({
                message: 'Master data import completed',
                result: result
            });
        } catch (error) {
            console.error('Master data import error:', error);
            res.status(500).json({ 
                error: 'Failed to import master data',
                details: error.message 
            });
        }
    });

    // Upload and import Excel file
    router.post('/upload', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await excelImportService.importFromFile(req.file.path);
            
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            
            res.json({
                message: 'File import completed',
                result: result
            });
        } catch (error) {
            console.error('File import error:', error);
            
            // Clean up uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.status(500).json({ 
                error: 'Failed to import file',
                details: error.message 
            });
        }
    });

    // Get workbook info for debugging
    router.post('/analyze', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const info = excelImportService.getWorkbookInfo(req.file.path);
            
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            
            res.json(info);
        } catch (error) {
            console.error('File analysis error:', error);
            
            // Clean up uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.status(500).json({ 
                error: 'Failed to analyze file',
                details: error.message 
            });
        }
    });

    // Analyze Memory.xlsx structure
    router.get('/analyze-memory', async (req, res) => {
        try {
            const memoryFilePath = path.join(__dirname, '../../Memory.xlsx');
            
            if (!fs.existsSync(memoryFilePath)) {
                return res.status(404).json({ 
                    error: 'Memory.xlsx file not found' 
                });
            }

            const info = excelImportService.getWorkbookInfo(memoryFilePath);
            res.json(info);
        } catch (error) {
            console.error('Memory file analysis error:', error);
            res.status(500).json({ 
                error: 'Failed to analyze Memory.xlsx',
                details: error.message 
            });
        }
    });

    return router;
};
