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
  Plus
} from "lucide-react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Move metadata to a separate file or handle it differently
// export const metadata: Metadata = {
//   title: "Aussie Steel Dashboard",
//   description: "Steel inventory and order management system",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  return (
    <html lang="en">
      <head>
        <title>Aussie Steel Dashboard</title>
        <meta name="description" content="Steel inventory and order management system" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Navigation Header - Hidden on dashboard */}
        {!isDashboard && (
          <header className="bg-white shadow-sm border-b sticky top-0 z-50">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                {/* Logo/Brand */}
                <div className="flex-shrink-0">
                  <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
                    <img 
                      src="/background-transparent.png" 
                      alt="Aussie Steel Dashboard" 
                      className="h-10 w-auto"
                    />
                  </Link>
                </div>

                {/* Navigation Links - Desktop */}
                <div className="hidden md:flex items-center space-x-2">
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
                    <Link href="/register-company" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Company Settings
                    </Link>
                  </Button>
                </div>

                {/* Mobile Navigation Menu */}
                <div className="md:hidden">
                  <NavigationMenu>
                    <NavigationMenuList>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger>Menu</NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="grid gap-3 p-4 w-[300px]">
                            <NavigationMenuLink asChild>
                              <Link
                                href="/"
                                className="flex items-center gap-2 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <Home className="w-4 h-4" />
                                <span className="text-sm font-medium">Home</span>
                              </Link>
                            </NavigationMenuLink>

                            <NavigationMenuLink asChild>
                              <Link
                                href="/register-company"
                                className="flex items-center gap-2 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <Building2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Add New Company</span>
                              </Link>
                            </NavigationMenuLink>

                            <NavigationMenuLink asChild>
                              <Link
                                href="/add-order"
                                className="flex items-center gap-2 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <ShoppingCart className="w-4 h-4" />
                                <span className="text-sm font-medium">Add New Order</span>
                              </Link>
                            </NavigationMenuLink>

                            <NavigationMenuLink asChild>
                              <Link
                                href="/add-products"
                                className="flex items-center gap-2 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <Package className="w-4 h-4" />
                                <span className="text-sm font-medium">Add New Product</span>
                              </Link>
                            </NavigationMenuLink>

                            <NavigationMenuLink asChild>
                              <Link
                                href="/register-company"
                                className="flex items-center gap-2 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <Building2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Company Settings</span>
                              </Link>
                            </NavigationMenuLink>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                    </NavigationMenuList>
                  </NavigationMenu>
                </div>
              </div>
            </nav>
          </header>
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