// components/Footer.jsx (Example implementation, adjust as needed)
import React from "react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} Payroll App. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;