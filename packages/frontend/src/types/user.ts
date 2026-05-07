import type Record from 'pocketbase';

export interface User extends Record {
  id?: string;
  name: string;
  email: string;
  roles: { [key: string]: string };
}
