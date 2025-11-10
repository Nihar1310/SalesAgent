class User {
    constructor(db) {
        this.db = db;
    }

    async getAll() {
        return this.db.all(`
            SELECT u.*, 
                   approver.phone_number as approver_phone,
                   approver.display_name as approver_name
            FROM users u
            LEFT JOIN users approver ON u.approved_by = approver.id
            ORDER BY u.created_at DESC
        `);
    }

    async findById(id) {
        return this.db.get('SELECT * FROM users WHERE id = ?', [id]);
    }

    async findByFirebaseUid(firebaseUid) {
        return this.db.get('SELECT * FROM users WHERE firebase_uid = ?', [firebaseUid]);
    }

    async findByPhone(phoneNumber) {
        return this.db.get('SELECT * FROM users WHERE phone_number = ?', [phoneNumber]);
    }

    async create(userData) {
        const { firebaseUid, phoneNumber, displayName, role = 'pending', status = 'pending_approval' } = userData;
        
        const result = await this.db.run(
            `INSERT INTO users (firebase_uid, phone_number, display_name, role, status)
             VALUES (?, ?, ?, ?, ?)`,
            [firebaseUid, phoneNumber, displayName, role, status]
        );

        return this.findById(result.lastID);
    }

    async update(id, userData) {
        const { displayName } = userData;
        
        await this.db.run(
            `UPDATE users SET display_name = ? WHERE id = ?`,
            [displayName, id]
        );

        return this.findById(id);
    }

    async updateRole(id, role, updatedBy) {
        await this.db.run(
            `UPDATE users SET role = ? WHERE id = ?`,
            [role, id]
        );

        return this.findById(id);
    }

    async updateStatus(id, status, approvedBy = null) {
        if (status === 'active' && approvedBy) {
            await this.db.run(
                `UPDATE users SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [status, approvedBy, id]
            );
        } else {
            await this.db.run(
                `UPDATE users SET status = ? WHERE id = ?`,
                [status, id]
            );
        }

        return this.findById(id);
    }

    async approve(id, approvedBy) {
        await this.db.run(
            `UPDATE users 
             SET status = 'active', 
                 approved_by = ?, 
                 approved_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [approvedBy, id]
        );

        return this.findById(id);
    }

    async delete(id) {
        const result = await this.db.run('DELETE FROM users WHERE id = ?', [id]);
        return result.changes > 0;
    }

    async getPendingUsers() {
        return this.db.all(`
            SELECT * FROM users 
            WHERE status = 'pending_approval' 
            ORDER BY created_at ASC
        `);
    }

    async getActiveUsers() {
        return this.db.all(`
            SELECT * FROM users 
            WHERE status = 'active' 
            ORDER BY role DESC, created_at ASC
        `);
    }

    async isAdmin(firebaseUid) {
        const user = await this.findByFirebaseUid(firebaseUid);
        return user && user.role === 'super_admin' && user.status === 'active';
    }

    async isActive(firebaseUid) {
        const user = await this.findByFirebaseUid(firebaseUid);
        return user && user.status === 'active';
    }
}

module.exports = User;

