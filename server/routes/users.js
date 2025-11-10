const express = require('express');
const router = express.Router();
const { requireAdmin, requireAdminOrSelf } = require('../middleware/roleCheck');

module.exports = (userModel) => {
    // Get current user info
    router.get('/me', async (req, res) => {
        try {
            if (!req.user || !req.user.uid) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const user = await userModel.findByFirebaseUid(req.user.uid);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                id: user.id,
                firebaseUid: user.firebase_uid,
                phoneNumber: user.phone_number,
                displayName: user.display_name,
                role: user.role,
                status: user.status,
                createdAt: user.created_at
            });
        } catch (error) {
            console.error('Error fetching current user:', error);
            res.status(500).json({ error: 'Failed to fetch user info' });
        }
    });

    // Register new user (self-registration after Firebase auth)
    router.post('/register', async (req, res) => {
        try {
            if (!req.user || !req.user.uid) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const { displayName } = req.body;

            // Check if user already exists
            const existingUser = await userModel.findByFirebaseUid(req.user.uid);
            if (existingUser) {
                return res.json({
                    message: 'User already registered',
                    user: {
                        id: existingUser.id,
                        role: existingUser.role,
                        status: existingUser.status,
                        displayName: existingUser.display_name
                    }
                });
            }

            // Check if this is the super admin phone number
            const superAdminPhone = process.env.SUPER_ADMIN_PHONE;
            let role = 'pending';
            let status = 'pending_approval';

            if (superAdminPhone && req.user.phoneNumber === superAdminPhone) {
                role = 'super_admin';
                status = 'active';
                console.log(`✅ Registering super admin: ${req.user.phoneNumber}`);
            }

            // Create new user
            const user = await userModel.create({
                firebaseUid: req.user.uid,
                phoneNumber: req.user.phoneNumber,
                displayName: displayName || req.user.phoneNumber,
                role: role,
                status: status
            });

            res.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    role: user.role,
                    status: user.status,
                    displayName: user.display_name
                }
            });
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).json({ error: 'Failed to register user' });
        }
    });

    // Get all users (admin only)
    router.get('/', requireAdmin, async (req, res) => {
        try {
            const users = await userModel.getAll();
            res.json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    // Get pending users (admin only)
    router.get('/pending', requireAdmin, async (req, res) => {
        try {
            const users = await userModel.getPendingUsers();
            res.json(users);
        } catch (error) {
            console.error('Error fetching pending users:', error);
            res.status(500).json({ error: 'Failed to fetch pending users' });
        }
    });

    // Approve user (admin only)
    router.put('/:id/approve', requireAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const { role = 'staff' } = req.body;

            // Validate role
            if (!['staff', 'super_admin'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role. Must be staff or super_admin' });
            }

            // First update the role
            await userModel.updateRole(userId, role, req.user.id);
            
            // Then approve (set status to active)
            const user = await userModel.approve(userId, req.user.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                message: 'User approved successfully',
                user: {
                    id: user.id,
                    phoneNumber: user.phone_number,
                    role: user.role,
                    status: user.status
                }
            });
        } catch (error) {
            console.error('Error approving user:', error);
            res.status(500).json({ error: 'Failed to approve user' });
        }
    });

    // Update user role (admin only)
    router.put('/:id/role', requireAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const { role } = req.body;

            if (!['staff', 'super_admin', 'pending'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            // Prevent changing own role
            if (req.user.id === userId) {
                return res.status(400).json({ error: 'Cannot change your own role' });
            }

            const user = await userModel.updateRole(userId, role, req.user.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                message: 'User role updated successfully',
                user: {
                    id: user.id,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('Error updating user role:', error);
            res.status(500).json({ error: 'Failed to update user role' });
        }
    });

    // Update user status (admin only)
    router.put('/:id/status', requireAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const { status } = req.body;

            if (!['active', 'inactive'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status. Must be active or inactive' });
            }

            // Prevent deactivating own account
            if (req.user.id === userId && status === 'inactive') {
                return res.status(400).json({ error: 'Cannot deactivate your own account' });
            }

            const user = await userModel.updateStatus(userId, status, req.user.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                message: 'User status updated successfully',
                user: {
                    id: user.id,
                    status: user.status
                }
            });
        } catch (error) {
            console.error('Error updating user status:', error);
            res.status(500).json({ error: 'Failed to update user status' });
        }
    });

    // Update display name (any user can update their own)
    router.put('/:id/display-name', requireAdminOrSelf(), async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const { displayName } = req.body;

            if (!displayName || displayName.trim() === '') {
                return res.status(400).json({ error: 'Display name cannot be empty' });
            }

            const user = await userModel.update(userId, { displayName: displayName.trim() });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                message: 'Display name updated successfully',
                user: {
                    id: user.id,
                    displayName: user.display_name
                }
            });
        } catch (error) {
            console.error('Error updating display name:', error);
            res.status(500).json({ error: 'Failed to update display name' });
        }
    });

    // Delete user (admin only)
    router.delete('/:id', requireAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.id);

            // Prevent deleting own account
            if (req.user.id === userId) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            const deleted = await userModel.delete(userId);
            if (!deleted) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });

    return router;
};

