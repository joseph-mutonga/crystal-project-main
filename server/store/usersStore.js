/**
 * Crystal Crest - Shared In-Memory Users Store
 * Synchronizes user registrations across Auth & Admin Customers Directory.
 */

const DEFAULT_ADMIN_HASH = '$2b$10$9W7NkaD/6x5hkvogEwNOPOC4POciikYD5D4PtVF.5Ojbycwmvxame';

const usersStore = [
  {
    id: 'usr-admin-001',
    full_name: 'Executive Administrator',
    email: 'admin@crystalcrest.com',
    phone: '+254712345678',
    role: 'admin',
    passwordHash: DEFAULT_ADMIN_HASH,
    created_at: new Date().toISOString()
  },
  {
    id: 'usr-test-002',
    full_name: 'Jane Doe',
    email: 'jane.test@example.com',
    phone: '0712345678',
    role: 'customer',
    passwordHash: DEFAULT_ADMIN_HASH,
    created_at: new Date().toISOString()
  }
];

module.exports = {
  getUsers() {
    return usersStore;
  },
  findUserByEmail(email) {
    const clean = (email || '').toLowerCase().trim();
    return usersStore.find(u => u.email.toLowerCase().trim() === clean);
  },
  findUserById(id) {
    return usersStore.find(u => u.id === id);
  },
  addUser(userObj) {
    const cleanUser = {
      id: userObj.id,
      full_name: userObj.full_name,
      email: userObj.email.toLowerCase().trim(),
      phone: userObj.phone || '',
      role: userObj.role || 'customer',
      passwordHash: userObj.passwordHash,
      created_at: userObj.created_at || new Date().toISOString()
    };
    usersStore.unshift(cleanUser);
    return cleanUser;
  }
};
