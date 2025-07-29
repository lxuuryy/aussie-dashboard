"use client";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { 
  Building2, 
  ShoppingCart, 
  Package, 
  Home,
  Truck,
  Plus,
  Menu,
  X,
  Ship
} from "lucide-react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>Aussie Steel Dashboard</title>
        <meta name="description" content="Steel inventory and order management system" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ${mobileMenuOpen ? 'overflow-hidden' : ''}`}
      >
        {/* Navigation Header - Hidden on dashboard */}
        {!isDashboard && (
          <header className="bg-white shadow-sm border-b sticky top-0 z-40">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                {/* Logo/Brand */}
                <div className="flex-shrink-0">
                  <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
                    <img 
                      src="/background-transparent.png" 
                      alt="Aussie Steel Dashboard" 
                      className="h-8 sm:h-10 w-auto"
                    />
                  </Link>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden lg:flex items-center space-x-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/" className="flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      Home
                    </Link>
                  </Button>

                  <NavigationMenu>
                    <NavigationMenuList>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Add New
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="grid gap-3 p-4 w-[400px]">
                            <NavigationMenuLink asChild>
                              <Link
                                href="/register-company"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4" />
                                  <div className="text-sm font-medium leading-none">Add New Company</div>
                                </div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  Register a new company in the system
                                </p>
                              </Link>
                            </NavigationMenuLink>

                            <NavigationMenuLink asChild>
                              <Link
                                href="/add-order"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="flex items-center gap-2">
                                  <ShoppingCart className="w-4 h-4" />
                                  <div className="text-sm font-medium leading-none">Add New Order</div>
                                </div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  Create a new customer order
                                </p>
                              </Link>
                            </NavigationMenuLink>

                            <NavigationMenuLink asChild>
                              <Link
                                href="/vessel-schedules"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="flex items-center gap-2">
                                  <Truck className="w-4 h-4" />
                                  <div className="text-sm font-medium leading-none">View Vessel Schedules</div>
                                </div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  View times, ETA and ETD of vessels
                                </p>
                              </Link>
                            </NavigationMenuLink>

                            <NavigationMenuLink asChild>
                              <Link
                                href="/add-products"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4" />
                                  <div className="text-sm font-medium leading-none">Add New Product</div>
                                </div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  Add products to the inventory
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                    </NavigationMenuList>
                  </NavigationMenu>

                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/manage-shipping" className="flex items-center gap-2">
                      <Ship className="w-4 h-4" />
                      Manage Shipping
                    </Link>
                  </Button>

                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/register-company" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Company Settings
                    </Link>
                  </Button>
                </div>

                {/* Mobile Menu Button */}
                <div className="lg:hidden">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    aria-expanded={mobileMenuOpen}
                    aria-label="Toggle menu"
                  >
                    {mobileMenuOpen ? (
                      <X className="w-6 h-6" />
                    ) : (
                      <Menu className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>
            </nav>
          </header>
        )}

        {/* Full Screen Mobile Navigation Overlay */}
        {mobileMenuOpen && !isDashboard && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
            
            {/* Menu panel */}
            <div className="fixed inset-0 bg-white flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <img 
                  src="/background-transparent.png" 
                  alt="Aussie Steel Dashboard" 
                  className="h-8 w-auto"
                />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-6 space-y-6">
                  {/* Home Link */}
                  <Link
                    href="/"
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                      <Home className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">Home</div>
                      <div className="text-sm text-gray-500">Go to dashboard</div>
                    </div>
                  </Link>

                  {/* Manage Shipping Link */}
                  <Link
                    href="/manage-shipping"
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center justify-center w-12 h-12 bg-cyan-100 rounded-lg">
                      <Ship className="w-6 h-6 text-cyan-600" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">Manage Shipping</div>
                      <div className="text-sm text-gray-500">Track and manage shipments</div>
                    </div>
                  </Link>

                  {/* Add New Section */}
                  <div>
                    <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Add New
                    </h3>
                    <div className="space-y-2">
                      <Link
                        href="/register-company"
                        className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                          <Building2 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-gray-900">Add New Company</div>
                          <div className="text-sm text-gray-500">Register a new company in the system</div>
                        </div>
                      </Link>

                      <Link
                        href="/add-order"
                        className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                          <ShoppingCart className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-gray-900">Add New Order</div>
                          <div className="text-sm text-gray-500">Create a new customer order</div>
                        </div>
                      </Link>

                      <Link
                        href="/vessel-schedules"
                        className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg">
                          <Truck className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-gray-900">View Vessel Schedules</div>
                          <div className="text-sm text-gray-500">View times, ETA and ETD of vessels</div>
                        </div>
                      </Link>

                      <Link
                        href="/add-products"
                        className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg">
                          <Package className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-gray-900">Add New Product</div>
                          <div className="text-sm text-gray-500">Add products to the inventory</div>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Settings Section */}
                  <div>
                    <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Settings
                    </h3>
                    <Link
                      href="/register-company"
                      className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">Company Settings</div>
                        <div className="text-sm text-gray-500">Manage company information</div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t px-4 py-4">
                <div className="text-center text-sm text-gray-500">
                  © 2024 Aussie Steel Dashboard
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className={isDashboard ? "min-h-screen" : "min-h-screen bg-gray-50"}>
          {children}
        </main>

        {/* Footer - Hidden on dashboard */}
        {!isDashboard && (
          <footer className="bg-white border-t">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="text-center text-sm text-gray-500">
                © 2024 Aussie Steel Dashboard. All rights reserved.
              </div>
            </div>
          </footer>
        )}

        {/* Pushpad Web Push Notifications Script */}
        <Script id="pushpad-init" strategy="afterInteractive">
          {`
            (function(p,u,s,h,x){p.pushpad=p.pushpad||function(){(p.pushpad.q=p.pushpad.q||[]).push(arguments)};h=u.getElementsByTagName('head')[0];x=u.createElement('script');x.async=1;x.src=s;h.appendChild(x);})(window,document,'https://pushpad.xyz/pushpad.js');
            
            pushpad('init', 8999);
          `}
        </Script>
      </body>
    </html>
  );
}