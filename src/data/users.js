import { ROLES } from './roles'

export const seedUsers = [
  {
    id: 'usr-admin',
    fullName: 'Mansour',
    username: 'admin',
    password: 'admin123',
    role: ROLES.ADMIN,
    status: 'active',
  },
  {
    id: 'usr-dispatcher',
    fullName: 'Sarah Al-Qahtani',
    username: 'dispatcher',
    password: 'dispatcher123',
    role: ROLES.DISPATCHER,
    status: 'active',
  },
  {
    id: 'usr-warehouse1',
    fullName: 'Turki Al-Zahrani',
    username: 'warehouse1',
    password: 'warehouse123',
    role: ROLES.WAREHOUSE,
    status: 'active',
  },
  {
    id: 'usr-viewer',
    fullName: 'Lama Al-Suhaimi',
    username: 'viewer',
    password: 'viewer123',
    role: ROLES.VIEWER,
    status: 'active',
  },
]
