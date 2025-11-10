require('dotenv').config();
const Database = require('../database/db');
const User = require('../models/User');

async function createSuperAdmin() {
    const db = new Database();
    
    try {
        await db.connect();
        const userModel = new User(db);

        const superAdminPhone = process.env.SUPER_ADMIN_PHONE;
        
        if (!superAdminPhone) {
            console.error('❌ SUPER_ADMIN_PHONE not set in .env file');
            console.log('Add this to your .env file:');
            console.log('SUPER_ADMIN_PHONE=+919979089544');
            process.exit(1);
        }

        console.log(`\n🔍 Checking for super admin with phone: ${superAdminPhone}`);

        // Check if super admin already exists by phone
        const existingByPhone = await userModel.findByPhone(superAdminPhone);
        
        if (existingByPhone) {
            if (existingByPhone.role === 'super_admin' && existingByPhone.status === 'active') {
                console.log('✅ Super admin already exists and is active');
                console.log(`   Phone: ${existingByPhone.phone_number}`);
                console.log(`   Role: ${existingByPhone.role}`);
                console.log(`   Status: ${existingByPhone.status}`);
            } else {
                console.log('📝 Updating existing user to super admin...');
                await userModel.updateRole(existingByPhone.id, 'super_admin', null);
                await userModel.updateStatus(existingByPhone.id, 'active', null);
                console.log('✅ User promoted to super admin');
            }
        } else {
            console.log('\n⚠️  No user found with this phone number');
            console.log('Super admin will be created automatically when you first log in with:');
            console.log(`   Phone: ${superAdminPhone}`);
            console.log('\nThe registration endpoint will detect the SUPER_ADMIN_PHONE and auto-promote you.');
        }

        await db.close();
        console.log('\n✅ Super admin setup complete\n');
    } catch (error) {
        console.error('❌ Error creating super admin:', error);
        await db.close();
        process.exit(1);
    }
}

createSuperAdmin();

