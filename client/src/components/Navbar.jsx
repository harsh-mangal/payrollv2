// components/Navbar.jsx
import React from "react";
import { Menu } from "lucide-react";

const Navbar = ({ toggleSidebar }) => {
  const handleLogout = () => {
    localStorage.removeItem("token"); // or your auth storage
    window.location.href = "/login"; // redirect to login
  };

  return (
    <nav className="bg-gray-900 shadow sticky top-0 z-50 h-[70px] w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        {/* Left: Hamburger (mobile) + Logo */}
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-lg text-indigo-600 hover:bg-indigo-100 transition"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-emerald-600">Payroll App</h1>
        </div>

        {/* Right: Logout Button */}
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm sm:text-base"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;