# Sales Quotation Memory System

A Gmail-aware sales quotation memory system that helps businesses maintain pricing history and generate consistent quotes.

## Features

- **Master Data Management**: Import and manage materials and clients from Excel files
- **Gmail Integration**: Automatically ingest quotation emails to build price history
- **Intelligent Price Suggestions**: Get pricing recommendations based on historical data
- **Quote Builder**: Create professional quotations with Gmail-ready Markdown output
- **Source Tracking**: Track whether data comes from master lists, Gmail, or manual entry

## Architecture

### Backend (Node.js + Express)
- **Database**: SQLite with comprehensive schema for materials, clients, and price history
- **Models**: Material, Client, PriceHistory with normalized name matching
- **Services**: 
  - ExcelImportService: Handle Memory.xlsx and other Excel imports
  - GmailIngestionService: Process quotation emails automatically
- **APIs**: RESTful endpoints for all CRUD operations

### Frontend (React + Vite)
- **Dashboard**: System overview and quick actions
- **Materials/Clients**: Full CRUD management with search
- **Quote Builder**: Interactive quote creation with price suggestions
- **Import**: Excel file upload and master data import

## Getting Started

### Prerequisites
- Node.js 16+
- Gmail API credentials (for email ingestion)

### Installation

1. **Clone and setup**:
```bash
cd "Sales Agent"
npm install
cd client && npm install && cd ..
```

2. **Environment setup**:
```bash
cp env.example .env
# Edit .env with your Gmail API credentials
```

3. **Database initialization**:
```bash
npm run migrate
```

4. **Import master data**:
Place your `Memory.xlsx` file in the project root, then start the server and use the Import page.

### Development

```bash
# Start both server and client in development mode
npm run dev

# Or run separately:
npm run server:dev  # Server on :3000
npm run client:dev  # Client on :5173 (proxied to server)
```

### Production

```bash
# Build and start
npm run build
npm start
```

## Usage

### 1. Import Master Data
- Place `Memory.xlsx` in project root
- Go to Import page → "Import Master Data"
- System will parse materials and clients sheets

### 2. Gmail Integration
- Get Gmail API credentials from Google Cloud Console
- Configure OAuth in .env file
- Use Gmail auth endpoints to authenticate
- System will run daily ingestion automatically in production

### 3. Create Quotes
- Go to Quote Builder
- Select client and add materials
- System suggests prices based on history
- Generate Gmail-ready Markdown table

## API Endpoints

### Materials
- `GET /api/materials` - List all materials
- `POST /api/materials` - Create material
- `PUT /api/materials/:id` - Update material
- `DELETE /api/materials/:id` - Delete material

### Clients
- `GET /api/clients` - List all clients
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Price History
- `GET /api/price-history/latest/:materialId` - Get latest price
- `GET /api/price-history/material/:materialId` - Get price history
- `POST /api/price-history` - Create price entry

### Import
- `POST /api/import/master-data` - Import Memory.xlsx
- `POST /api/import/upload` - Upload Excel file
- `GET /api/import/analyze-memory` - Analyze Memory.xlsx structure

### Gmail
- `GET /api/gmail/auth-url` - Get OAuth URL
- `POST /api/gmail/auth-callback` - Handle OAuth callback
- `POST /api/gmail/ingest` - Manual ingestion trigger
- `GET /api/gmail/stats` - Ingestion statistics

## Database Schema

### Core Tables
- **materials**: Product catalog with source tracking
- **clients**: Customer database with contact info
- **price_history**: All quotation records with material-client mapping
- **quotes**: Saved quote drafts
- **quote_items**: Line items for quotes
- **gmail_ingestion_log**: Email processing audit trail

### Key Features
- **Source tracking**: `master`, `gmail`, `manual_ui`
- **Normalized names**: For fuzzy matching Gmail entities
- **Price suggestions**: Latest price for (client, material) or fallback to any client
- **Audit trail**: Complete history of all price changes

## Pricing Logic

1. **Client-specific price**: Last quote for this client + material
2. **Fallback price**: Last quote for this material (any client)
3. **No suggestion**: Display "N/A" if no history exists

Master data always takes precedence over Gmail-discovered entities.

## File Structure

```
Sales Agent/
├── server/                 # Backend application
│   ├── database/          # Schema and DB connection
│   ├── models/            # Data models
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   └── tests/             # Unit tests
├── client/                # Frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Main application pages
│   │   └── services/      # API client
├── Memory.xlsx            # Master data file
└── package.json           # Root package configuration
```

## Testing

```bash
# Run backend tests
npm test

# Run with coverage
npm run test:coverage
```

## Deployment

### Environment Variables
- `DATABASE_PATH`: SQLite database file path
- `GMAIL_CLIENT_ID`: Google OAuth client ID
- `GMAIL_CLIENT_SECRET`: Google OAuth client secret
- `GMAIL_REDIRECT_URI`: OAuth redirect URI
- `JWT_SECRET`: JWT signing secret
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

### Production Considerations
- Use proper secret management for Gmail credentials
- Set up SSL/TLS for OAuth callbacks
- Configure proper CORS settings
- Set up database backups
- Monitor Gmail API quotas
- Set up logging and error tracking

## Troubleshooting

### Common Issues

1. **Memory.xlsx not found**: Ensure file is in project root
2. **Gmail auth fails**: Check OAuth credentials and redirect URI
3. **Price suggestions not working**: Verify price history data exists
4. **Import errors**: Check Excel file format and column names

### Debug Mode
Set `NODE_ENV=development` for detailed error messages and logging.

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details.
