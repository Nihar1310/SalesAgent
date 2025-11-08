class LearningService {
  constructor(db) {
    this.db = db;
    this.name = 'LearningService';
  }

  async learnFromCorrection(originalText, correctedMaterialId, source = 'correction') {
    try {
      // Add original text as alias to corrected material
      await this.db.run(
        `INSERT OR REPLACE INTO material_aliases (material_id, alias, source, created_at) 
         VALUES (?, ?, ?, datetime('now'))`,
        [correctedMaterialId, originalText.trim(), source]
      );
      
      console.log(`Learned material alias: "${originalText}" -> ${correctedMaterialId} (${source})`);
      
      return {
        success: true,
        materialId: correctedMaterialId,
        alias: originalText,
        source: source
      };
      
    } catch (error) {
      console.error('Error learning from material correction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async learnClientAlias(originalText, correctedClientId, source = 'correction') {
    try {
      // For now, we'll use the same table structure for client aliases
      // In a full implementation, you might want a separate client_aliases table
      await this.db.run(
        `INSERT OR REPLACE INTO material_aliases (material_id, alias, source, created_at) 
         VALUES (?, ?, ?, datetime('now'))`,
        [correctedClientId, `CLIENT:${originalText.trim()}`, source]
      );
      
      console.log(`Learned client alias: "${originalText}" -> ${correctedClientId} (${source})`);
      
      return {
        success: true,
        clientId: correctedClientId,
        alias: originalText,
        source: source
      };
      
    } catch (error) {
      console.error('Error learning from client correction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getMaterialAliases() {
    try {
      const aliases = await this.db.all(
        `SELECT material_id, alias, source, created_at 
         FROM material_aliases 
         WHERE alias NOT LIKE 'CLIENT:%'
         ORDER BY created_at DESC`
      );
      
      // Convert to Map for FuzzyMatchingService
      const aliasMap = new Map();
      aliases.forEach(row => {
        aliasMap.set(row.alias, row.material_id);
      });
      
      return aliasMap;
      
    } catch (error) {
      console.error('Error getting material aliases:', error);
      return new Map();
    }
  }

  async getClientAliases() {
    try {
      const aliases = await this.db.all(
        `SELECT material_id as client_id, alias, source, created_at 
         FROM material_aliases 
         WHERE alias LIKE 'CLIENT:%'
         ORDER BY created_at DESC`
      );
      
      // Convert to Map and remove CLIENT: prefix
      const aliasMap = new Map();
      aliases.forEach(row => {
        const cleanAlias = row.alias.replace('CLIENT:', '');
        aliasMap.set(cleanAlias, row.client_id);
      });
      
      return aliasMap;
      
    } catch (error) {
      console.error('Error getting client aliases:', error);
      return new Map();
    }
  }

  async getAllAliases() {
    try {
      const materialAliases = await this.getMaterialAliases();
      const clientAliases = await this.getClientAliases();
      
      return {
        materials: materialAliases,
        clients: clientAliases
      };
      
    } catch (error) {
      console.error('Error getting all aliases:', error);
      return {
        materials: new Map(),
        clients: new Map()
      };
    }
  }

  async recordParsingSuccess(emailId, method, confidence, itemsExtracted) {
    try {
      // Record successful parsing for analytics
      await this.db.run(
        `INSERT INTO parsing_history (email_id, method, confidence, items_extracted, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [emailId, method, confidence, itemsExtracted]
      );
      
    } catch (error) {
      console.error('Error recording parsing success:', error);
    }
  }

  async recordParsingFailure(emailId, method, error, emailSubject = '') {
    try {
      // Record failed parsing for improvement
      await this.db.run(
        `INSERT INTO parsing_failures (email_id, method, error, email_subject, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [emailId, method, error, emailSubject]
      );
      
    } catch (error) {
      console.error('Error recording parsing failure:', error);
    }
  }

  async getParsingStats(days = 30) {
    try {
      const stats = await this.db.get(`
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN confidence >= 0.9 THEN 1 END) as high_confidence,
          COUNT(CASE WHEN confidence >= 0.7 AND confidence < 0.9 THEN 1 END) as medium_confidence,
          COUNT(CASE WHEN confidence < 0.7 THEN 1 END) as low_confidence,
          AVG(confidence) as avg_confidence,
          SUM(items_extracted) as total_items_extracted
        FROM parsing_history 
        WHERE created_at >= datetime('now', '-${days} days')
      `);
      
      const methodStats = await this.db.all(`
        SELECT 
          method,
          COUNT(*) as count,
          AVG(confidence) as avg_confidence,
          SUM(items_extracted) as total_items
        FROM parsing_history 
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY method
        ORDER BY count DESC
      `);
      
      const failures = await this.db.all(`
        SELECT 
          method,
          COUNT(*) as failure_count,
          error
        FROM parsing_failures 
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY method, error
        ORDER BY failure_count DESC
        LIMIT 10
      `);
      
      return {
        overall: stats,
        byMethod: methodStats,
        failures: failures,
        period: `${days} days`
      };
      
    } catch (error) {
      console.error('Error getting parsing stats:', error);
      return null;
    }
  }

  async suggestImprovements() {
    try {
      const stats = await this.getParsingStats(30);
      const suggestions = [];
      
      if (stats && stats.overall) {
        // Analyze confidence levels
        const lowConfidenceRate = stats.overall.low_confidence / stats.overall.total_attempts;
        if (lowConfidenceRate > 0.1) {
          suggestions.push({
            type: 'confidence',
            message: `${(lowConfidenceRate * 100).toFixed(1)}% of parsing attempts have low confidence. Consider reviewing parsing rules.`,
            priority: 'high'
          });
        }
        
        // Analyze method performance
        const htmlMethod = stats.byMethod.find(m => m.method === 'html_table');
        const gptMethod = stats.byMethod.find(m => m.method === 'gpt-4o-mini');
        
        if (htmlMethod && gptMethod) {
          if (htmlMethod.avg_confidence < 0.8) {
            suggestions.push({
              type: 'html_parser',
              message: 'HTML table parser has low average confidence. Consider improving table detection rules.',
              priority: 'medium'
            });
          }
          
          if (gptMethod.count > htmlMethod.count * 0.5) {
            suggestions.push({
              type: 'cost_optimization',
              message: 'GPT-4o Mini is being used frequently. Consider improving HTML parser to reduce costs.',
              priority: 'medium'
            });
          }
        }
        
        // Analyze failures
        if (stats.failures && stats.failures.length > 0) {
          const topFailure = stats.failures[0];
          suggestions.push({
            type: 'failure_pattern',
            message: `Most common failure: ${topFailure.error} (${topFailure.failure_count} times)`,
            priority: 'high'
          });
        }
      }
      
      return suggestions;
      
    } catch (error) {
      console.error('Error generating improvement suggestions:', error);
      return [];
    }
  }

  async exportLearningData() {
    try {
      const aliases = await this.db.all(`
        SELECT material_id, alias, source, created_at 
        FROM material_aliases 
        ORDER BY created_at DESC
      `);
      
      const parsingHistory = await this.db.all(`
        SELECT * FROM parsing_history 
        ORDER BY created_at DESC 
        LIMIT 1000
      `);
      
      const failures = await this.db.all(`
        SELECT * FROM parsing_failures 
        ORDER BY created_at DESC 
        LIMIT 100
      `);
      
      return {
        aliases: aliases,
        parsingHistory: parsingHistory,
        failures: failures,
        exportedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error exporting learning data:', error);
      return null;
    }
  }

  async importLearningData(data) {
    try {
      // Import aliases
      if (data.aliases && Array.isArray(data.aliases)) {
        for (const alias of data.aliases) {
          await this.db.run(
            `INSERT OR REPLACE INTO material_aliases (material_id, alias, source, created_at) 
             VALUES (?, ?, ?, ?)`,
            [alias.material_id, alias.alias, alias.source, alias.created_at]
          );
        }
      }
      
      console.log(`Imported ${data.aliases?.length || 0} aliases`);
      
      return {
        success: true,
        imported: {
          aliases: data.aliases?.length || 0
        }
      };
      
    } catch (error) {
      console.error('Error importing learning data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Cleanup old data
  async cleanup(daysToKeep = 365) {
    try {
      const cutoffDate = `datetime('now', '-${daysToKeep} days')`;
      
      const deletedHistory = await this.db.run(
        `DELETE FROM parsing_history WHERE created_at < ${cutoffDate}`
      );
      
      const deletedFailures = await this.db.run(
        `DELETE FROM parsing_failures WHERE created_at < ${cutoffDate}`
      );
      
      console.log(`Cleaned up ${deletedHistory.changes} parsing history records and ${deletedFailures.changes} failure records`);
      
      return {
        success: true,
        deletedHistory: deletedHistory.changes,
        deletedFailures: deletedFailures.changes
      };
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = LearningService;
