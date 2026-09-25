import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';

const Layout: React.FC = () => {
  const { userRoles } = useAuth();

  return (
    <div className="h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden">
      <header className="fixed top-0 left-0 right-0 h-20 z-20">
        <Header />
      </header>
      <div className="flex pt-20 h-full">
        <aside className="w-64 fixed top-20 left-0 bottom-0 bg-slate-800 z-10">
          <Sidebar userRoles={userRoles} />
        </aside>
        <main className="ml-64 flex-1 h-[calc(100vh-5rem)] overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
