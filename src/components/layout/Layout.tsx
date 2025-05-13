import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = () => {
  return (
    <>
      <Navbar />
      <main className="pt-20 px-4 min-h-screen">
        <Outlet />
      </main>
      <Footer />
    </>
  );
};

export default Layout;
