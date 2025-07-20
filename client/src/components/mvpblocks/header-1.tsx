'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, ArrowRight, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ModeToggle } from './mode-toggle'
import MultiStepForm from '../ui/multi-step-form'
import { animate } from 'framer-motion'

interface NavItem {
  name: string;
  href: string;
  hasDropdown?: boolean;
  dropdownItems?: { name: string; href: string; description?: string }[];
}

const navItems: NavItem[] = [
  { name: 'Home', href: '/' },
  { name: 'Features', href: '/' },
  {
    name: 'Products',
    href: '/',
    hasDropdown: true,
    dropdownItems: [
      {
        name: 'Hotel/Hostels',
        href: '/',
        description: 'Book Your Hotel Now',
      },
      {
        name: 'Tour Packages',
        href: '/',
        description: 'Tour Packages with Customization',
      },
      { name: 'Bike/Car Rents', 
        href: '/',
         description: 'Book bike/car rent' },
    ],
  },
  { name: 'About', href: '/' },
  { name: 'Pricing', href: '#pricing' },
];

export default function Header1() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const { theme } = useTheme();
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (showSignIn) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [showSignIn]);

  const headerVariants = {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    scrolled: {
      backdropFilter: 'blur(20px)',
      backgroundColor:
        theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    },
  };

  const mobileMenuVariants = {
    closed: { opacity: 0, height: 0 },
    open: { opacity: 1, height: 'auto' },
  };

  const dropdownVariants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  return (
    <motion.header
      className="fixed left-0 right-0 top-0 z-50 transition-all duration-300"
      variants={headerVariants}
      initial="initial"
      animate={isScrolled ? 'scrolled' : 'animate'}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        backgroundColor: isScrolled
          ? theme === 'dark'
            ? 'rgba(0, 0, 0, 0.8)'
            : 'rgba(255, 255, 255, 0.8)'
          : 'transparent',
        boxShadow: isScrolled ? '0 8px 32px rgba(0, 0, 0, 0.1)' : 'none',
      }}
    >
      <div className="mx-auto max-w-7x2 px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          <motion.div
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <a href="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-700">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-rose-500 to-rose-700 bg-clip-text text-xl font-bold text-transparent">
                ABjee Travel
              </span>
            </a>
          </motion.div>

          <nav className="hidden items-center space-x-8 lg:flex">
            {navItems.map((item) => (
              <div
                key={item.name}
                className="relative"
                onMouseEnter={() =>
                  item.hasDropdown && setActiveDropdown(item.name)
                }
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {item.name === 'Pricing' ? (
                  <a
                    href={item.href}
                    className="flex items-center space-x-1 font-medium text-foreground transition-colors duration-200 hover:text-rose-500"
                    onClick={e => {
                      e.preventDefault();
                      const target = document.getElementById('pricing');
                      if (target) {
                        const start = window.scrollY;
                        const end = target.getBoundingClientRect().top + window.scrollY - 60; // adjust for header height
                        animate(start, end, {
                          duration: 0.7,
                          onUpdate: (value) => window.scrollTo(0, value),
                        });
                      }
                    }}
                  >
                    <span>{item.name}</span>
                  </a>
                ) : (
                  <a
                    href={item.href}
                    className="flex items-center space-x-1 font-medium text-foreground transition-colors duration-200 hover:text-rose-500"
                  >
                    <span>{item.name}</span>
                    {item.hasDropdown && (
                      <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                    )}
                  </a>
                )}

                {item.hasDropdown && (
                  <AnimatePresence>
                    {activeDropdown === item.name && (
                      <motion.div
                        className="absolute left-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-lg"
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        transition={{ duration: 0.2 }}
                      >
                        {item.dropdownItems?.map((dropdownItem) => (
                          <a
                            key={dropdownItem.name}
                            href={dropdownItem.href}
                            className="block px-4 py-3 transition-colors duration-200 hover:bg-muted"
                          >
                            <div className="font-medium text-foreground">
                              {dropdownItem.name}
                            </div>
                            {dropdownItem.description && (
                              <div className="text-sm text-muted-foreground">
                                {dropdownItem.description}
                              </div>
                            )}
                          </a>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            ))}
          </nav>

          <div className="hidden items-center space-x-4 lg:flex">
            <a
              href="#"
              className="font-medium text-foreground transition-colors duration-200 hover:text-rose-500"
              onClick={e => { e.preventDefault(); setShowSignIn(true); }}
            >
              Sign In
            </a>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <a
                href="/signup"
                className="inline-flex items-center space-x-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-700 px-6 py-2.5 font-medium text-white transition-all duration-200 hover:shadow-lg"
                onClick={e => { e.preventDefault(); setShowSignIn(true); }}
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>
            <ModeToggle />
          </div>

          {/* Mobile: Theme toggle + Hamburger */}
          <div className="flex items-center space-x-2 lg:hidden">
            <ModeToggle />
            <motion.button
              className="rounded-lg p-2 transition-colors duration-200 hover:bg-muted"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              whileTap={{ scale: 0.95 }}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              className="overflow-hidden lg:hidden"
              variants={mobileMenuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <div className="mt-4 space-y-2 rounded-xl border border-border bg-background/95 py-4 shadow-xl backdrop-blur-lg">
                {navItems.map((item) => (
                  item.name === 'Pricing' ? (
                    <a
                      key={item.name}
                      href={item.href}
                      className="block px-4 py-3 font-medium text-foreground transition-colors duration-200 hover:bg-muted"
                      onClick={e => {
                        e.preventDefault();
                        setIsMobileMenuOpen(false);
                        const target = document.getElementById('pricing');
                        if (target) {
                          const start = window.scrollY;
                          const end = target.getBoundingClientRect().top + window.scrollY - 60; // adjust for header height
                          animate(start, end, {
                            duration: 0.7,
                            onUpdate: (value) => window.scrollTo(0, value),
                          });
                        }
                      }}
                    >
                      {item.name}
                    </a>
                  ) : (
                    <a
                      key={item.name}
                      href={item.href}
                      className="block px-4 py-3 font-medium text-foreground transition-colors duration-200 hover:bg-muted"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </a>
                  )
                ))}
                <div className="space-y-2 px-4 py-2">
                  <a
                    href="/login"
                    className="block w-full rounded-lg py-2.5 text-center font-medium text-foreground transition-colors duration-200 hover:bg-muted"
                    onClick={e => { e.preventDefault(); setIsMobileMenuOpen(false); setShowSignIn(true); }}
                  >
                    Sign In
                  </a>
                  <a
                    href="/signup"
                    className="block w-full rounded-lg bg-gradient-to-r from-rose-500 to-rose-700 py-2.5 text-center font-medium text-white transition-all duration-200 hover:shadow-lg"
                    onClick={e => { e.preventDefault(); setIsMobileMenuOpen(false); setShowSignIn(true); }}
                  >
                    Get Started
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 relative w-full max-w-lg">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 dark:hover:text-white"
              onClick={() => setShowSignIn(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <MultiStepForm />
          </div>
        </div>
      )}
    </motion.header>
  );
  
}
