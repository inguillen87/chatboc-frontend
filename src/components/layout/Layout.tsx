import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Navbar />
      <main className="flex-1 pt-20 px-4 md:px-8 lg:px-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
